import { describe, expect, it, vi } from "vitest";
import handler, { handleMcpRequest } from "./mcp.js";

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
      weekNumber: 2, phase: "build", startDate: "2026-09-07", endDate: "2026-09-13",
      workouts: [{
        id: "w-future", date: "2026-09-10", weekNumber: 2, phase: "build", type: "easy",
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

function request(body: unknown, { headers = { Authorization: "Bearer a-real-looking-token" }, method = "POST" }: { headers?: Record<string, string>; method?: string } = {}) {
  return new Request("https://stack.test/api/mcp", {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
  });
}

const rpc = (method: string, params?: unknown, id: number | string = 1) => ({ jsonrpc: "2.0", id, method, params });
const notification = (method: string, params?: unknown) => ({ jsonrpc: "2.0", method, params });

/** Responds with each Response in order, one per upstream call. */
function upstream(...responses: Response[]) {
  let call = 0;
  return vi.fn<typeof fetch>(async () => responses[Math.min(call++, responses.length - 1)]!);
}

describe("MCP server — transport", () => {
  it("answers 405 for GET", async () => {
    const response = await handleMcpRequest(request(undefined, { method: "GET" }), ENV);
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
  });

  it("answers 405 for DELETE", async () => {
    const response = await handleMcpRequest(request(undefined, { method: "DELETE" }), ENV);
    expect(response.status).toBe(405);
  });

  it("rejects a malformed JSON body with a JSON-RPC parse error", async () => {
    const response = await handleMcpRequest(request("not json"), ENV);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe(-32700);
  });

  it("rejects a non-object JSON-RPC body", async () => {
    const response = await handleMcpRequest(request("42"), ENV);
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.code).toBe(-32600);
  });

  it("the default handler answers a plain Request the same way", async () => {
    const response = (await handler(request(rpc("ping")))) as Response;
    expect(response.status).toBe(200);
    expect((await response.json()).result).toEqual({});
  });
});

describe("MCP server — lifecycle", () => {
  it("initialize echoes the requested protocolVersion and advertises tools", async () => {
    const response = await handleMcpRequest(request(rpc("initialize", { protocolVersion: "2025-11-25" })), ENV);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.result.protocolVersion).toBe("2025-11-25");
    expect(body.result.capabilities).toEqual({ tools: {} });
    expect(body.result.serverInfo.name).toBeTruthy();
  });

  it("initialize with no protocolVersion falls back to a default", async () => {
    const response = await handleMcpRequest(request(rpc("initialize", {})), ENV);
    const body = await response.json();
    expect(typeof body.result.protocolVersion).toBe("string");
  });

  it("notifications/initialized (no id) is accepted with 202 and no body", async () => {
    const response = await handleMcpRequest(request(notification("notifications/initialized")), ENV);
    expect(response.status).toBe(202);
    expect(await response.text()).toBe("");
  });

  it("tools/list returns the 3 tools", async () => {
    const response = await handleMcpRequest(request(rpc("tools/list")), ENV);
    const body = await response.json();
    expect(body.result.tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "apply_plan_adjustment",
      "get_training_context",
      "undo_plan_adjustment",
    ]);
  });

  it("an unknown method returns a JSON-RPC method-not-found error", async () => {
    const response = await handleMcpRequest(request(rpc("not/a/real/method")), ENV);
    const body = await response.json();
    expect(body.error.code).toBe(-32601);
  });

  it("tools/call with an unknown tool name returns a JSON-RPC invalid-params error", async () => {
    const response = await handleMcpRequest(request(rpc("tools/call", { name: "not_a_real_tool", arguments: {} })), ENV);
    const body = await response.json();
    expect(body.error.code).toBe(-32602);
  });
});

describe("MCP server — tools/call proxies to the real REST handlers", () => {
  it("get_training_context proxies to readTrainingContext and surfaces its JSON as tool content", async () => {
    const fetcher = upstream(new Response(JSON.stringify(null)));
    const response = await handleMcpRequest(
      request(rpc("tools/call", { name: "get_training_context", arguments: {} })),
      ENV,
      fetcher,
    );
    const body = await response.json();
    expect(body.result.isError).toBeUndefined();
    const context = JSON.parse(body.result.content[0].text);
    expect(context.plan).toBeNull();
    expect(Array.isArray(context.recentRuns)).toBe(true);
  });

  it("get_training_context with no Authorization header surfaces the REST 401 as an MCP tool error, without calling upstream", async () => {
    const fetcher = upstream(new Response(JSON.stringify(null)));
    const response = await handleMcpRequest(
      request(rpc("tools/call", { name: "get_training_context", arguments: {} }), { headers: {} }),
      ENV,
      fetcher,
    );
    const body = await response.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("unauthorized");
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("apply_plan_adjustment proxies to handlePlanAdjustments end to end", async () => {
    const newPlan = { ...PLAN, revision: 2 };
    const fetcher = upstream(
      new Response(JSON.stringify({ training: rawTraining })),
      new Response(JSON.stringify({ adjustmentId: "adj-1", plan: newPlan, revision: 2 })),
    );
    const response = await handleMcpRequest(
      request(
        rpc("tools/call", {
          name: "apply_plan_adjustment",
          arguments: {
            operations: [{ op: "skip", workoutId: "w-future" }],
            expectedPlanRevision: 1,
          },
        }),
      ),
      ENV,
      fetcher,
    );
    const body = await response.json();
    expect(body.result.isError).toBeUndefined();
    const applied = JSON.parse(body.result.content[0].text);
    expect(applied.adjustmentId).toBe("adj-1");
    expect(applied.revision).toBe(2);
  });

  it("apply_plan_adjustment with a stale revision surfaces the REST 409 as an MCP tool error", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ training: rawTraining })));
    const response = await handleMcpRequest(
      request(
        rpc("tools/call", {
          name: "apply_plan_adjustment",
          arguments: { operations: [{ op: "skip", workoutId: "w-future" }], expectedPlanRevision: 99 },
        }),
      ),
      ENV,
      fetcher,
    );
    const body = await response.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("plan_changed");
  });

  it("undo_plan_adjustment proxies to handlePlanAdjustments' DELETE path", async () => {
    const restoredPlan = { ...PLAN, revision: 3 };
    const fetcher = upstream(new Response(JSON.stringify({ plan: restoredPlan, revision: 3 })));
    const response = await handleMcpRequest(
      request(rpc("tools/call", { name: "undo_plan_adjustment", arguments: { adjustmentId: "adj-1" } })),
      ENV,
      fetcher,
    );
    const body = await response.json();
    expect(body.result.isError).toBeUndefined();
    const undone = JSON.parse(body.result.content[0].text);
    expect(undone.revision).toBe(3);
    const [, init] = fetcher.mock.calls[0]!;
    expect(JSON.parse(String(init?.body)).p_adjustment_id).toBe("adj-1");
  });

  it("undo_plan_adjustment with a missing adjustmentId surfaces the REST 400, without calling upstream", async () => {
    const fetcher = upstream(new Response(JSON.stringify({})));
    const response = await handleMcpRequest(
      request(rpc("tools/call", { name: "undo_plan_adjustment", arguments: {} })),
      ENV,
      fetcher,
    );
    const body = await response.json();
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain("invalid_request");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
