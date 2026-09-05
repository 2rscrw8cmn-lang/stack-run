/**
 * Evolution 2.10D (#181): the provider-neutral connector layer that finally
 * makes STACK *connectable*, rather than merely callable.
 *
 * #178/#180 built the REST contracts and #183 proved them over real HTTP, but
 * an ordinary ChatGPT or Claude conversation has no mechanism to send an HTTP
 * request — so a runner holding a valid token still had nothing to connect.
 * The thing those assistants *can* consume is a remote MCP server: a URL the
 * runner registers once in the assistant's connector settings, which the
 * assistant then calls on their behalf.
 *
 * This module is that server's brain, and deliberately nothing else. It speaks
 * JSON-RPC 2.0 and MCP framing, and translates three semantic tools onto the
 * existing REST contracts through the `StackExternalApi` seam below. It holds
 * no plan logic, no auth logic, and no database access of its own: every
 * decision about what a token may read or write is still made where it was
 * made before — in `api/training-context.ts`, `api/plan-adjustments.ts` and,
 * authoritatively, in SQL. If this file were deleted, nothing about STACK's
 * security posture would change, which is the point.
 *
 * Transport lives in `api/mcp.ts`. See docs/EXTERNAL_INTEGRATION.md.
 */

/** What a STACK REST route answered: its HTTP status and parsed JSON body. */
export interface StackApiResult {
  status: number;
  body: unknown;
}

/**
 * The one seam between this connector and STACK proper. `api/mcp.ts` implements
 * it by calling the existing route handlers in-process with the caller's own
 * bearer token; tests implement it with a stub. Nothing else about STACK is
 * reachable from here — this interface *is* the connector's entire capability.
 */
export interface StackExternalApi {
  getTrainingContext(): Promise<StackApiResult>;
  applyPlanAdjustment(input: PlanAdjustmentInput): Promise<StackApiResult>;
  undoPlanAdjustment(adjustmentId: string): Promise<StackApiResult>;
}

/** Exactly the three fields `POST /api/plan-adjustments` accepts — never a spread. */
export interface PlanAdjustmentInput {
  operations: unknown;
  expectedPlanRevision: unknown;
  reason: string | null;
}

export type JsonRpcId = string | number | null;

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: JsonRpcId;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

/**
 * Protocol revisions this server understands. The client names one at
 * `initialize`; anything unrecognized is answered with the newest we speak,
 * which is what the spec asks for rather than a hard failure.
 */
export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0];

export const STACK_MCP_SERVER_NAME = "stack";
export const STACK_MCP_SERVER_VERSION = "1.0.0";

/** JSON-RPC 2.0 reserved codes. Domain failures are never reported through these. */
const PARSE_ERROR = -32700;
const INVALID_REQUEST = -32600;
const METHOD_NOT_FOUND = -32601;
const INVALID_PARAMS = -32602;

const SERVER_INSTRUCTIONS = [
  "STACK is the runner's training app and the source of truth for their plan, their actual run history and their Build progress.",
  "Read `get_training_context` before reasoning about training — it carries the active plan, the workout ids and `plan.revision` that the write tools require, recent runs, Training Signals and recent plan-adjustment history.",
  "`adjust_training_plan` changes future planned intent only. It can never touch a past workout, a logged run, Build, or the race goal, and it requires the runner to have granted read & write access.",
  "Adjustments belong to the runner: propose the change in conversation and let them agree before calling a write tool.",
].join(" ");

/**
 * `move` / `editRun` / `addRun` / `skip`, described in one schema rather than a
 * `oneOf`: the REST layer validates each op's real shape and answers with a
 * precise `invalid_request`, and a single flat object is the shape every MCP
 * client's schema handling copes with reliably.
 */
const OPERATION_SCHEMA = {
  type: "object",
  properties: {
    op: {
      type: "string",
      enum: ["move", "editRun", "addRun", "skip"],
      description:
        "move: reschedule an existing future workout to another date. editRun: replace a future workout's type/title/distance/details. addRun: add a new run on the date named by an existing future workout. skip: remove a future workout from the plan.",
    },
    workoutId: {
      type: "string",
      description:
        "The `id` of a workout from `get_training_context` — `plan.nextScheduledWorkout.id` or an entry in `plan.upcomingWorkouts`. Never a title or a date.",
    },
    toDate: {
      type: "string",
      description: "`move` only. The new date, as YYYY-MM-DD. Must be in the future.",
    },
    values: {
      type: "object",
      description: "`editRun` and `addRun` only. The complete replacement values for the workout.",
      properties: {
        type: {
          type: "string",
          enum: ["easy", "intervals", "simulation", "long", "race", "cross"],
        },
        title: { type: "string" },
        targetDistanceMiles: {
          type: ["string", "null"],
          description: "Miles as a decimal string, e.g. \"6.5\", or null when the workout has no distance target.",
        },
        details: { type: "string" },
      },
      required: ["type", "title", "targetDistanceMiles", "details"],
    },
  },
  required: ["op", "workoutId"],
} as const;

/**
 * Semantic tools, not database primitives (#181). Each maps onto exactly one
 * existing STACK contract; none of them exposes a table, a row, or another
 * runner's anything.
 */
export const STACK_MCP_TOOLS = [
  {
    name: "get_training_context",
    title: "Read STACK training context",
    description:
      "Read this runner's own current STACK training context: their active plan with upcoming workout ids and the plan revision, their race goal, recent actual runs, Build progress, Training Signals, their own Crew membership summary, and recent plan adjustments. Read-only. Returns an honestly empty context when the runner has no active plan.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  {
    name: "adjust_training_plan",
    title: "Adjust future planned workouts",
    description:
      "Apply one atomic set of adjustments to this runner's *future* planned workouts. Requires a read & write STACK connection. Read `get_training_context` first: every operation names a workout by the `id` found there, and `expectedPlanRevision` must be the `plan.revision` seen in that same read, so a plan the runner changed meanwhile is rejected rather than overwritten. Cannot change past workouts, logged runs, Build, or the race goal. Every adjustment is recorded in STACK and can be undone.",
    inputSchema: {
      type: "object",
      properties: {
        operations: {
          type: "array",
          minItems: 1,
          description: "The adjustments to apply together. All succeed or none do.",
          items: OPERATION_SCHEMA,
        },
        expectedPlanRevision: {
          type: "integer",
          description: "`plan.revision` from the `get_training_context` read these operations were built from.",
        },
        reason: {
          type: "string",
          description: "Optional short note shown to the runner in STACK's adjustment history.",
        },
      },
      required: ["operations", "expectedPlanRevision"],
      additionalProperties: false,
    },
    // Destructive despite being undoable: `skip` removes a planned workout
    // and `editRun` replaces one outright, so a client that gates on this
    // hint should gate on these.
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
  {
    name: "undo_plan_adjustment",
    title: "Undo one prior plan adjustment",
    description:
      "Undo exactly one prior plan adjustment, restoring the workouts it changed. Requires a read & write STACK connection. The id comes from an earlier `adjust_training_plan` result or from `planAdjustments[].adjustmentId` in `get_training_context`. Fails if the runner has since changed those workouts themselves — their own edit always wins.",
    inputSchema: {
      type: "object",
      properties: {
        adjustmentId: {
          type: "string",
          description: "`adjustmentId` of the adjustment to undo.",
        },
      },
      required: ["adjustmentId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false },
  },
] as const;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function result(id: JsonRpcId, value: unknown): JsonRpcResponse {
  return { jsonrpc: "2.0", id, result: value };
}

function failure(id: JsonRpcId, code: number, message: string): JsonRpcResponse {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

/** A tool outcome the model is meant to read and react to, not a transport failure. */
function toolText(text: string, isError = false): { content: { type: "text"; text: string }[]; isError?: boolean } {
  return isError ? { content: [{ type: "text", text }], isError: true } : { content: [{ type: "text", text }] };
}

/**
 * Turns a non-2xx STACK response into something a model can act on.
 *
 * The wording STACK's REST layer already chose is preserved verbatim — it was
 * written to be honest without leaking (`401` never says *why* a token failed,
 * `409 plan_changed` never says *which* invariant a patch violated). What this
 * adds is the one thing a machine caller needs and a human reading the docs
 * already had: what to do next.
 */
function stackErrorText(status: number, body: unknown): string {
  const row = record(body);
  const code = typeof row?.error === "string" ? row.error : "request_failed";
  const message = typeof row?.message === "string" ? row.message : `STACK answered ${status}.`;
  const guidance = NEXT_STEP[code];
  return `${message}${guidance ? ` ${guidance}` : ""} (STACK error: ${code})`;
}

const NEXT_STEP: Record<string, string> = {
  unauthorized:
    "This STACK connection is no longer authorized — the runner revoked it, or it was never set up correctly. Ask them to reconnect STACK from their assistant's connector settings; do not ask them for the token in conversation.",
  insufficient_scope:
    "This connection was created read-only. If the runner wants their assistant to change the plan, they create a new read & write connection in STACK under Settings → Account & Crew → External Assistant Access, and update the connector with it.",
  plan_changed:
    "Call `get_training_context` again to read the current `plan.revision` and the current workouts, then rebuild the request from what you find.",
  no_active_plan: "The runner has no active plan in STACK, so there is nothing to adjust yet.",
  invalid_operation: "Re-read the workout ids from `get_training_context`; only future, non-race workouts can be adjusted.",
  invalid_request: "Rebuild the arguments to match this tool's input schema.",
  not_found: "That adjustment id does not exist for this runner. Read `planAdjustments` from `get_training_context` for the current ids.",
  not_undoable: "That adjustment was already undone.",
  upstream_unavailable: "This is a STACK-side outage, not a problem with the request. Do not retry immediately, and do not assume whether a write landed — re-read `plan.revision` to find out.",
  upstream_timeout: "This is a STACK-side timeout, not a problem with the request. Do not assume whether a write landed — re-read `plan.revision` to find out.",
  not_configured: "STACK's external integration is not configured on this deployment. Nothing the runner does in conversation can fix it.",
};

function callResult(outcome: StackApiResult): unknown {
  return outcome.status >= 200 && outcome.status < 300
    ? toolText(JSON.stringify(outcome.body))
    : toolText(stackErrorText(outcome.status, outcome.body), true);
}

async function callTool(id: JsonRpcId, params: unknown, api: StackExternalApi): Promise<JsonRpcResponse> {
  const row = record(params);
  const name = typeof row?.name === "string" ? row.name : null;
  const args = record(row?.arguments) ?? {};

  switch (name) {
    case "get_training_context":
      return result(id, callResult(await api.getTrainingContext()));

    case "adjust_training_plan": {
      // Only the three documented fields cross this boundary; the REST route
      // is what validates their shapes, and answers `400 invalid_request`
      // with a message this tool hands straight back to the model.
      const reason = typeof args.reason === "string" ? args.reason : null;
      return result(
        id,
        callResult(
          await api.applyPlanAdjustment({
            operations: args.operations,
            expectedPlanRevision: args.expectedPlanRevision,
            reason,
          }),
        ),
      );
    }

    case "undo_plan_adjustment": {
      const adjustmentId = typeof args.adjustmentId === "string" ? args.adjustmentId.trim() : "";
      if (!adjustmentId) {
        return result(id, toolText("`adjustmentId` is required, as a string.", true));
      }
      return result(id, callResult(await api.undoPlanAdjustment(adjustmentId)));
    }

    default:
      // Not a JSON-RPC error: an unknown tool name is a model mistake it can
      // recover from, and the spec asks for it to be reported in-band.
      return result(id, toolText(`STACK has no tool named "${name ?? ""}". Call tools/list to see what it offers.`, true));
  }
}

function initialize(id: JsonRpcId, params: unknown): JsonRpcResponse {
  const requested = record(params)?.protocolVersion;
  const protocolVersion =
    typeof requested === "string" && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
      ? requested
      : LATEST_PROTOCOL_VERSION;
  return result(id, {
    protocolVersion,
    capabilities: { tools: { listChanged: false } },
    serverInfo: { name: STACK_MCP_SERVER_NAME, title: "STACK", version: STACK_MCP_SERVER_VERSION },
    instructions: SERVER_INSTRUCTIONS,
  });
}

/**
 * Handles one JSON-RPC message. Returns `null` for a notification, which by
 * the JSON-RPC contract gets no response at all — the transport turns that
 * into an empty `202`.
 */
export async function handleMcpMessage(
  message: unknown,
  api: StackExternalApi,
): Promise<JsonRpcResponse | null> {
  const row = record(message);
  if (!row || row.jsonrpc !== "2.0" || typeof row.method !== "string") {
    return failure(null, INVALID_REQUEST, "Not a JSON-RPC 2.0 request.");
  }

  const notification = row.id === undefined || row.id === null;
  const id: JsonRpcId = typeof row.id === "string" || typeof row.id === "number" ? row.id : null;

  // A notification is fire-and-forget in both directions: `notifications/*`
  // and anything else sent without an id get no response, not even an error.
  if (notification) return null;

  switch (row.method) {
    case "initialize":
      return initialize(id, row.params);
    case "ping":
      return result(id, {});
    case "tools/list":
      return result(id, { tools: STACK_MCP_TOOLS });
    case "tools/call":
      return record(row.params)
        ? callTool(id, row.params, api)
        : failure(id, INVALID_PARAMS, "tools/call requires params with a tool name.");
    default:
      return failure(id, METHOD_NOT_FOUND, `STACK's connector does not implement "${row.method}".`);
  }
}

/**
 * Handles a whole request body — a single message, or the batch array the
 * 2025-03-26 revision allowed. Returns `null` when nothing needs answering.
 */
export async function handleMcpBody(
  body: unknown,
  api: StackExternalApi,
): Promise<JsonRpcResponse | JsonRpcResponse[] | null> {
  if (Array.isArray(body)) {
    if (body.length === 0) return failure(null, INVALID_REQUEST, "An empty batch is not a JSON-RPC request.");
    const responses: JsonRpcResponse[] = [];
    for (const message of body) {
      const response = await handleMcpMessage(message, api);
      if (response) responses.push(response);
    }
    return responses.length > 0 ? responses : null;
  }
  return handleMcpMessage(body, api);
}

/** The response for a body that was not JSON at all. */
export function mcpParseError(): JsonRpcResponse {
  return failure(null, PARSE_ERROR, "Request body was not valid JSON.");
}
