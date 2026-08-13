import { describe, expect, it, vi } from "vitest";
import handler, { readIntervals } from "./intervals";

/** Declared rather than imported, the way `intervals.ts` itself does it. */
declare const process: { env: Record<string, string | undefined> };

const env = { INTERVALS_API_KEY: "upstream-test-key", STACK_SYNC_TOKEN: "browser-test-token" };
const request = (query: string, token = env.STACK_SYNC_TOKEN, method = "GET") => new Request(`https://stack.test/api/intervals?${query}`, { method, headers: token ? { "X-Stack-Sync-Token": token } : {} });
/** A fetch stub that records how it was called. */
const upstream = (respond: () => Response) => vi.fn<typeof fetch>(async () => respond());

/** Runs `work` with the deployment secrets present, however it exits. */
async function withDeploymentSecrets(work: () => Promise<void>): Promise<void> {
  const previous = { INTERVALS_API_KEY: process.env.INTERVALS_API_KEY, STACK_SYNC_TOKEN: process.env.STACK_SYNC_TOKEN };
  Object.assign(process.env, env);
  try {
    await work();
  } finally {
    process.env.INTERVALS_API_KEY = previous.INTERVALS_API_KEY;
    process.env.STACK_SYNC_TOKEN = previous.STACK_SYNC_TOKEN;
  }
}

describe("Intervals proxy", () => {
  it("rejects missing configuration and wrong tokens without calling upstream", async () => {
    const fetcher = upstream(() => new Response("[]"));
    const unconfigured = await readIntervals(request("resource=status"), {}, fetcher);
    expect(unconfigured.status).toBe(503);
    // Names which secret is absent: neither name is a secret, and "not
    // configured" with two variables to check is twice the work from a phone.
    expect(await unconfigured.json()).toMatchObject({ missing: "INTERVALS_API_KEY and STACK_SYNC_TOKEN" });
    expect((await readIntervals(request("resource=status", "wrong"), env, fetcher)).status).toBe(401);
    expect((await readIntervals(request("resource=status", ""), env, fetcher)).status).toBe(401);
    expect((await readIntervals(request("resource=status", `${env.STACK_SYNC_TOKEN}x`), env, fetcher)).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("authorizes when the stored secrets carry pasted whitespace", async () => {
    const fetcher = upstream(() => new Response("[]"));
    const padded = { INTERVALS_API_KEY: ` ${env.INTERVALS_API_KEY}\n`, STACK_SYNC_TOKEN: ` ${env.STACK_SYNC_TOKEN}\n` };
    expect((await readIntervals(request("resource=status"), padded, fetcher)).status).toBe(200);
    expect(new Headers(fetcher.mock.calls[0]?.[1]?.headers).get("Authorization")).toBe(`Basic ${btoa(`API_KEY:${env.INTERVALS_API_KEY}`)}`);
  });
  it("validates whitelisted selectors", async () => {
    expect((await readIntervals(request("resource=activities&oldest=2026-01-01&newest=2026-06-01"), env)).status).toBe(400);
    expect((await readIntervals(request("resource=activity&id=../secret"), env)).status).toBe(400);
    expect((await readIntervals(request("resource=activity-streams&id=../secret"), env)).status).toBe(400);
    expect((await readIntervals(request("resource=anything"), env)).status).toBe(400);
  });
  it("requests the Run Profile stream types for the streams resource", async () => {
    const fetcher = upstream(() => new Response(JSON.stringify({ time: [0, 60] })));
    const response = await readIntervals(request("resource=activity-streams&id=activity-1"), env, fetcher);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/api/v1/activity/activity-1/streams");
    expect(url.searchParams.get("types")).toBe("time,heartrate,altitude,velocity_smooth,cadence");
    expect(response.status).toBe(200);
  });
  it("tests the connection against the activity endpoint sync itself uses", async () => {
    const fetcher = upstream(() => new Response(JSON.stringify([{ id: "i1", name: "private" }])));
    const response = await readIntervals(request("resource=status"), env, fetcher);
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname).toBe("/api/v1/athlete/0/activities");
    expect(url.searchParams.get("oldest")).toBe(url.searchParams.get("newest"));
    expect(response.status).toBe(200);
    // A reachability check, not a read: the probe's response is discarded.
    expect(await response.json()).toEqual({ ok: true, resource: "status" });
  });
  it("uses Basic authorization and no-store", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Basic ${btoa("API_KEY:upstream-test-key")}`);
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    });
    const response = await readIntervals(request("resource=activities&oldest=2026-06-01&newest=2026-06-10"), env, fetcher);
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.text()).toBe("[]");
  });
  it.each([[401, 502], [403, 502], [500, 502]])("normalizes upstream %s", async (status, expected) => {
    const response = await readIntervals(request("resource=status"), env, upstream(() => new Response("private", { status })));
    expect(response.status).toBe(expected); expect(await response.text()).not.toContain("private");
  });
  it("reports an upstream refusal by status without its body", async () => {
    const response = await readIntervals(request("resource=status"), env, upstream(() => new Response("private", { status: 404 })));
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ error: "upstream_rejected_request", upstreamStatus: 404 });
  });
  it("describes a slow upstream instead of being killed by the platform", async () => {
    const fetcher = upstream(() => { throw Object.assign(new Error("timed out"), { name: "TimeoutError" }); });
    const response = await readIntervals(request("resource=status"), env, fetcher);
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({ error: "upstream_timeout" });
  });
  it("preserves Retry-After for rate limiting", async () => {
    const response = await readIntervals(request("resource=status"), env, upstream(() => new Response("", { status: 429, headers: { "Retry-After": "30" } })));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30");
  });
});

describe("Intervals proxy entry point", () => {
  it("answers a Node-style invocation, carrying the query and the token header", async () => {
    await withDeploymentSecrets(async () => {
      const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("[]"));
      const sent: { status?: number; headers: Record<string, string>; body?: string } = { headers: {} };
      const response = {
        set statusCode(value: number) { sent.status = value; },
        setHeader: (name: string, value: string) => { sent.headers[name.toLowerCase()] = value; },
        end: (body?: string) => { sent.body = body; },
      };

      await handler({ method: "GET", url: "/api/intervals?resource=activities&oldest=2026-06-01&newest=2026-06-10", headers: { "x-stack-sync-token": env.STACK_SYNC_TOKEN } }, response);

      expect(sent.status).toBe(200);
      expect(sent.headers["cache-control"]).toBe("no-store");
      expect(sent.body).toBe("[]");
      expect(String(fetcher.mock.calls[0]?.[0])).toContain("oldest=2026-06-01");
      fetcher.mockRestore();
    });
  });

  it("answers a web-standard invocation through the same route", async () => {
    await withDeploymentSecrets(async () => {
      const response = (await handler(request("resource=nonsense"))) as Response;
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid_resource" });
    });
  });
});
