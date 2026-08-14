import { escapeHtml, formatRace, resolveInvitePreview } from "./crewInvitePreview";

function html(body: string): Response {
  return new Response(body, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
}

export async function serveCrewInvite(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const preview = await resolveInvitePreview(token);
  const origin = url.origin;
  const fallbackTitle = "Join a Crew on STACK";
  const title = preview ? `Join ${preview.crewName} on STACK` : fallbackTitle;
  const description = preview
    ? preview.crewType === "club" ? `${preview.crewName} · Run Club` : formatRace(preview) ?? `${preview.crewName} · Race Crew`
    : "Private Crew invite on STACK.";
  const image = preview && token
    ? `${origin}/api/og/crew-invite?token=${encodeURIComponent(token)}&v=${encodeURIComponent(preview.emblemVersion)}`
    : `${origin}/api/og/crew-invite`;
  const appUrl = token ? `${origin}/?join=${encodeURIComponent(token)}` : origin;
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeImage = escapeHtml(image);
  const safeAppUrl = escapeHtml(appUrl);
  return html(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><meta name="description" content="${safeDescription}"><meta property="og:type" content="website"><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}"><meta property="og:url" content="${safeAppUrl}"><meta property="og:image" content="${safeImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${safeTitle}"><meta name="twitter:description" content="${safeDescription}"><meta name="twitter:image" content="${safeImage}"><script>location.replace(${JSON.stringify(appUrl)});</script></head><body><p><a href="${safeAppUrl}">Open STACK</a></p></body></html>`);
}

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

function headersFrom(request: NodeRequest): Headers {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers ?? {})) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }
  return headers;
}

/** The invite HTML needs its public origin for canonical and image URLs. */
function nodeOrigin(headers: Headers): string {
  const protocol = headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = headers.get("x-forwarded-host")?.split(",")[0]?.trim() || headers.get("host") || "stack.run";
  return `${protocol}://${host}`;
}

/** Supports Vercel's Node request/response invocation as well as web Request. */
export default async function handler(first: unknown, second?: unknown): Promise<Response | void> {
  if (!isNodeResponse(second)) return serveCrewInvite(first as Request);
  const request = first as NodeRequest;
  const headers = headersFrom(request);
  const response = await serveCrewInvite(new Request(`${nodeOrigin(headers)}${request.url ?? "/api/crew-invite"}`, {
    method: request.method ?? "GET",
    headers,
  }));
  second.statusCode = response.status;
  response.headers.forEach((value, name) => second.setHeader(name, value));
  second.end(await response.text());
}
