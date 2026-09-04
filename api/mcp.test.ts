import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { handleMcp } from "./mcp.js";

/**
 * The connector over the *real* STACK routes — `src/external/mcpServer.test.ts`
 * stubs them out, this file does not. Only Supabase itself is faked, at the
 * same `fetch` seam `api/training-context.test.ts` and
 * `api/plan-adjustments.test.ts` already use, so every assertion below travels
 * the whole path an assistant's call actually takes: MCP framing → the REST
 * handler → the RPC contract, and the answer all the way back.
 *
 * That is what makes these the acceptance tests for #181's security claims:
 * scope, revocation and stale-plan conflicts are not re-implemented here to be
 * checked here — they are observed surviving the new layer unchanged.
 */
declare const process: { env: Record<string, string | undefined> };

const ENV = {
  VERCEL_ENV: "preview",
  VITE_STACK_BACKEND_ENV: "preview",
  VITE_SUPABASE_URL: "https://plpooikvofzytbpsbzki.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
};

const PLAN = {
  schemaVersion: 1,
  id: "test-plan",
  name: "Test Plan",
  race: { name: "Test Race", date: "2026-12-05", distanceMiles: 13.1, goal: { type: "none" } },
  startDate: "2026-01-01",
  endDate: "2026-12-05",
  notes: [],
  revision: 1,
  originalPlan: null,
  weeks: [
    {
      weekNumber: 1, phase: "base", startDate: "2026-07-13", endDate: "2026-07-19",
      workouts: [{
        id: "w-past", date: "2026-07-15", weekNumber: 1, phase: "base", type: "easy",
        title: "Old past title", targetDistanceMiles: "3", details: "",
        build: { renders: true, weekRow: 1, orderInWeek: 1, span: 1, colorKey: "easy" },
      }],
    },
    {
      weekNumber: 2, phase: "build", startDate: "2026-08-03", endDate: "2026-08-09",
      workouts: [{
        id: "w-future", date: "2026-08-06", weekNumber: 2, phase: "build", type: "easy",
        title: "Old future title", targetDistanceMiles: "4", details: "",
        build: { renders: true, weekRow: 2, orderInWeek: 1, span: 1, colorKey: "easy" },
      }],
    },
  ],
};

const rawTraining = {
  settings: { units: "miles", theme: "dark" },
  plan: PLAN,
  plan_history: [],
  race_setup: null,
  availability: null,
  run_days: null,
  cross_training_days: null,
  revision: 1,
  account_generation: 1,
};

const snapshot = {
  training: rawTraining,
  runs: [],
  build: { placements: [], revision: 1 },
  intervals: {
    last_successful_activity_sync_at: null,
    ignored_activity_ids: [],
    pending_candidates: [],
    revision: 1,
  },
  crew: [],
  planAdjustments: [
    {
      adjustmentId: "adj-earlier",
      appliedAt: "2026-07-30T09:00:00Z",
      kind: "apply",
      operations: [{ op: "skip", workoutId: "w-gone" }],
      reason: null,
      reverted: false,
    },
  ],
};

/** Responds with each Response in order, one per upstream call. */
function upstream(...responses: Response[]) {
  let index = 0;
  return vi.fn<typeof fetch>(async () => responses[Math.min(index++, responses.length - 1)]!);
}

function post(body: unknown, headers: Record<string, string> = { Authorization: "Bearer a-real-looking-token" }): Request {
  return new Request("https://stack.test/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const toolCall = (name: string, args: Record<string, unknown> = {}) => ({
  jsonrpc: "2.0",
  id: 9,
  method: "tools/call",
  params: { name, arguments: args },
});

async function resultOf(response: Response): Promise<{ text: string; isError: boolean }> {
  const body = await response.json();
  const result = body.result as { content: { text: string }[]; isError?: boolean };
  return { text: result.content[0]!.text, isError: result.isError === true };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-01T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("MCP endpoint — transport", () => {
  it("answers POST only, and opens no server-initiated stream", async () => {
    const response = await handleMcp(new Request("https://stack.test/api/mcp"), ENV);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST, OPTIONS");
  });

  it("answers the CORS preflight without requiring a token", async () => {
    const response = await handleMcp(new Request("https://stack.test/api/mcp", { method: "OPTIONS" }), ENV);
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("fails a connector set up with no token at all, before any JSON-RPC work", async () => {
    const fetcher = upstream(new Response("{}"));
    const response = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "initialize" }, {}), ENV, fetcher);
    expect(response.status).toBe(401);
    expect(response.headers.get("WWW-Authenticate")).toMatch(/^Bearer/);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("tells a runner who has no token where the token actually goes", async () => {
    const response = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "initialize" }, {}), ENV);
    const body = await response.json();
    expect(body.error.message).toMatch(/connector setup/);
    expect(body.error.message).toMatch(/never in a chat message/);
  });

  it("reports an unparseable body as a JSON-RPC parse error", async () => {
    const response = await handleMcp(
      new Request("https://stack.test/api/mcp", {
        method: "POST",
        headers: { Authorization: "Bearer t" },
        body: "not json",
      }),
      ENV,
    );
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe(-32700);
  });

  it("answers a notification-only body with an empty 202", async () => {
    const response = await handleMcp(post({ jsonrpc: "2.0", method: "notifications/initialized" }), ENV);
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
  });

  it("initializes without touching STACK's database", async () => {
    const fetcher = upstream(new Response("{}"));
    const response = await handleMcp(post({ jsonrpc: "2.0", id: 1, method: "initialize" }), ENV, fetcher);
    expect(response.status).toBe(200);
    expect((await response.json()).result.serverInfo.name).toBe("stack");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("works through the Node request/response shim too", async () => {
    process.env = { ...ENV };
    const sent: { status?: number; body?: string } = {};
    await handler(
      { method: "POST", url: "/api/mcp", headers: { authorization: "Bearer t" }, body: { jsonrpc: "2.0", id: 1, method: "ping" } },
      {
        statusCode: 0,
        setHeader: () => {},
        end: (body?: string) => {
          sent.body = body;
        },
      },
    );
    expect(JSON.parse(sent.body ?? "{}").result).toEqual({});
    process.env = {};
  });
});

describe("MCP endpoint — reading a runner's own training context", () => {
  it("returns this runner's context, resolved only from their token", async () => {
    const fetcher = upstream(new Response(JSON.stringify(snapshot)));
    const response = await handleMcp(post(toolCall("get_training_context")), ENV, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(false);
    const context = JSON.parse(text);
    expect(context.plan.name).toBe("Test Plan");
    expect(context.plan.revision).toBe(1);
    expect(context.plan.upcomingWorkouts[0].id).toBe("w-future");

    // The connector never names an account: the token hash is the only
    // identity that crosses to the database, exactly as it was before.
    const sentBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(Object.keys(sentBody)).toEqual(["p_token_hash"]);
  });

  it("carries the adjustment ids an undo needs into a brand-new conversation", async () => {
    const fetcher = upstream(new Response(JSON.stringify(snapshot)));
    const response = await handleMcp(post(toolCall("get_training_context")), ENV, fetcher);
    const context = JSON.parse((await resultOf(response)).text);
    expect(context.planAdjustments[0].adjustmentId).toBe("adj-earlier");
  });

  it("withholds free-text notes and provider identity, as the read boundary always did", async () => {
    const withRun = {
      ...snapshot,
      runs: [{
        run_id: "run-1", workout_id: null, completed_date: "2026-07-30", activity_type: "long",
        distance_miles: 8, duration_seconds: 4200, effort: "great", notes: "a private reflection",
        source: "intervals", external_provider: "intervals", external_activity_id: "external-activity-id",
        external_source_updated_at: null, external_imported_at: "2026-07-30T12:00:00Z",
        imported_metrics: { averageHeartRate: 155 }, legacy_aliases: [], revision: 1, deleted_at: null,
        created_at: "2026-07-30T12:00:00Z", updated_at: "2026-07-30T12:00:00Z", manual_heart_rate: null,
      }],
    };
    const response = await handleMcp(
      post(toolCall("get_training_context")),
      ENV,
      upstream(new Response(JSON.stringify(withRun))),
    );
    const { text } = await resultOf(response);
    expect(text).not.toMatch(/a private reflection/);
    expect(text).not.toMatch(/external-activity-id/);
  });

  it("reports a revoked token as a tool failure the assistant can explain, reading nothing", async () => {
    const response = await handleMcp(
      post(toolCall("get_training_context")),
      ENV,
      upstream(new Response(JSON.stringify({ message: "token_invalid_or_revoked" }), { status: 400 })),
    );
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(true);
    expect(text).toMatch(/no longer authorized/);
    expect(text).not.toMatch(/Test Plan/);
  });

  it("stays honestly empty for an account that has never synced", async () => {
    const response = await handleMcp(
      post(toolCall("get_training_context")),
      ENV,
      upstream(new Response("null")),
    );
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(false);
    expect(JSON.parse(text).plan).toBeNull();
  });

  it("refuses to answer at all when the deployment is unconfigured", async () => {
    const fetcher = upstream(new Response("{}"));
    const response = await handleMcp(post(toolCall("get_training_context")), {}, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(true);
    expect(text).toMatch(/not_configured/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("MCP endpoint — adjusting the plan", () => {
  const adjust = toolCall("adjust_training_plan", {
    operations: [{ op: "editRun", workoutId: "w-future", values: { type: "easy", title: "New title", targetDistanceMiles: "4", details: "" } }],
    expectedPlanRevision: 1,
    reason: "felt flat",
  });

  it("applies an eligible future change through the existing atomic contract", async () => {
    const fetcher = upstream(
      new Response(JSON.stringify(snapshot)),
      new Response(JSON.stringify({ adjustmentId: "adj-1", plan: { ...PLAN, revision: 2 }, revision: 2 })),
    );
    const response = await handleMcp(post(adjust), ENV, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(false);
    expect(JSON.parse(text)).toMatchObject({ adjustmentId: "adj-1", revision: 2 });

    // Same RPC, same arguments the REST client would have sent — the
    // connector composed nothing of its own.
    const applyBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(String(fetcher.mock.calls[1]?.[0])).toMatch(/rpc\/apply_plan_patch$/);
    expect(applyBody.p_expected_plan_revision).toBe(1);
    expect(applyBody.p_reason).toBe("felt flat");
  });

  it("cannot make a plan change on a read-only connection", async () => {
    const fetcher = upstream(
      new Response(JSON.stringify(snapshot)),
      new Response(JSON.stringify({ message: "token_scope_insufficient" }), { status: 400 }),
    );
    const response = await handleMcp(post(adjust), ENV, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(true);
    expect(text).toMatch(/read-only/);
    expect(text).toMatch(/insufficient_scope/);
  });

  it("rejects a stale plan revision without ever calling the write RPC", async () => {
    const stale = toolCall("adjust_training_plan", {
      operations: [{ op: "skip", workoutId: "w-future" }],
      expectedPlanRevision: 99,
    });
    const fetcher = upstream(new Response(JSON.stringify(snapshot)));
    const response = await handleMcp(post(stale), ENV, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(true);
    expect(text).toMatch(/plan_changed/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("cannot touch a workout that already happened", async () => {
    const past = toolCall("adjust_training_plan", {
      operations: [{ op: "skip", workoutId: "w-past" }],
      expectedPlanRevision: 1,
    });
    const fetcher = upstream(new Response(JSON.stringify(snapshot)));
    const response = await handleMcp(post(past), ENV, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(true);
    expect(text).toMatch(/invalid_operation/);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects a malformed operation as an invalid request, not as a plan change", async () => {
    const malformed = toolCall("adjust_training_plan", {
      operations: [{ op: "teleport", workoutId: "w-future" }],
      expectedPlanRevision: 1,
    });
    const fetcher = upstream(new Response(JSON.stringify(snapshot)));
    const response = await handleMcp(post(malformed), ENV, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(true);
    expect(text).toMatch(/invalid_request/);
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("MCP endpoint — undoing an adjustment", () => {
  it("undoes exactly the adjustment it was given", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ plan: { ...PLAN, revision: 3 }, revision: 3 })));
    const response = await handleMcp(post(toolCall("undo_plan_adjustment", { adjustmentId: "adj-1" })), ENV, fetcher);
    const { text, isError } = await resultOf(response);
    expect(isError).toBe(false);
    expect(JSON.parse(text).revision).toBe(3);
    const undoBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(String(fetcher.mock.calls[0]?.[0])).toMatch(/rpc\/undo_plan_patch$/);
    expect(undoBody.p_adjustment_id).toBe("adj-1");
  });

  it("reports an unknown adjustment id as not found", async () => {
    const response = await handleMcp(
      post(toolCall("undo_plan_adjustment", { adjustmentId: "nope" })),
      ENV,
      upstream(new Response(JSON.stringify({ message: "plan_adjustment_not_found" }), { status: 400 })),
    );
    expect((await resultOf(response)).text).toMatch(/not_found/);
  });

  it("reports an already-undone adjustment as not undoable", async () => {
    const response = await handleMcp(
      post(toolCall("undo_plan_adjustment", { adjustmentId: "adj-1" })),
      ENV,
      upstream(new Response(JSON.stringify({ message: "plan_adjustment_already_reverted" }), { status: 400 })),
    );
    expect((await resultOf(response)).text).toMatch(/not_undoable/);
  });

  it("cannot undo on a read-only connection", async () => {
    const response = await handleMcp(
      post(toolCall("undo_plan_adjustment", { adjustmentId: "adj-1" })),
      ENV,
      upstream(new Response(JSON.stringify({ message: "token_scope_insufficient" }), { status: 400 })),
    );
    expect((await resultOf(response)).text).toMatch(/insufficient_scope/);
  });
});
