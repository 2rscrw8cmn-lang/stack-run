type CrewType = "race" | "club";

interface InvitePreview {
  crewName: string;
  crewType: CrewType;
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
  emblem: string | null;
}

interface NodeResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body?: string): void;
}

interface NodeRequest { method?: string; url?: string; }

declare const process: { env: Record<string, string | undefined> };

const COLORS = ["#a6ff1a", "#287dff", "#ffd21a", "#a14cff", "#f6f7f8"];
const FALLBACK = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><rect width="1200" height="630" fill="#05080a"/><text x="84" y="330" fill="#f5f7f8" font-family="Arial, sans-serif" font-size="64" font-weight="700">STACK</text></svg>';

function text(value: unknown): string | null { return typeof value === "string" && value.trim() ? value.trim() : null; }
function number(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!); }

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
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/preview_crew_invite`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_token_hash: tokenHash }) });
    if (!response.ok) return null;
    const row = (await response.json() as unknown[])[0] as Record<string, unknown> | undefined;
    const crewName = text(row?.crew_name);
    const crewType = row?.crew_type === "club" ? "club" : row?.crew_type === "race" ? "race" : null;
    if (!crewName || !crewType) return null;
    return { crewName, crewType, raceName: text(row?.race_name), raceDate: text(row?.race_date), raceDistanceMiles: number(row?.race_distance_miles), emblem: text(row?.emblem) };
  } catch { return null; }
}

/** Server-safe crest: preserves each Crew's saved palette without importing browser UI modules. */
function emblemMarkup(code: string | null): string {
  const palette = [...(code?.matchAll(/\d+\.(\d+)/g) ?? [])].map((match) => COLORS[Number(match[1]) % COLORS.length]);
  const [top = COLORS[4], middle = COLORS[0], bottom = COLORS[4], frame = COLORS[0]] = palette;
  return `<g><rect x="42" y="16" width="96" height="150" rx="12" fill="none" stroke="#03070a" stroke-width="14"/><rect x="42" y="16" width="96" height="150" rx="12" fill="none" stroke="${frame}" stroke-width="7"/><path d="M55 64V42H76V30H104V42H125V64Z" fill="${top}" stroke="#03070a" stroke-width="4"/><rect x="55" y="76" width="70" height="40" rx="3" fill="${middle}" stroke="#03070a" stroke-width="4"/><path d="M55 128H125V150L90 170L55 150Z" fill="${bottom}" stroke="#03070a" stroke-width="4"/></g>`;
}

export default async function handler(request: NodeRequest, response: NodeResponse): Promise<void> {
  const token = new URL(request.url ?? "/api/og/crew-invite", "https://image.invalid").searchParams.get("token");
  const preview = await resolveInvitePreview(token);
  let body = FALLBACK;
  if (preview) {
    const race = formatRace(preview);
    const kind = preview.crewType === "club" ? "RUN CLUB" : "PRIVATE RACE CREW INVITE";
    body = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630"><defs><linearGradient id="fade" x1="0" x2="1"><stop stop-color="#071015"/><stop offset="1" stop-color="#05080a"/></linearGradient><pattern id="grid" width="48" height="48" patternUnits="userSpaceOnUse"><path d="M48 0H0V48" fill="none" stroke="#173029" stroke-opacity=".55" stroke-width="1"/></pattern></defs><rect width="1200" height="630" fill="url(#fade)"/><rect width="1200" height="630" fill="url(#grid)"/><rect x="58" y="58" width="3" height="514" fill="#7ddc3a"/><svg x="108" y="154" width="300" height="300" viewBox="0 0 180 180">${emblemMarkup(preview.emblem)}</svg><g font-family="Arial, Helvetica, sans-serif" fill="#f5f7f8"><text x="490" y="150" font-family="monospace" font-size="24" font-weight="700" letter-spacing="4" fill="#9fb0ae">${kind}</text><text x="490" y="250" font-size="70" font-weight="800">${escapeHtml(preview.crewName)}</text>${race ? `<text x="490" y="322" font-size="31" fill="#b8c4c2">${escapeHtml(race)}</text>` : ""}<g transform="translate(490 452)"><rect width="34" height="34" rx="8" fill="#287dff"/><path d="M8 20H26" stroke="#a6ff1a" stroke-width="5" stroke-linecap="round"/><text x="52" y="27" font-size="30" font-weight="700">Join on STACK</text></g></g></svg>`;
  }
  response.statusCode = 200;
  response.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  response.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
  response.end(body);
}
