const BASE = "https://intervals.icu/api/v1";
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_ID = /^[A-Za-z0-9_-]{1,120}$/;
const MAX_RANGE_DAYS = 120;
const USER_AGENT = "STACK Connected Training/1.0 (+https://stack.run)";
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

export async function readIntervals(request: Request, env: Environment = process.env, fetcher: typeof fetch = fetch): Promise<Response> {
  if (request.method !== "GET") return json(405, { error: "method_not_allowed" }, { Allow: "GET" });
  if (!env.INTERVALS_API_KEY || !env.STACK_SYNC_TOKEN) return json(503, { error: "not_configured", message: "Connected Run Data is not configured." });
  if (request.headers.get("X-Stack-Sync-Token") !== env.STACK_SYNC_TOKEN) return json(401, { error: "unauthorized" });

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource");
  let upstream: URL;
  if (resource === "status") upstream = new URL(`${BASE}/athlete/0`);
  else if (resource === "activities" || resource === "wellness") {
    const oldest = url.searchParams.get("oldest");
    const newest = url.searchParams.get("newest");
    if (!rangeIsValid(oldest, newest)) return json(400, { error: "invalid_date_range" });
    upstream = new URL(`${BASE}/athlete/0/${resource}`);
    upstream.searchParams.set("oldest", oldest);
    upstream.searchParams.set("newest", newest!);
  } else if (resource === "activity") {
    const id = url.searchParams.get("id");
    if (!id || !ACTIVITY_ID.test(id)) return json(400, { error: "invalid_activity_id" });
    upstream = new URL(`${BASE}/activity/${encodeURIComponent(id)}`);
    if (url.searchParams.get("intervals") === "true") upstream.searchParams.set("intervals", "true");
  } else return json(400, { error: "invalid_resource" });

  let response: Response;
  try {
    response = await fetcher(upstream, { headers: { Authorization: `Basic ${btoa(`API_KEY:${env.INTERVALS_API_KEY}`)}`, Accept: "application/json", "User-Agent": USER_AGENT } });
  } catch {
    return json(502, { error: "upstream_unavailable" });
  }
  if (response.status === 401 || response.status === 403) return json(502, { error: "upstream_authorization_failed" });
  if (response.status === 429) {
    const retry = response.headers.get("Retry-After");
    return json(429, { error: "rate_limited" }, retry ? { "Retry-After": retry } : undefined);
  }
  if (response.status >= 500) return json(502, { error: "upstream_unavailable" });
  if (!response.ok) return json(502, { error: "upstream_rejected_request" });
  return new Response(response.body, { status: 200, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}

export default function handler(request: Request): Promise<Response> {
  return readIntervals(request);
}
