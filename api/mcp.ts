/**
 * Evolution 2.10D (#181): STACK's remote MCP endpoint — the thing a runner
 * actually registers in ChatGPT's or Claude's connector settings.
 *
 * This route is transport and nothing else. It authenticates the same way
 * every other external route does (a personal, revocable bearer token), then
 * hands the JSON-RPC message to `src/external/mcpServer.ts`, which calls back
 * into `api/training-context.ts` and `api/plan-adjustments.ts` *in process*,
 * with the caller's own token, through their exported handlers.
 *
 * That indirection is the whole security argument: the connector cannot reach
 * Supabase, cannot see a user id, and cannot form a request the REST surface
 * would not have accepted from any other client. Scope enforcement, revocation,
 * runner binding, stale-plan conflicts and the immutability of run/Build
 * history all keep happening exactly where they happened before — in those
 * routes and, authoritatively, in SQL. Nothing here can widen them, and if
 * this endpoint is down, every other part of STACK is untouched.
 *
 * See docs/EXTERNAL_INTEGRATION.md for the runner-facing setup flow.
 */
import {
  handleMcpBody,
  mcpParseError,
  type PlanAdjustmentInput,
  type StackApiResult,
  type StackExternalApi,
} from "../src/external/mcpServer.js";
import { readTrainingContext } from "./training-context.js";
import { handlePlanAdjustments } from "./plan-adjustments.js";

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

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * A remote MCP server is called by an assistant's backend, not by a browser —
 * but MCP Inspector and other browser-based clients do exist, and this
 * endpoint carries no cookies and no ambient authority, only a bearer token
 * the caller must already hold. `*` is therefore safe here in a way it would
 * not be on a session-authenticated route.
 */
const CORS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type, Accept, MCP-Protocol-Version, Mcp-Session-Id",
  "Access-Control-Max-Age": "86400",
};

function json(status: number, body: object, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS,
      ...extra,
    },
  });
}

/** A JSON-RPC-shaped body for a failure the transport itself has to report. */
function transportError(status: number, code: number, message: string, extra?: Record<string, string>): Response {
  return json(status, { jsonrpc: "2.0", id: null, error: { code, message } }, extra);
}

/**
 * The runner's own STACK, reached only through the routes that already police
 * it. `token` is the caller's; it is never logged, never widened, and never
 * substituted for one of STACK's own credentials.
 */
function stackApi(token: string, env: Environment, fetcher: typeof fetch): StackExternalApi {
  const authorized = { Authorization: `Bearer ${token}` };

  async function outcome(response: Response): Promise<StackApiResult> {
    try {
      return { status: response.status, body: await response.json() };
    } catch {
      return { status: response.status, body: null };
    }
  }

  return {
    async getTrainingContext(): Promise<StackApiResult> {
      return outcome(
        await readTrainingContext(
          new Request("https://stack.internal/api/training-context", { method: "GET", headers: authorized }),
          env,
          fetcher,
        ),
      );
    },

    async applyPlanAdjustment(input: PlanAdjustmentInput): Promise<StackApiResult> {
      return outcome(
        await handlePlanAdjustments(
          new Request("https://stack.internal/api/plan-adjustments", {
            method: "POST",
            headers: { ...authorized, "Content-Type": "application/json" },
            body: JSON.stringify({
              operations: input.operations,
              expectedPlanRevision: input.expectedPlanRevision,
              reason: input.reason,
            }),
          }),
          env,
          fetcher,
        ),
      );
    },

    async undoPlanAdjustment(adjustmentId: string): Promise<StackApiResult> {
      return outcome(
        await handlePlanAdjustments(
          new Request(
            `https://stack.internal/api/plan-adjustments?id=${encodeURIComponent(adjustmentId)}`,
            { method: "DELETE", headers: authorized },
          ),
          env,
          fetcher,
        ),
      );
    },
  };
}

export async function handleMcp(
  request: Request,
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  // Streamable HTTP allows a server to decline the server-initiated stream;
  // STACK is stateless and request/response only, so there is no SSE channel
  // to open on GET and no session to end on DELETE.
  if (request.method !== "POST") {
    return transportError(
      405,
      -32600,
      "STACK's connector endpoint: deployed and ready. It answers JSON-RPC over POST only — it opens no server-initiated stream and holds no session.",
      { Allow: "POST, OPTIONS" },
    );
  }

  const token = BEARER.exec(request.headers.get("Authorization") ?? "")?.[1]?.trim();
  if (!token) {
    // Fail here, before any JSON-RPC work, so a connector configured without
    // a token fails loudly at `initialize` rather than silently at the first
    // tool call. A token that is present but revoked or unknown is not this
    // route's call to make — it is resolved by the same SQL as always, and
    // reported back through the tool result.
    return transportError(
      401,
      -32001,
      "This request carried no STACK token. A STACK connection is set up with a personal access token from Settings → Account & Crew → External Assistant Access, entered in the assistant's connector setup — never in a chat message.",
      { "WWW-Authenticate": 'Bearer realm="STACK"' },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(400, mcpParseError());
  }

  const response = await handleMcpBody(body, stackApi(token, env, fetcher));
  // Nothing to answer: the body held only notifications.
  if (response === null) return new Response(null, { status: 202, headers: CORS });
  return json(200, response as object);
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
  if (!isNodeResponse(second)) return handleMcp(first as Request);

  const request = first as NodeRequest;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }

  const response = await handleMcp(
    new Request(`https://reader.invalid${request.url ?? "/api/mcp"}`, {
      method: request.method ?? "GET",
      headers,
      body: request.method === "POST" ? JSON.stringify(request.body ?? {}) : undefined,
    }),
  );

  second.statusCode = response.status;
  response.headers.forEach((value, name) => second.setHeader(name, value));
  second.end(await response.text());
}
