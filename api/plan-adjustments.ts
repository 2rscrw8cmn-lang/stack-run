/**
 * Evolution 2.10C (#180): the one write surface an authorized external
 * assistant uses to adjust *future* plan intent — never Build, never actual
 * runs, never archived plans, never the race goal. See
 * docs/PLAN_ADJUSTMENTS.md.
 *
 * Same bearer-token auth as `api/training-context.ts` (#178). The real
 * enforcement of what this token may and may not touch happens in SQL
 * (`_plan_patch_swap`, migration `20260825120000_plan_adjustments.sql`),
 * independent of anything validated here — this route's job is to compose a
 * new plan from the requested operations using the exact same pure editors
 * (`src/domain/planEdit.ts`) the in-app Plan screen uses, and to translate
 * the RPCs' outcomes into an honest response, never a raw internal detail.
 */
import { todayUtc, isLocalDateString } from "../src/domain/dates.js";
import {
  applyPlanAdjustments,
  type PlanAdjustmentOperation,
} from "../src/domain/planAdjustment.js";
import { PlanEditError } from "../src/domain/planEdit.js";
import type { RunActivityType, TrainingPlan } from "../src/domain/types.js";
import { parseTrainingRow } from "../src/personal-sync/personalCloudRepository.js";
import { appStateFromCloud } from "../src/personal-sync/reconciliation.js";
import { projectPlan } from "../src/external/trainingContextProjection.js";
import {
  checkSupabaseBoundary,
  deploymentEnvironmentFromVercel,
} from "../src/crew/supabaseEnvironment.js";

type Environment = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  STACK_BACKEND_ENV?: string;
  VITE_STACK_BACKEND_ENV?: string;
  VERCEL_ENV?: string;
};

declare const process: { env: Environment };

const TIMEOUT_MS = 15_000;
const BEARER = /^Bearer\s+(.+)$/i;
const RUN_ACTIVITY_TYPES: readonly RunActivityType[] = ["easy", "intervals", "simulation", "long", "race", "cross"];

function json(status: number, body: object): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function resolvedEnv(env: Environment): { url: string; key: string } | null {
  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.trim();
  const key = (env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim();
  const backendEnvironment = (env.STACK_BACKEND_ENV ?? env.VITE_STACK_BACKEND_ENV)?.trim();
  if (!url || !key || !backendEnvironment) return null;
  const boundary = checkSupabaseBoundary(url, backendEnvironment, deploymentEnvironmentFromVercel(env.VERCEL_ENV));
  return boundary.allowed ? { url, key } : null;
}

function bearerToken(request: Request): string | null {
  return BEARER.exec(request.headers.get("Authorization") ?? "")?.[1]?.trim() ?? null;
}

/** Untrusted network JSON in, an explicit allowlist out. */
function parsePlannedRunValues(value: unknown): { type: RunActivityType; title: string; targetDistanceMiles: string | null; details: string } | null {
  const row = record(value);
  if (!row) return null;
  const type = typeof row.type === "string" && (RUN_ACTIVITY_TYPES as readonly string[]).includes(row.type)
    ? (row.type as RunActivityType)
    : null;
  if (!type || typeof row.title !== "string" || typeof row.details !== "string") return null;
  if (row.targetDistanceMiles !== null && typeof row.targetDistanceMiles !== "string") return null;
  return { type, title: row.title, targetDistanceMiles: row.targetDistanceMiles, details: row.details };
}

function parseOperation(value: unknown): PlanAdjustmentOperation | null {
  const row = record(value);
  const workoutId = typeof row?.workoutId === "string" && row.workoutId ? row.workoutId : null;
  if (!workoutId) return null;
  switch (row?.op) {
    case "move":
      return typeof row.toDate === "string" && isLocalDateString(row.toDate)
        ? { op: "move", workoutId, toDate: row.toDate }
        : null;
    case "editRun": {
      const values = parsePlannedRunValues(row.values);
      return values ? { op: "editRun", workoutId, values } : null;
    }
    case "addRun": {
      const values = parsePlannedRunValues(row.values);
      return values ? { op: "addRun", workoutId, values } : null;
    }
    case "skip":
      return { op: "skip", workoutId };
    default:
      return null;
  }
}

function parseOperations(value: unknown): PlanAdjustmentOperation[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const operations = value.map(parseOperation);
  return operations.every((operation): operation is PlanAdjustmentOperation => operation !== null)
    ? operations
    : null;
}

/**
 * Resolves the caller's own current active plan through the same read RPC
 * `api/training-context.ts` uses. This route needs the current plan (to run
 * the exact same pure editors the in-app Plan screen uses) before it has
 * anything to hand `apply_plan_patch`; `undo_plan_patch` needs no such
 * fetch, since it restores from its own stored before-state entirely in SQL.
 */
async function fetchCurrentPlan(
  token: string,
  url: string,
  key: string,
  fetcher: typeof fetch,
): Promise<{ ok: true; plan: TrainingPlan | null } | { ok: false; status: number; body: object }> {
  let response: Response;
  try {
    response = await fetcher(`${url.replace(/\/$/, "")}/rest/v1/rpc/external_training_snapshot`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token_hash: await sha256Hex(token) }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return { ok: false, status: 504, body: { error: "upstream_timeout", message: "STACK's own database took too long to answer." } };
    }
    return { ok: false, status: 502, body: { error: "upstream_unavailable", message: "STACK's own database could not be reached." } };
  }
  if (!response.ok) {
    return { ok: false, status: 401, body: { error: "unauthorized", message: "That token is not valid. It may be malformed or revoked." } };
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return { ok: false, status: 502, body: { error: "upstream_unavailable", message: "STACK's own database returned something unreadable." } };
  }
  if (payload === null) return { ok: true, plan: null };
  const raw = record(payload);
  const trainingRow = raw ? record(raw.training) : null;
  if (!trainingRow) {
    return { ok: false, status: 502, body: { error: "upstream_unavailable", message: "STACK's own database returned an unexpected shape." } };
  }
  try {
    const state = appStateFromCloud({
      accountGeneration: 1,
      training: parseTrainingRow(trainingRow).document,
      trainingRevision: 1,
      runs: [],
      placements: [],
      buildRevision: 1,
      intervals: { lastSuccessfulActivitySyncAt: null, ignoredActivityIds: [], pendingCandidates: [] },
      intervalsRevision: 1,
    });
    return { ok: true, plan: state.plan };
  } catch {
    return { ok: false, status: 502, body: { error: "upstream_unavailable", message: "STACK's own training data could not be read." } };
  }
}

/** Maps a raised Postgres exception's message to an honest, non-enumerating response. */
function mapRpcFailure(message: string | null): { status: number; body: object } {
  switch (message) {
    case "token_invalid_or_revoked":
      return { status: 401, body: { error: "unauthorized", message: "That token is not valid. It may be malformed or revoked." } };
    case "plan_not_found":
      return { status: 422, body: { error: "no_active_plan", message: "There is no active plan to adjust." } };
    case "plan_adjustment_not_found":
      return { status: 404, body: { error: "not_found", message: "That adjustment does not exist." } };
    case "plan_adjustment_not_undoable":
    case "plan_adjustment_already_reverted":
      return { status: 409, body: { error: "not_undoable", message: "That adjustment can no longer be undone." } };
    case "plan_revision_conflict":
    case "plan_patch_touches_immutable_field":
    case "plan_patch_invalid":
    case "plan_patch_empty":
      return { status: 409, body: { error: "plan_changed", message: "The plan changed underneath this request, or this adjustment could not be applied as requested." } };
    default:
      return { status: 502, body: { error: "upstream_unavailable", message: "STACK's own database could not complete this change." } };
  }
}

async function readRpcFailure(response: Response): Promise<{ status: number; body: object }> {
  try {
    const payload = record(await response.json());
    return mapRpcFailure(typeof payload?.message === "string" ? payload.message : null);
  } catch {
    return { status: 502, body: { error: "upstream_unavailable", message: "STACK's own database returned something unreadable." } };
  }
}

async function applyAdjustment(
  request: Request,
  env: Environment,
  fetcher: typeof fetch,
): Promise<Response> {
  const configured = resolvedEnv(env);
  if (!configured) return json(503, { error: "not_configured", message: "Plan adjustments are not configured for this deployment." });
  const token = bearerToken(request);
  if (!token) return json(401, { error: "unauthorized", message: "This request did not carry a bearer token." });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, { error: "invalid_request", message: "Request body must be JSON." });
  }
  const row = record(body);
  const operations = row ? parseOperations(row.operations) : null;
  const expectedPlanRevision = typeof row?.expectedPlanRevision === "number" ? row.expectedPlanRevision : null;
  const reason = row?.reason === undefined || row.reason === null ? null : typeof row.reason === "string" ? row.reason : undefined;
  if (!operations || expectedPlanRevision === null || reason === undefined) {
    return json(400, { error: "invalid_request", message: "Expected { operations: [...], expectedPlanRevision, reason? }." });
  }

  const current = await fetchCurrentPlan(token, configured.url, configured.key, fetcher);
  if (!current.ok) return json(current.status, current.body);
  if (!current.plan) return json(422, { error: "no_active_plan", message: "There is no active plan to adjust." });
  if (current.plan.revision !== expectedPlanRevision) {
    return json(409, { error: "plan_changed", message: "The plan changed underneath this request, or this adjustment could not be applied as requested." });
  }

  let newPlan: TrainingPlan;
  try {
    newPlan = applyPlanAdjustments(current.plan, todayUtc(), operations);
  } catch (error) {
    return json(422, { error: "invalid_operation", message: error instanceof PlanEditError ? error.message : "That adjustment could not be applied." });
  }

  let response: Response;
  try {
    response = await fetcher(`${configured.url.replace(/\/$/, "")}/rest/v1/rpc/apply_plan_patch`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { apikey: configured.key, Authorization: `Bearer ${configured.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        p_token_hash: await sha256Hex(token),
        p_expected_plan_revision: expectedPlanRevision,
        p_new_plan: newPlan,
        p_operations: operations,
        p_reason: reason,
      }),
    });
  } catch {
    return json(502, { error: "upstream_unavailable", message: "STACK's own database could not be reached." });
  }
  if (!response.ok) {
    const failure = await readRpcFailure(response);
    return json(failure.status, failure.body);
  }

  const result = record(await response.json());
  const resultPlan = result?.plan as TrainingPlan | undefined;
  if (!resultPlan) return json(502, { error: "upstream_unavailable", message: "STACK's own database returned an unexpected shape." });

  return json(200, {
    adjustmentId: result?.adjustmentId,
    plan: projectPlan(resultPlan, [], todayUtc()),
    revision: result?.revision,
  });
}

async function undoAdjustment(
  request: Request,
  env: Environment,
  fetcher: typeof fetch,
): Promise<Response> {
  const configured = resolvedEnv(env);
  if (!configured) return json(503, { error: "not_configured", message: "Plan adjustments are not configured for this deployment." });
  const token = bearerToken(request);
  if (!token) return json(401, { error: "unauthorized", message: "This request did not carry a bearer token." });

  const adjustmentId = new URL(request.url).searchParams.get("id");
  if (!adjustmentId) return json(400, { error: "invalid_request", message: "Expected ?id=<adjustmentId>." });

  let response: Response;
  try {
    response = await fetcher(`${configured.url.replace(/\/$/, "")}/rest/v1/rpc/undo_plan_patch`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { apikey: configured.key, Authorization: `Bearer ${configured.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token_hash: await sha256Hex(token), p_adjustment_id: adjustmentId }),
    });
  } catch {
    return json(502, { error: "upstream_unavailable", message: "STACK's own database could not be reached." });
  }
  if (!response.ok) {
    const failure = await readRpcFailure(response);
    return json(failure.status, failure.body);
  }

  const result = record(await response.json());
  const resultPlan = result?.plan as TrainingPlan | undefined;
  if (!resultPlan) return json(502, { error: "upstream_unavailable", message: "STACK's own database returned an unexpected shape." });

  return json(200, { plan: projectPlan(resultPlan, [], todayUtc()), revision: result?.revision });
}

export async function handlePlanAdjustments(
  request: Request,
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method === "POST") return applyAdjustment(request, env, fetcher);
  if (request.method === "DELETE") return undoAdjustment(request, env, fetcher);
  return json(405, { error: "method_not_allowed", message: "STACK plan adjustments: deployed and ready. It answers POST (apply) and DELETE (undo)." });
}

/** Mirrors `api/training-context.ts`'s Node request/response shim exactly. */
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface NodeRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
}

function isNodeResponse(value: unknown): value is NodeResponse {
  return typeof (value as NodeResponse | null | undefined)?.end === "function";
}

export default async function handler(first: unknown, second?: unknown): Promise<Response | void> {
  if (!isNodeResponse(second)) return handlePlanAdjustments(first as Request);

  const request = first as NodeRequest;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }

  const response = await handlePlanAdjustments(
    new Request(`https://reader.invalid${request.url ?? "/api/plan-adjustments"}`, {
      method: request.method ?? "GET",
      headers,
      body: request.method === "POST" ? JSON.stringify(request.body ?? {}) : undefined,
    }),
  );

  second.statusCode = response.status;
  response.headers.forEach((value, name) => second.setHeader(name, value));
  second.end(await response.text());
}
