import { describe, expect, it, vi } from "vitest";
import handler, { readTrainingContext } from "./training-context.js";

/** Declared rather than imported, the way `intervals.ts` itself does it. */
declare const process: { env: Record<string, string | undefined> };

const ENV = {
  VERCEL_ENV: "preview",
  VITE_STACK_BACKEND_ENV: "preview",
  VITE_SUPABASE_URL: "https://plpooikvofzytbpsbzki.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
};

const request = (headers: Record<string, string> = { Authorization: "Bearer a-real-looking-token" }, method = "GET") =>
  new Request("https://stack.test/api/training-context", { method, headers });

/** A fetch stub that records how it was called. */
function upstream(respond: () => Response) {
  return vi.fn<typeof fetch>(async () => respond());
}

const rawTraining = {
  settings: { units: "miles", theme: "dark" },
  plan: null,
  plan_history: [],
  race_setup: null,
  availability: null,
  run_days: null,
  cross_training_days: null,
  revision: 1,
  account_generation: 1,
};

const rawRun = {
  run_id: "run-1",
  workout_id: null,
  completed_date: "2026-08-10",
  activity_type: "long",
  distance_miles: 8,
  duration_seconds: 4200,
  effort: "great",
  notes: "a private reflection",
  source: "intervals",
  external_provider: "intervals",
  external_activity_id: "external-activity-id",
  external_source_updated_at: null,
  external_imported_at: "2026-08-10T12:00:00Z",
  imported_metrics: { averageHeartRate: 155 },
  legacy_aliases: [],
  revision: 1,
  deleted_at: null,
  created_at: "2026-08-10T12:00:00Z",
  updated_at: "2026-08-10T12:00:00Z",
  manual_heart_rate: null,
};

const validSnapshot = {
  training: rawTraining,
  runs: [rawRun],
  build: { placements: [], revision: 1 },
  intervals: {
    last_successful_activity_sync_at: null,
    ignored_activity_ids: [],
    pending_candidates: [],
    revision: 1,
  },
  crew: [
    {
      crewName: "Night Shift",
      role: "member",
      weeklyMiles: 4,
      longestRun28dMiles: 8,
      consistencyCompleted: 2,
      consistencyDue: 3,
      milesBuilt: 12,
    },
  ],
};

describe("Training context endpoint", () => {
  it("answers GET only", async () => {
    const response = await readTrainingContext(request(undefined, "POST"), ENV);
    expect(response.status).toBe(405);
  });

  it("refuses when the deployment is unconfigured, without calling upstream", async () => {
    const fetcher = upstream(() => new Response("[]"));
    const response = await readTrainingContext(request(), {}, fetcher);
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("refuses a production Supabase reader on a Preview deployment, without calling upstream", async () => {
    const fetcher = upstream(() => new Response("[]"));
    const response = await readTrainingContext(request(), {
      VERCEL_ENV: "preview",
      STACK_BACKEND_ENV: "production",
      SUPABASE_URL: "https://fgnecruhlybarcmljggi.supabase.co",
      SUPABASE_PUBLISHABLE_KEY: "sb_publishable_fake",
    }, fetcher);
    expect(response.status).toBe(503);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("rejects a request with no bearer token, without calling upstream", async () => {
    const fetcher = upstream(() => new Response("[]"));
    const response = await readTrainingContext(request({}), ENV, fetcher);
    expect(response.status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("hashes the token rather than forwarding it raw", async () => {
    const fetcher = upstream(() => new Response(JSON.stringify(null)));
    await readTrainingContext(request({ Authorization: "Bearer my-real-token" }), ENV, fetcher);
    const body = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(Object.keys(body)).toEqual(["p_token_hash"]);
    expect(body.p_token_hash).not.toContain("my-real-token");
    expect(body.p_token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("apikey")).toBe(ENV.VITE_SUPABASE_PUBLISHABLE_KEY);
  });

  it("treats every RPC failure the same — a generic 401, never distinguishing why", async () => {
    const fetcher = upstream(() => new Response(JSON.stringify({ message: "token_invalid_or_revoked" }), { status: 400 }));
    const response = await readTrainingContext(request(), ENV, fetcher);
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/token_invalid_or_revoked/);
  });

  it("returns an honest empty context for a token whose account never synced to the cloud", async () => {
    const fetcher = upstream(() => new Response(JSON.stringify(null)));
    const response = await readTrainingContext(request(), ENV, fetcher);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.plan).toBeNull();
    expect(body.recentRuns).toEqual([]);
    expect(body.planAdjustments).toEqual([]);
  });

  it("projects a real snapshot, keeping training facts but never notes or provider identity", async () => {
    const fetcher = upstream(() => new Response(JSON.stringify(validSnapshot)));
    const response = await readTrainingContext(request(), ENV, fetcher);
    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.recentRuns).toHaveLength(1);
    expect(body.recentRuns[0]).toMatchObject({
      distanceMiles: 8,
      activityType: "long",
      averageHeartRate: 155,
    });
    expect(body.crew).toEqual([
      {
        crewName: "Night Shift",
        role: "member",
        weeklyMiles: 4,
        longestRun28dMiles: 8,
        consistencyCompleted: 2,
        consistencyDue: 3,
        milesBuilt: 12,
      },
    ]);
    expect(JSON.stringify(body)).not.toMatch(/private reflection|external-activity-id/i);
  });

  it("never leaks which specific upstream error occurred on a malformed cloud document", async () => {
    const fetcher = upstream(() => new Response(JSON.stringify({ training: { settings: {} } })));
    const response = await readTrainingContext(request(), ENV, fetcher);
    expect(response.status).toBe(502);
  });

  it("answers 504 when STACK's own database times out", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      const error = new Error("timed out");
      error.name = "TimeoutError";
      throw error;
    });
    const response = await readTrainingContext(request(), ENV, fetcher);
    expect(response.status).toBe(504);
  });

  it("answers 502 when STACK's own database cannot be reached at all", async () => {
    const fetcher = vi.fn<typeof fetch>(async () => {
      throw new Error("network down");
    });
    const response = await readTrainingContext(request(), ENV, fetcher);
    expect(response.status).toBe(502);
  });

  it("supports the Node request/response handler shape, not only the Web one", async () => {
    const headers: Record<string, string> = {};
    let body: string | undefined;
    const nodeResponse = {
      statusCode: 0,
      setHeader: (name: string, value: string) => {
        headers[name.toLowerCase()] = value;
      },
      end: (value?: string) => {
        body = value;
      },
    };
    const previousEnv: Record<string, string | undefined> = {};
    for (const key of Object.keys(ENV)) previousEnv[key] = process.env[key];
    Object.assign(process.env, ENV);
    try {
      await handler(
        { method: "GET", url: "/api/training-context", headers: {} },
        nodeResponse,
      );
    } finally {
      Object.assign(process.env, previousEnv);
    }
    expect(nodeResponse.statusCode).toBe(401);
    expect(body).toBeDefined();
  });
});
