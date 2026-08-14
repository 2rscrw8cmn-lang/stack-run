// Vercel compiles each API file on its own and leaves the import specifiers
// alone, so relative imports need the extension Node's ESM resolver expects at
// runtime. TypeScript and Vite both map `.js` back to the `.ts` file.
import {
  encodeCrewEmblem,
  resolveCrewEmblem,
  type CrewEmblem,
} from "../src/crew/emblem.js";
import type { CrewType } from "../src/crew/types.js";

type Environment = {
  SUPABASE_URL?: string;
  SUPABASE_PUBLISHABLE_KEY?: string;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_PUBLISHABLE_KEY?: string;
};

declare const process: { env: Environment };

type Row = Record<string, unknown>;

export interface InvitePreview {
  crewId: string;
  crewName: string;
  crewType: CrewType;
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
  emblem: CrewEmblem;
  emblemVersion: string;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function number(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Never log the capability token: this resolver is the only server boundary. */
export async function resolveInvitePreview(token: string | null): Promise<InvitePreview | null> {
  if (!token || !/^[A-Za-z0-9_-]{32,}$/.test(token)) return null;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  try {
    // Vercel's current Node runtime exposes Web Crypto, while browser code uses
    // the same standard API. Keep every runtime-dependent operation inside the
    // safe preview boundary: an unavailable preview must not turn a valid
    // capability link into a platform 500.
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const tokenHash = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
    const response = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/preview_crew_invite`, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ p_token_hash: tokenHash }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    const row = Array.isArray(data) ? data[0] as Row | undefined : undefined;
    const crewId = text(row?.crew_id);
    const crewName = text(row?.crew_name);
    const crewType = row?.crew_type === "club" ? "club" : row?.crew_type === "race" ? "race" : null;
    if (!crewId || !crewName || !crewType) return null;
    const emblem = resolveCrewEmblem(row?.emblem, crewId);
    return {
      crewId,
      crewName,
      crewType,
      raceName: text(row?.race_name),
      raceDate: text(row?.race_date),
      raceDistanceMiles: number(row?.race_distance_miles),
      emblem,
      emblemVersion: encodeCrewEmblem(emblem),
    };
  } catch {
    return null;
  }
}

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
}

/** The race a Race Crew is built around; a Run Club never has one. */
export function raceNameOf(preview: InvitePreview): string | null {
  return preview.crewType === "club" ? null : preview.raceName;
}

/** When and how far, on its own: `Dec 5, 2026 · 13.1 mi`. */
export function formatRaceDetail(preview: InvitePreview): string | null {
  if (preview.crewType === "club" || !preview.raceDate) return null;
  const date = new Date(`${preview.raceDate}T12:00:00Z`);
  const dateLabel = Number.isNaN(date.valueOf())
    ? preview.raceDate
    : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }).format(date);
  return `${dateLabel}${preview.raceDistanceMiles ? ` · ${preview.raceDistanceMiles} mi` : ""}`;
}

/** The one-line race summary the invite page's description uses. */
export function formatRace(preview: InvitePreview): string | null {
  const raceName = raceNameOf(preview);
  const detail = formatRaceDetail(preview);
  if (!raceName || !detail) return null;
  return `${raceName} · ${detail}`;
}
