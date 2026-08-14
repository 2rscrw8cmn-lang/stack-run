// The server-rendered `/join/<token>` page.
//
// A link previewer gets crew-specific metadata on the first response, and a
// browser is sent on to the app with the capability intact. Relative imports
// carry their `.js` extension because Vercel compiles each API file separately
// and Node's ESM resolver reads the specifier as written.
import {
  escapeHtml,
  formatRace,
  resolveInvitePreview,
  type InvitePreview,
} from "./_crewInvitePreview.js";

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

function firstHeader(request: NodeRequest, name: string): string | null {
  const value = request.headers?.[name] ?? request.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

function originFor(request: NodeRequest): string {
  const protocol = firstHeader(request, "x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = firstHeader(request, "x-forwarded-host")?.split(",")[0]?.trim() || firstHeader(request, "host") || "stack.run";
  return `${protocol}://${host}`;
}

function describe(preview: InvitePreview | null): string {
  if (!preview) return "Private Crew invite on STACK.";
  if (preview.crewType === "club") return `${preview.crewName} · Run Club`;
  return formatRace(preview) ?? `${preview.crewName} · Race Crew`;
}

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  const url = new URL(request.url ?? "/api/crew-invite", originFor(request));
  const token = url.searchParams.get("token");
  const preview = await resolveInvitePreview(token);
  const origin = url.origin;
  const title = preview ? `Join ${preview.crewName} on STACK` : "Join a Crew on STACK";
  const description = describe(preview);
  const image = preview && token
    ? `${origin}/api/og/crew-invite?token=${encodeURIComponent(token)}&v=${encodeURIComponent(preview.emblemVersion)}`
    : `${origin}/api/og/crew-invite`;
  const imageAlt = preview
    ? `${preview.crewName} on STACK`
    : "STACK — build your race";
  // The share URL is the invite itself. The browser still continues to the app
  // with the capability, but that redirect target is not what gets shared.
  const canonical = token ? `${origin}/join/${encodeURIComponent(token)}` : origin;
  const appUrl = token ? `${origin}/?join=${encodeURIComponent(token)}` : origin;
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="STACK"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:type" content="image/png"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta property="og:image:alt" content="${escapeHtml(imageAlt)}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><script>location.replace(${JSON.stringify(appUrl)});</script></head><body><p><a href="${escapeHtml(appUrl)}">Open STACK</a></p></body></html>`;
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(body);
}
