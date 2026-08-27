/**
 * Evolution 2.10A (#178): the one read-only endpoint an authorized external
 * assistant (ChatGPT via `api/openapi.ts`, Claude via `api/mcp.ts`, or
 * anything else that can send a bearer token) uses to see a runner's own
 * training context. STACK stays the source of truth — this route makes zero
 * calls to any AI/model provider, and nothing it returns can be written back
 * through it. See docs/EXTERNAL_TRAINING_CONTEXT.md.
 *
 * Auth is a personal, revocable bearer token (Settings → External Assistant
 * Access), never a Supabase session: the caller here has none. The token is
 * hashed and handed to a security-definer RPC — `external_training_snapshot`
 * — using STACK's own anon key, the same shape `api/_crewInvitePreview.ts`
 * already uses for a different capability token. The RPC alone resolves
 * which account the token belongs to; this route never sees or accepts a
 * raw user id, which is what makes cross-user access structurally impossible
 * from here, not merely policy.
 */
import {
  parseBuildRow,
  parseIntervalsRow,
  parseRunRow,
  parseTrainingRow,
} from "../src/personal-sync/personalCloudRepository.js";
import { appStateFromCloud } from "../src/personal-sync/reconciliation.js";
import type { PersonalCloudSnapshot } from "../src/personal-sync/types.js";
import {
  projectExternalTrainingContext,
  type ExternalCrewSummaryRow,
  type ExternalPlanAdjustmentRow,
} from "../src/external/trainingContextProjection.js";
import {
  checkSupabaseBoundary,
  deploymentEnvironmentFromVercel,
} from "../src/crew/supabaseEnvironment.js";
import { todayUtc } from "../src/domain/dates.js";

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

function json(status: number, body: object, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
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

/** Untrusted network JSON in, an explicit allowlist out — nothing here is ever spread. */
function parsePlanAdjustmentRow(value: unknown): ExternalPlanAdjustmentRow | null {
  const row = record(value);
  const kind = row?.kind === "apply" || row?.kind === "undo" ? row.kind : null;
  return typeof row?.appliedAt === "string" &&
    kind &&
    Array.isArray(row.operations) &&
    (row.reason === null || typeof row.reason === "string") &&
    typeof row.reverted === "boolean"
    ? {
        appliedAt: row.appliedAt,
        kind,
        operations: row.operations,
        reason: row.reason,
        reverted: row.reverted,
      }
    : null;
}

/** Untrusted network JSON in, an explicit allowlist out — nothing here is ever spread. */
function parseCrewRow(value: unknown): ExternalCrewSummaryRow | null {
  const row = record(value);
  const role = row?.role === "owner" || row?.role === "member" ? row.role : null;
  const weeklyMiles = typeof row?.weeklyMiles === "number" ? row.weeklyMiles : null;
  const longestRun28dMiles = typeof row?.longestRun28dMiles === "number" ? row.longestRun28dMiles : null;
  const consistencyCompleted = typeof row?.consistencyCompleted === "number" ? row.consistencyCompleted : null;
  const consistencyDue = typeof row?.consistencyDue === "number" ? row.consistencyDue : null;
  const milesBuilt = typeof row?.milesBuilt === "number" ? row.milesBuilt : null;
  return typeof row?.crewName === "string" &&
    role &&
    weeklyMiles !== null &&
    longestRun28dMiles !== null &&
    consistencyCompleted !== null &&
    consistencyDue !== null &&
    milesBuilt !== null
    ? {
        crewName: row.crewName,
        role,
        weeklyMiles,
        longestRun28dMiles,
        consistencyCompleted,
        consistencyDue,
        milesBuilt,
      }
    : null;
}

/**
 * Rebuilds the same `PersonalCloudSnapshot` shape `loadPersonalCloudSnapshot`
 * assembles client-side, from the RPC's raw table rows, so `appStateFromCloud`
 * — the one tested reconstruction path — can be reused unmodified.
 */
function snapshotFromRpcPayload(raw: Record<string, unknown>): PersonalCloudSnapshot {
  const training = parseTrainingRow(raw.training);
  const build = parseBuildRow(raw.build);
  const intervals = parseIntervalsRow(raw.intervals);
  const runRows = Array.isArray(raw.runs) ? raw.runs : [];
  const trainingRow = record(raw.training);
  const accountGeneration = Number(trainingRow?.account_generation);
  if (!Number.isFinite(accountGeneration) || accountGeneration <= 0) {
    throw new Error("Cloud account generation is malformed.");
  }
  return {
    accountGeneration,
    training: training.document,
    trainingRevision: training.revision,
    runs: runRows.map(parseRunRow),
    placements: build.placements,
    buildRevision: build.revision,
    intervals: intervals.document,
    intervalsRevision: intervals.revision,
  };
}

export async function readTrainingContext(
  request: Request,
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "GET") {
    return json(
      405,
      { error: "method_not_allowed", message: "STACK training context: deployed and ready. It answers GET only." },
      { Allow: "GET" },
    );
  }

  const url = (env.SUPABASE_URL ?? env.VITE_SUPABASE_URL)?.trim();
  const key = (env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY)?.trim();
  const backendEnvironment = (env.STACK_BACKEND_ENV ?? env.VITE_STACK_BACKEND_ENV)?.trim();
  if (!url || !key || !backendEnvironment) {
    const missing = [!url && "SUPABASE_URL", !key && "SUPABASE_PUBLISHABLE_KEY", !backendEnvironment && "STACK_BACKEND_ENV"]
      .filter(Boolean)
      .join(" and ");
    return json(503, { error: "not_configured", missing, message: `The external training context is not configured on the server: ${missing} is not set for this deployment.` });
  }
  const boundary = checkSupabaseBoundary(url, backendEnvironment, deploymentEnvironmentFromVercel(env.VERCEL_ENV));
  if (!boundary.allowed) {
    return json(503, { error: "not_configured", message: "The external training context is misconfigured for this deployment." });
  }

  const match = BEARER.exec(request.headers.get("Authorization") ?? "");
  const token = match?.[1]?.trim();
  if (!token) {
    return json(401, { error: "unauthorized", message: "This request did not carry a bearer token." });
  }

  let response: Response;
  try {
    response = await fetcher(`${url.replace(/\/$/, "")}/rest/v1/rpc/external_training_snapshot`, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token_hash: await sha256Hex(token) }),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return json(504, { error: "upstream_timeout", message: "STACK's own database took too long to answer." });
    }
    return json(502, { error: "upstream_unavailable", message: "STACK's own database could not be reached." });
  }

  if (!response.ok) {
    // Every failure this RPC raises means one thing to an outside caller: the
    // token presented is not usable. Never distinguish "unknown" from
    // "revoked" from "malformed" in the response — that is an enumeration
    // signal this route has no reason to hand out.
    return json(401, { error: "unauthorized", message: "That token is not valid. It may be malformed or revoked." });
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    return json(502, { error: "upstream_unavailable", message: "STACK's own database returned something unreadable." });
  }

  const today = todayUtc();
  if (payload === null) {
    // A valid token for an account that has never turned on personal cloud
    // sync. Truthfully empty, not an error — the same posture Plan and Today
    // already take for "no active plan."
    return json(200, projectExternalTrainingContext(
      { plan: null, planHistory: [], runLogs: [], blockPlacements: [] },
      today,
    ));
  }

  const raw = record(payload);
  if (!raw) {
    return json(502, { error: "upstream_unavailable", message: "STACK's own database returned an unexpected shape." });
  }

  try {
    const snapshot = snapshotFromRpcPayload(raw);
    const state = appStateFromCloud(snapshot);
    const crewRows = Array.isArray(raw.crew)
      ? raw.crew.map(parseCrewRow).filter((row): row is ExternalCrewSummaryRow => row !== null)
      : [];
    const planAdjustmentRows = Array.isArray(raw.planAdjustments)
      ? raw.planAdjustments.map(parsePlanAdjustmentRow).filter((row): row is ExternalPlanAdjustmentRow => row !== null)
      : [];
    return json(200, projectExternalTrainingContext(state, today, crewRows, planAdjustmentRows));
  } catch {
    // A malformed cloud document is a data-integrity problem, not something
    // this route can explain to an external caller beyond "try again later."
    return json(502, { error: "upstream_unavailable", message: "STACK's own training data could not be read." });
  }
}

/**
 * The shape of a Node request/response, described here rather than imported,
 * so this needs no `@types/node` for a path that may never be taken. Mirrors
 * `api/intervals.ts`'s handler exactly — same GET-only, header-auth shape.
 */
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface NodeRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function isNodeResponse(value: unknown): value is NodeResponse {
  return typeof (value as NodeResponse | null | undefined)?.end === "function";
}

export default async function handler(first: unknown, second?: unknown): Promise<Response | void> {
  if (!isNodeResponse(second)) return readTrainingContext(first as Request);

  const request = first as NodeRequest;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }

  const response = await readTrainingContext(
    new Request(`https://reader.invalid${request.url ?? "/api/training-context"}`, {
      method: request.method ?? "GET",
      headers,
    }),
  );

  second.statusCode = response.status;
  response.headers.forEach((value, name) => second.setHeader(name, value));
  second.end(await response.text());
}
