/**
 * Reads Intervals.icu on the page's behalf.
 *
 * The Intervals personal API key is a powerful, long-lived credential, so it
 * never reaches the browser: it lives here, in the function environment. That
 * would make this route a way for anyone who found the URL to read the owner's
 * training data, so the route additionally requires STACK's own sync token —
 * a narrow, separately rotatable credential the browser is allowed to hold.
 *
 * The route is read-only and whitelists both the resource and its arguments.
 * It never forwards an upstream body on failure and never names either secret
 * in a response.
 */

const BASE = "https://intervals.icu/api/v1";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_ID = /^[A-Za-z0-9_-]{1,120}$/;
const MAX_RANGE_DAYS = 120;
/**
 * Run Profile's per-second series, kept deliberately narrow: this route asks
 * for the four series STACK plots and nothing else. See
 * `docs/CONNECTED_DATA_FIELDS.md` and `normalizeIntervalsRunProfile` in
 * `src/connected/intervals.ts`. The per-sample stream shapes remain
 * `Expected` rather than `Verified` — they follow Intervals.icu's documented
 * streams contract, and the August 13 real-device review verified the summary
 * aggregates rather than the stream payload itself.
 */
const RUN_PROFILE_STREAM_TYPES = "time,heartrate,altitude,velocity_smooth,cadence";
/**
 * Intervals sits behind Cloudflare, which challenges clients that do not look
 * like anything in particular. This says what STACK is rather than pretending
 * to be a browser.
 */
const USER_AGENT = "STACK Connected Training/1.0 (+https://stack.run)";
/**
 * Below the platform's function limit, so a slow upstream returns a described
 * error instead of being killed mid-read — which reaches the phone as a bare
 * platform timeout with nothing to act on.
 */
const TIMEOUT_MS = 15_000;

declare const process: { env: Environment };

type Environment = { INTERVALS_API_KEY?: string; STACK_SYNC_TOKEN?: string };

function json(status: number, body: object, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...extra } });
}

function validDate(value: string | null): value is string {
  if (!value || !DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function rangeIsValid(oldest: string | null, newest: string | null): oldest is string {
  if (!validDate(oldest) || !validDate(newest)) return false;
  const days = (Date.parse(`${newest}T00:00:00Z`) - Date.parse(`${oldest}T00:00:00Z`)) / 86_400_000;
  return days >= 0 && days <= MAX_RANGE_DAYS;
}

/**
 * Compares the offered token against the expected one in time that does not
 * depend on how much of it is right.
 *
 * `!==` stops at the first differing character, so an attacker who can time
 * the response can recover the token one character at a time. Every character
 * is compared here, and the lengths are folded in rather than short-circuited
 * on. The environment value is trimmed by the caller: a token pasted into a
 * dashboard field very often arrives with a trailing newline, and an invisible
 * character is a miserable thing to debug from a phone.
 */
function tokenMatches(offered: string | null, expected: string): boolean {
  if (offered === null) return false;
  let difference = offered.length ^ expected.length;
  for (let index = 0; index < expected.length; index += 1) {
    difference |= expected.charCodeAt(index) ^ (offered.charCodeAt(index % offered.length) || 0);
  }
  return difference === 0;
}

/** Today in UTC, which is only ever used as a one-day probe range. */
function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function readIntervals(request: Request, env: Environment = process.env, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "GET") return json(405, { error: "method_not_allowed", message: "STACK Run Data reader: deployed and ready. It answers GET only." }, { Allow: "GET" });

  const apiKey = env.INTERVALS_API_KEY?.trim();
  const syncToken = env.STACK_SYNC_TOKEN?.trim();
  if (!apiKey || !syncToken) {
    // Named individually because "not configured" with both secrets to check
    // is twice the work from a phone, and neither name is a secret.
    const missing = [!apiKey && "INTERVALS_API_KEY", !syncToken && "STACK_SYNC_TOKEN"].filter(Boolean).join(" and ");
    return json(503, { error: "not_configured", missing, message: `Connected Run Data is not configured on the server: ${missing} is not set for this deployment.` });
  }
  if (!tokenMatches(request.headers.get("X-Stack-Sync-Token"), syncToken)) {
    // Says the route exists, which is the other half of what a failed
    // connection attempt needs to distinguish, and gives away nothing else.
    return json(401, { error: "unauthorized", message: "STACK Run Data reader: deployed and configured. This request did not carry the right sync token." });
  }

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  let upstream: URL;
  /** Status answers "can STACK reach Intervals with these credentials?" only. */
  let probeOnly = false;
  if (resource === "status") {
    /*
     * A one-day activity query rather than an athlete lookup. The endpoints
     * this integration is specified against are the activity ones, so the
     * connection test exercises exactly the path a sync will take — an athlete
     * endpoint that answers differently would either fail a working setup or
     * pass a broken one. The response itself is discarded.
     */
    const today = todayUtc();
    upstream = new URL(`${BASE}/athlete/0/activities`);
    upstream.searchParams.set("oldest", today);
    upstream.searchParams.set("newest", today);
    probeOnly = true;
  } else if (resource === "activities" || resource === "wellness") {
    const oldest = url.searchParams.get("oldest");
    const newest = url.searchParams.get("newest");
    if (!rangeIsValid(oldest, newest)) return json(400, { error: "invalid_date_range", message: `Ask for a valid YYYY-MM-DD range of at most ${MAX_RANGE_DAYS} days.` });
    upstream = new URL(`${BASE}/athlete/0/${resource}`);
    upstream.searchParams.set("oldest", oldest);
    upstream.searchParams.set("newest", newest!);
  } else if (resource === "activity") {
    const id = url.searchParams.get("id");
    if (!id || !ACTIVITY_ID.test(id)) return json(400, { error: "invalid_activity_id", message: "That activity id is not readable." });
    upstream = new URL(`${BASE}/activity/${encodeURIComponent(id)}`);
    if (url.searchParams.get("intervals") === "true") upstream.searchParams.set("intervals", "true");
  } else if (resource === "activity-streams") {
    const id = url.searchParams.get("id");
    if (!id || !ACTIVITY_ID.test(id)) return json(400, { error: "invalid_activity_id", message: "That activity id is not readable." });
    upstream = new URL(`${BASE}/activity/${encodeURIComponent(id)}/streams`);
    upstream.searchParams.set("types", RUN_PROFILE_STREAM_TYPES);
  } else return json(400, { error: "invalid_resource", message: "STACK Run Data reader: deployed and configured. Ask for resource=status, activities, activity, activity-streams or wellness." });

  let response: Response;
  try {
    response = await fetcher(upstream, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Basic ${btoa(`API_KEY:${apiKey}`)}`, Accept: "application/json", "User-Agent": USER_AGENT },
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return json(504, { error: "upstream_timeout", message: "Intervals.icu took too long to answer." });
    return json(502, { error: "upstream_unavailable", message: "Intervals.icu could not be reached." });
  }
  if (response.status === 401 || response.status === 403) return json(502, { error: "upstream_authorization_failed", message: "Intervals.icu rejected STACK's API key." });
  if (response.status === 429) {
    const retry = response.headers.get("Retry-After");
    return json(429, { error: "rate_limited", message: "Intervals.icu is rate limiting requests." }, retry ? { "Retry-After": retry } : undefined);
  }
  if (response.status >= 500) return json(502, { error: "upstream_unavailable", message: "Intervals.icu could not be reached." });
  // The upstream status travels as a number so a wrong endpoint or a rejected
  // argument can be told apart from the outside. The upstream *body* never
  // does: it may contain data this route is not the place to hand back.
  if (!response.ok) return json(502, { error: "upstream_rejected_request", upstreamStatus: response.status, message: `Intervals.icu answered ${response.status}.` });

  if (probeOnly) return json(200, { ok: true, resource: "status" });
  /*
   * Read the body here rather than handing the upstream stream back. A stream
   * only survives if the platform invokes this as a web handler, and the
   * responses are activity JSON — tens of kilobytes, not something worth
   * streaming for.
   */
  return new Response(await response.text(), { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

/**
 * The shape of a Node request/response, described here rather than imported,
 * so this needs no `@types/node` for a path that may never be taken.
 */
interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface NodeRequest {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}

function isNodeResponse(value: unknown): value is NodeResponse {
  return typeof (value as NodeResponse | null | undefined)?.end === "function";
}

/**
 * The entry point, deliberately indifferent to how it is called.
 *
 * A Node runtime accepts two shapes of handler: the web-standard one that
 * takes a `Request` and returns a `Response`, and the older pair where you
 * write to a response object and return nothing. Guessing wrong is not a
 * visible error — either the returned response is dropped and the invocation
 * runs until the platform kills it, or `new URL(request.url)` throws on a path
 * with no origin and the deployment answers 500. Both reach the phone as
 * "Run Data could not be reached" with nothing behind it. `api/calendar.ts`
 * handles both for the same reason; so does this.
 */
export default async function handler(first: unknown, second?: unknown): Promise<Response | void> {
  if (!isNodeResponse(second)) return readIntervals(first as Request);

  const request = first as NodeRequest;
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }

  // The host is a placeholder: only the path and query are read, but `URL`
  // requires an origin to parse at all.
  const response = await readIntervals(new Request(`https://reader.invalid${request.url ?? "/api/intervals"}`, { method: request.method ?? "GET", headers }));

  second.statusCode = response.status;
  response.headers.forEach((value, name) => second.setHeader(name, value));
  second.end(await response.text());
}
