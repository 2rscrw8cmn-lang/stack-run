/**
 * The remote MCP server (Model Context Protocol) an authorized Claude
 * connector calls — Claude's equivalent of what `api/openapi.ts` is for
 * ChatGPT's Custom GPT Actions. See `docs/EXTERNAL_INTEGRATION.md` §
 * "Connecting Claude (remote MCP)".
 *
 * A thin JSON-RPC 2.0 / Streamable HTTP wrapper (hand-written against
 * modelcontextprotocol.io/specification/2025-11-25 — no `@modelcontextprotocol/sdk`
 * dependency, same reasoning `api/_openapiSpec.ts`'s header gives for not
 * adding a schema-validation dependency for one file). Every `tools/call`
 * builds a synthetic `Request` carrying the caller's own `Authorization`
 * header and calls `readTrainingContext` / `handlePlanAdjustments` — the
 * exact same functions `api/training-context.ts` / `api/plan-adjustments.ts`
 * already expose and test — in-process. That means zero duplicated
 * auth/validation logic: a missing or revoked token behaves through MCP
 * exactly the way it does through REST, because it is literally the same
 * code path.
 *
 * Deliberately stateless — no `Mcp-Session-Id` is ever issued (spec: a
 * server "MAY assign" one; every tool call here is already self-contained
 * via its own bearer token, so there's nothing to key a session on).
 * `MCP-Protocol-Version` is not enforced: this server has no version-gated
 * behavior, so `initialize` just echoes back whatever `protocolVersion` the
 * client asked for. `Origin` is not validated either — that mitigation
 * targets localhost-bound servers reachable from a browser via DNS
 * rebinding; this is an internet-hosted, bearer-token-authenticated API,
 * not a local one.
 */
import { readTrainingContext } from "./training-context.js";
import { handlePlanAdjustments } from "./plan-adjustments.js";
import { mcpTools } from "./_mcpTools.js";

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

const SERVER_INFO = { name: "stack-training", version: "1.0.0" };
const DEFAULT_PROTOCOL_VERSION = "2025-06-18";

function json(status: number, body: object | null, extra?: HeadersInit): Response {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0" as const, id, result };
}

function rpcError(id: string | number | null, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id, error: { code, message } };
}

interface ToolResult {
  content: { type: "text"; text: string }[];
  isError?: boolean;
}

/** Turns a REST route's Response into an MCP tool result — success and failure alike are just its body, verbatim. */
async function toolResultFrom(response: Response): Promise<ToolResult> {
  const text = await response.text();
  return response.ok ? { content: [{ type: "text", text }] } : { content: [{ type: "text", text }], isError: true };
}

function authHeaders(authHeader: string | null): HeadersInit {
  return authHeader ? { Authorization: authHeader } : {};
}

async function getTrainingContextTool(
  authHeader: string | null,
  env: Environment,
  fetcher: typeof fetch,
): Promise<ToolResult> {
  const request = new Request("https://mcp.invalid/api/training-context", {
    method: "GET",
    headers: authHeaders(authHeader),
  });
  return toolResultFrom(await readTrainingContext(request, env, fetcher));
}

async function applyPlanAdjustmentTool(
  args: unknown,
  authHeader: string | null,
  env: Environment,
  fetcher: typeof fetch,
): Promise<ToolResult> {
  const request = new Request("https://mcp.invalid/api/plan-adjustments", {
    method: "POST",
    headers: { ...authHeaders(authHeader), "Content-Type": "application/json" },
    body: JSON.stringify(isRecord(args) ? args : {}),
  });
  return toolResultFrom(await handlePlanAdjustments(request, env, fetcher));
}

async function undoPlanAdjustmentTool(
  args: unknown,
  authHeader: string | null,
  env: Environment,
  fetcher: typeof fetch,
): Promise<ToolResult> {
  const adjustmentId = isRecord(args) && typeof args.adjustmentId === "string" ? args.adjustmentId : "";
  // A missing/empty id is left off the URL entirely rather than sent as
  // "?id=undefined", so the REST route's own "Expected ?id=..." 400 fires.
  const query = adjustmentId ? `?id=${encodeURIComponent(adjustmentId)}` : "";
  const request = new Request(`https://mcp.invalid/api/plan-adjustments${query}`, {
    method: "DELETE",
    headers: authHeaders(authHeader),
  });
  return toolResultFrom(await handlePlanAdjustments(request, env, fetcher));
}

/** Returns null for an unrecognized tool name, so the caller can raise the JSON-RPC error itself. */
async function callTool(
  name: string,
  args: unknown,
  authHeader: string | null,
  env: Environment,
  fetcher: typeof fetch,
): Promise<ToolResult | null> {
  switch (name) {
    case "get_training_context":
      return getTrainingContextTool(authHeader, env, fetcher);
    case "apply_plan_adjustment":
      return applyPlanAdjustmentTool(args, authHeader, env, fetcher);
    case "undo_plan_adjustment":
      return undoPlanAdjustmentTool(args, authHeader, env, fetcher);
    default:
      return null;
  }
}

/** One JSON-RPC message in, either a JSON-RPC response body or (for a notification) `null`. */
async function dispatch(
  message: Record<string, unknown>,
  authHeader: string | null,
  env: Environment,
  fetcher: typeof fetch,
): Promise<{ status: number; body: object | null }> {
  const hasId = "id" in message && message.id !== undefined;
  const id = hasId ? (message.id as string | number) : null;
  const method = message.method;

  if (typeof method !== "string") {
    return hasId
      ? { status: 200, body: rpcError(id, -32600, 'Invalid Request: "method" must be a string.') }
      : { status: 400, body: null };
  }

  if (!hasId) {
    // A notification (e.g. notifications/initialized) — this server is
    // stateless, so there's nothing to react to; every notification is
    // simply accepted.
    return { status: 202, body: null };
  }

  switch (method) {
    case "initialize": {
      const params = isRecord(message.params) ? message.params : {};
      const protocolVersion = typeof params.protocolVersion === "string" ? params.protocolVersion : DEFAULT_PROTOCOL_VERSION;
      return {
        status: 200,
        body: rpcResult(id, { protocolVersion, capabilities: { tools: {} }, serverInfo: SERVER_INFO }),
      };
    }
    case "ping":
      return { status: 200, body: rpcResult(id, {}) };
    case "tools/list":
      return { status: 200, body: rpcResult(id, { tools: mcpTools }) };
    case "tools/call": {
      const params = isRecord(message.params) ? message.params : {};
      const toolName = typeof params.name === "string" ? params.name : null;
      if (!toolName) return { status: 200, body: rpcError(id, -32602, '"params.name" must be a string.') };
      const result = await callTool(toolName, params.arguments, authHeader, env, fetcher);
      if (!result) return { status: 200, body: rpcError(id, -32602, `Unknown tool: "${toolName}".`) };
      return { status: 200, body: rpcResult(id, result) };
    }
    default:
      return { status: 200, body: rpcError(id, -32601, `Unknown method: "${method}".`) };
  }
}

export async function handleMcpRequest(
  request: Request,
  env: Environment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<Response> {
  if (request.method !== "POST") {
    return json(
      405,
      { error: "method_not_allowed", message: "STACK MCP server: deployed and ready. It answers POST only — no server-initiated streaming." },
      { Allow: "POST" },
    );
  }

  let parsed: unknown;
  try {
    parsed = await request.json();
  } catch {
    return json(400, rpcError(null, -32700, "Parse error: request body must be JSON."));
  }
  if (!isRecord(parsed)) {
    return json(400, rpcError(null, -32600, "Invalid Request: body must be a JSON-RPC object."));
  }

  const outcome = await dispatch(parsed, request.headers.get("Authorization"), env, fetcher);
  return json(outcome.status, outcome.body);
}

/** Mirrors `api/plan-adjustments.ts`'s Node request/response shim exactly. */
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
  if (!isNodeResponse(second)) return handleMcpRequest(first as Request);

  const request = first as NodeRequest;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }

  const response = await handleMcpRequest(
    new Request(`https://reader.invalid${request.url ?? "/api/mcp"}`, {
      method: request.method ?? "POST",
      headers,
      body: request.method === "POST" ? JSON.stringify(request.body ?? {}) : undefined,
    }),
  );

  second.statusCode = response.status;
  response.headers.forEach((value, name) => second.setHeader(name, value));
  second.end(await response.text());
}
