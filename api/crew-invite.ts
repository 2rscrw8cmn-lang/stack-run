type CrewType = "race" | "club";

interface InvitePreview {
  crewName: string;
  crewType: CrewType;
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
  emblemVersion: string;
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

declare const process: { env: Record<string, string | undefined> };

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

function formatRace(preview: InvitePreview): string | null {
  if (preview.crewType === "club" || !preview.raceName || !preview.raceDate) return null;
  const date = new Date(`${preview.raceDate}T12:00:00Z`);
  const dateLabel = Number.isNaN(date.valueOf()) ? preview.raceDate : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  return `${preview.raceName} · ${dateLabel}${preview.raceDistanceMiles ? ` · ${preview.raceDistanceMiles} mi` : ""}`;
}

async function resolveInvitePreview(token: string | null): Promise<InvitePreview | null> {
  if (!token || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return null;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/preview_crew_invite`, {
      method: "POST",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token_hash: tokenHash }),
    });
    if (!response.ok) return null;
    const row = (await response.json() as unknown[])[0] as Record<string, unknown> | undefined;
    const crewName = text(row?.crew_name);
    const crewType = row?.crew_type === "club" ? "club" : row?.crew_type === "race" ? "race" : null;
    if (!crewName || !crewType) return null;
    return {
      crewName,
      crewType,
      raceName: text(row?.race_name),
      raceDate: text(row?.race_date),
      raceDistanceMiles: number(row?.race_distance_miles),
      emblemVersion: text(row?.emblem) ?? "default",
    };
  } catch {
    return null;
  }
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

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  const url = new URL(request.url ?? "/api/crew-invite", originFor(request));
  const token = url.searchParams.get("token");
  const preview = await resolveInvitePreview(token);
  const origin = url.origin;
  const title = preview ? `Join ${preview.crewName} on STACK` : "Join a Crew on STACK";
  const description = preview ? (preview.crewType === "club" ? `${preview.crewName} · Run Club` : formatRace(preview) ?? `${preview.crewName} · Race Crew`) : "Private Crew invite on STACK.";
  const image = preview && token ? `${origin}/api/og/crew-invite?token=${encodeURIComponent(token)}&v=${encodeURIComponent(preview.emblemVersion)}` : `${origin}/api/og/crew-invite`;
  const appUrl = token ? `${origin}/?join=${encodeURIComponent(token)}` : origin;
  const body = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><meta name="description" content="${escapeHtml(description)}"><meta property="og:type" content="website"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(appUrl)}"><meta property="og:image" content="${escapeHtml(image)}"><meta property="og:image:width" content="1200"><meta property="og:image:height" content="630"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}"><meta name="twitter:image" content="${escapeHtml(image)}"><script>location.replace(${JSON.stringify(appUrl)});</script></head><body><p><a href="${escapeHtml(appUrl)}">Open STACK</a></p></body></html>`;
  response.statusCode = 200;
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store");
  response.end(body);
}
