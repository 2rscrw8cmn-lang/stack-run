import { describe, expect, it, vi } from "vitest";
import { readIntervals } from "./intervals";

const env = { INTERVALS_API_KEY: "upstream-test-key", STACK_SYNC_TOKEN: "browser-test-token" };
const request = (query: string, token = env.STACK_SYNC_TOKEN, method = "GET") => new Request(`https://stack.test/api/intervals?${query}`, { method, headers: token ? { "X-Stack-Sync-Token": token } : {} });

describe("Intervals proxy", () => {
  it("rejects missing configuration and wrong tokens without calling upstream", async () => {
    const fetcher = vi.fn();
    expect((await readIntervals(request("resource=status"), {}, fetcher)).status).toBe(503);
    expect((await readIntervals(request("resource=status", "wrong"), env, fetcher)).status).toBe(401);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("validates whitelisted selectors", async () => {
    expect((await readIntervals(request("resource=activities&oldest=2026-01-01&newest=2026-06-01"), env)).status).toBe(400);
    expect((await readIntervals(request("resource=activity&id=../secret"), env)).status).toBe(400);
    expect((await readIntervals(request("resource=anything"), env)).status).toBe(400);
  });
  it("uses Basic authorization and no-store", async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get("Authorization")).toBe(`Basic ${btoa("API_KEY:upstream-test-key")}`);
      return new Response("[]", { headers: { "Content-Type": "application/json" } });
    });
    const response = await readIntervals(request("resource=activities&oldest=2026-06-01&newest=2026-06-10"), env, fetcher);
    expect(response.status).toBe(200); expect(response.headers.get("Cache-Control")).toBe("no-store");
  });
  it.each([[401, 502], [403, 502], [500, 502]])("normalizes upstream %s", async (upstream, expected) => {
    const response = await readIntervals(request("resource=status"), env, vi.fn(async () => new Response("private", { status: upstream })));
    expect(response.status).toBe(expected); expect(await response.text()).not.toContain("private");
  });
  it("preserves Retry-After for rate limiting", async () => {
    const response = await readIntervals(request("resource=status"), env, vi.fn(async () => new Response("", { status: 429, headers: { "Retry-After": "30" } })));
    expect(response.status).toBe(429); expect(response.headers.get("Retry-After")).toBe("30");
  });
});
