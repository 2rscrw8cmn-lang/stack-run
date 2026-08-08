// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import handler from "./calendar";

const ICS = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR";

function ask(url: unknown, method = "POST"): Request {
  return new Request("https://stack.example/api/calendar", {
    method,
    headers: { "Content-Type": "application/json" },
    body: method === "POST" ? JSON.stringify({ url }) : undefined,
  });
}

function calendar(body = ICS, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/calendar" },
  });
}

function redirectTo(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

describe("the calendar reader", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("hands back a calendar it was able to read", async () => {
    const fetchMock = vi.fn().mockResolvedValue(calendar());
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(ask("https://roster.example/ical?key=abc"));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toMatch(/text\/calendar/);
    // Nothing about the link is worth keeping in a cache.
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.text()).resolves.toBe(ICS);

    const [target, init] = fetchMock.mock.calls[0];
    expect(String(target)).toBe("https://roster.example/ical?key=abc");
    expect(init.redirect).toBe("manual");
  });

  it("only answers POST, so links stay out of request logs", async () => {
    const response = await handler(ask(null, "GET"));

    expect(response.status).toBe(405);
    await expect(response.text()).resolves.toMatch(/POST body/);
  });

  it("refuses a request with no link in it", async () => {
    const response = await handler(ask(42));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/did not contain/);
  });

  it("refuses anything that is not https", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(ask("http://roster.example/ical"));

    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    "https://localhost/ical",
    "https://127.0.0.1/ical",
    "https://10.1.2.3/ical",
    "https://172.16.0.9/ical",
    "https://192.168.1.5/ical",
    "https://169.254.169.254/latest/meta-data/",
    "https://[::1]/ical",
    "https://[fd00::1]/ical",
    "https://roster.internal/ical",
  ])("refuses %s, which is not a public calendar host", async (url) => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await handler(ask(url));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/public calendar host/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("follows a redirect to another public host", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(redirectTo("https://cdn.example/roster.ics"))
        .mockResolvedValueOnce(calendar()),
    );

    const response = await handler(ask("https://roster.example/ical"));

    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe(ICS);
  });

  it("checks every hop, not just the first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(redirectTo("https://169.254.169.254/")),
    );

    const response = await handler(ask("https://roster.example/ical"));

    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toMatch(/public calendar host/);
  });

  it("gives up on a redirect loop", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(redirectTo("https://roster.example/again")),
    );

    const response = await handler(ask("https://roster.example/ical"));

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toMatch(/redirected too many times/);
  });

  it("reports the status a host answered with", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(calendar("no", 403)));

    const response = await handler(ask("https://roster.example/ical"));

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toMatch(/answered 403/);
  });

  it("says so when the host cannot be reached", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));

    const response = await handler(ask("https://roster.example/ical"));

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toMatch(/Could not reach/);
  });

  it("returns nothing that is not a calendar", async () => {
    // What keeps this from being a general-purpose fetcher for other pages.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("<html>secrets</html>")),
    );

    const response = await handler(ask("https://roster.example/ical"));

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toMatch(/did not return a calendar/);
  });

  it("refuses to buffer something enormous", async () => {
    const huge = `BEGIN:VCALENDAR${"x".repeat(2_000_001)}`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(huge)));

    const response = await handler(ask("https://roster.example/ical"));

    expect(response.status).toBe(502);
    await expect(response.text()).resolves.toMatch(/too large/);
  });
});
