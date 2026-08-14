import { escapeHtml, formatRace, resolveInvitePreview } from "./crewInvitePreview";

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

/** The invite HTML needs its public origin for canonical and image URLs. */
function originFor(request: NodeRequest): string {
  const protocol = firstHeader(request, "x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  const host = firstHeader(request, "x-forwarded-host")?.split(",")[0]?.trim()
    || firstHeader(request, "host")
    || "stack.run";
  return `${protocol}://${host}`;
}

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  const url = new URL(request.url ?? "/api/crew-invite", originFor(request));
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
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${safeTitle}</title><meta name="description" content="${safeDescription}"><meta property="og:type" content="website"><meta property="og:title" content="${safeTitle}"><meta property="og:description" content="${safeDescription}"><meta property="og:url" content="${safeAppUrl}"><meta property="og:image" content="${safeImage}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${safeTitle}"><meta name="twitter:description" content="${safeDescription}"><meta name="twitter:image" content="${safeImage}"><script>location.replace(${JSON.stringify(appUrl)});</script></head><body><p><a href="${safeAppUrl}">Open STACK</a></p></body></html>`;
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(body);
}
