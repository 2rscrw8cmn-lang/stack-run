import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import handler, { handlePlanAdjustments } from "./plan-adjustments.js";

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
      weekNumber: 2, phase: "build", startDate: "2026-09-07", endDate: "2026-09-13",
      workouts: [{
        id: "w-future", date: "2026-09-10", weekNumber: 2, phase: "build", type: "easy",
        title: "Old future title", targetDistanceMiles: "4", details: "",
        build: { renders: true, weekRow: 2, orderInWeek: 1, span: 1, colorKey: "easy" },
      }],
    },
    {
      weekNumber: 18, phase: "taper", startDate: "2026-12-01", endDate: "2026-12-07",
      workouts: [{
        id: "w-race", date: "2026-12-05", weekNumber: 18, phase: "taper", type: "race",
        title: "Race Day", targetDistanceMiles: "13.1", details: "",
        build: { renders: true, weekRow: 18, orderInWeek: 1, span: 4, colorKey: "race" },
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

const request = (
  { headers = { Authorization: "Bearer a-real-looking-token" }, method = "POST", body, path = "/api/plan-adjustments" }:
    { headers?: Record<string, string>; method?: string; body?: unknown; path?: string } = {},
) =>
  new Request(`https://stack.test${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Responds with each Response in order, one per upstream call. */
function upstream(...responses: Response[]) {
  let call = 0;
  return vi.fn<typeof fetch>(async () => responses[Math.min(call++, responses.length - 1)]!);
}

const applyBody = {
  operations: [{ op: "editRun", workoutId: "w-future", values: { type: "easy", title: "New title", targetDistanceMiles: "4", details: "" } }],
  expectedPlanRevision: 1,
};

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-08-01T12:00:00"));
});

afterEach(() => {
  vi.useRealTimers();
});

describe("Plan adjustments endpoint — apply", () => {
  it("answers 405 for an unsupported method", async () => {
    const response = await handlePlanAdjustments(request({ method: "GET" }), ENV);
    expect(response.status).toBe(405);
  });

  it("refuses when unconfigured, without calling upstream", async () => {
    const fetcher = upstream(new Response("[]"));
    const response = await handlePlanAdjustments(request({ body: applyBody }), {}, fetcher);
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token, without calling upstream", async () => {
    const fetcher = upstream(new Response("[]"));
    const response = await handlePlanAdjustments(request({ headers: {}, body: applyBody }), ENV, fetcher);
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a malformed body", async () => {
    const response = await handlePlanAdjustments(
      new Request("https://stack.test/api/plan-adjustments", { method: "POST", headers: { Authorization: "Bearer t" }, body: "not json" }),
      ENV,
    );
    expect(response.status).toBe(400);
  });

  it("rejects a body missing operations or expectedPlanRevision", async () => {
    const response = await handlePlanAdjustments(request({ body: { operations: [] } }), ENV);
    expect(response.status).toBe(400);
  });

  it("fails fast on a stale expectedPlanRevision without calling apply_plan_patch", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ training: rawTraining })));
    const response = await handlePlanAdjustments(
      request({ body: { ...applyBody, expectedPlanRevision: 99 } }),
      ENV,
      fetcher,
    );
    expect(response.status).toBe(409);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects an operation targeting a past workout before ever calling apply_plan_patch", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ training: rawTraining })));
    const response = await handlePlanAdjustments(
      request({ body: { operations: [{ op: "skip", workoutId: "w-past" }], expectedPlanRevision: 1 } }),
      ENV,
      fetcher,
    );
    expect(response.status).toBe(422);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("rejects an operation targeting race day", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ training: rawTraining })));
    const response = await handlePlanAdjustments(
      request({ body: { operations: [{ op: "skip", workoutId: "w-race" }], expectedPlanRevision: 1 } }),
      ENV,
      fetcher,
    );
    expect(response.status).toBe(422);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("applies a valid edit end to end and returns the projected plan", async () => {
    const newPlan = { ...PLAN, revision: 2 };
    const fetcher = upstream(
      new Response(JSON.stringify({ training: rawTraining })),
      new Response(JSON.stringify({ adjustmentId: "adj-1", plan: newPlan, revision: 2 })),
    );
    const response = await handlePlanAdjustments(request({ body: applyBody }), ENV, fetcher);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.adjustmentId).toBe("adj-1");
    expect(body.revision).toBe(2);
    expect(body.plan.name).toBe("Test Plan");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body));
    expect(secondCallBody.p_expected_plan_revision).toBe(1);
    expect(secondCallBody.p_operations).toEqual(applyBody.operations);
  });

  it("collapses an immutable-field rejection from apply_plan_patch to one honest, non-specific message", async () => {
    const fetcher = upstream(
      new Response(JSON.stringify({ training: rawTraining })),
      new Response(JSON.stringify({ message: "plan_patch_touches_immutable_field" }), { status: 400 }),
    );
    const response = await handlePlanAdjustments(request({ body: applyBody }), ENV, fetcher);
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/immutable_field/);
  });

  it("maps a read-only token's attempt to apply a patch to 403, naming the actual problem (#181)", async () => {
    const fetcher = upstream(
      new Response(JSON.stringify({ training: rawTraining })),
      new Response(JSON.stringify({ message: "token_scope_insufficient" }), { status: 400 }),
    );
    const response = await handlePlanAdjustments(request({ body: applyBody }), ENV, fetcher);
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("insufficient_scope");
  });

  it("maps a token failure on the read step to a generic 401", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ message: "token_invalid_or_revoked" }), { status: 400 }));
    const response = await handlePlanAdjustments(request({ body: applyBody }), ENV, fetcher);
    expect(response.status).toBe(401);
  });

  it("answers 422 when the account has no active plan", async () => {
    const fetcher = upstream(new Response(JSON.stringify(null)));
    const response = await handlePlanAdjustments(request({ body: applyBody }), ENV, fetcher);
    expect(response.status).toBe(422);
  });
});

describe("Plan adjustments endpoint — undo", () => {
  it("rejects an undo request with no id", async () => {
    const response = await handlePlanAdjustments(request({ method: "DELETE" }), ENV);
    expect(response.status).toBe(400);
  });

  it("undoes an adjustment end to end", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ plan: PLAN, revision: 2 })));
    const response = await handlePlanAdjustments(
      request({ method: "DELETE", path: "/api/plan-adjustments?id=adj-1" }),
      ENV,
      fetcher,
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.revision).toBe(2);
    const callBody = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(callBody.p_adjustment_id).toBe("adj-1");
  });

  it("maps an unknown adjustment id to 404", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ message: "plan_adjustment_not_found" }), { status: 400 }));
    const response = await handlePlanAdjustments(
      request({ method: "DELETE", path: "/api/plan-adjustments?id=missing" }),
      ENV,
      fetcher,
    );
    expect(response.status).toBe(404);
  });

  it("maps an already-reverted adjustment to 409", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ message: "plan_adjustment_already_reverted" }), { status: 400 }));
    const response = await handlePlanAdjustments(
      request({ method: "DELETE", path: "/api/plan-adjustments?id=adj-1" }),
      ENV,
      fetcher,
    );
    expect(response.status).toBe(409);
  });

  it("maps a read-only token's attempt to undo a patch to 403", async () => {
    const fetcher = upstream(new Response(JSON.stringify({ message: "token_scope_insufficient" }), { status: 400 }));
    const response = await handlePlanAdjustments(
      request({ method: "DELETE", path: "/api/plan-adjustments?id=adj-1" }),
      ENV,
      fetcher,
    );
    expect(response.status).toBe(403);
  });
});

describe("Plan adjustments endpoint — Node handler shape", () => {
  it("supports the Node request/response handler shape, not only the Web one", async () => {
    const headers: Record<string, string> = {};
    let body: string | undefined;
    const nodeResponse = {
      statusCode: 0,
      setHeader: (name: string, value: string) => { headers[name.toLowerCase()] = value; },
      end: (value?: string) => { body = value; },
    };
    const previousEnv: Record<string, string | undefined> = {};
    for (const key of Object.keys(ENV)) previousEnv[key] = process.env[key];
    Object.assign(process.env, ENV);
    try {
      await handler({ method: "POST", url: "/api/plan-adjustments", headers: {}, body: applyBody }, nodeResponse);
    } finally {
      Object.assign(process.env, previousEnv);
    }
    expect(nodeResponse.statusCode).toBe(401);
    expect(body).toBeDefined();
  });
});
