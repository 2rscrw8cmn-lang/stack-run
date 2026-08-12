export type CrewMemberAccent =
  | "green"
  | "emerald"
  | "jade"
  | "mint"
  | "seafoam"
  | "aqua"
  | "turquoise"
  | "sky"
  | "orchid"
  | "magenta"
  | "fuchsia"
  | "raspberry"
  | "crimson"
  | "red"
  | "vermilion"
  | "rust";

/**
 * Every color a runner can pick in Settings, in picker order. Deliberately
 * its own palette rather than a reuse of the activity colors (easy,
 * intervals, simulation, long) — this is who ran it, not what kind of run it
 * was, and the two must never look like the same signal.
 */
export const MEMBER_ACCENTS: readonly CrewMemberAccent[] = [
  "green",
  "emerald",
  "jade",
  "mint",
  "seafoam",
  "aqua",
  "turquoise",
  "sky",
  "orchid",
  "magenta",
  "fuchsia",
  "raspberry",
  "crimson",
  "red",
  "vermilion",
  "rust",
];

/** Title-case labels for the Settings picker. */
export const MEMBER_ACCENT_LABEL: Record<CrewMemberAccent, string> = {
  green: "Green",
  emerald: "Emerald",
  jade: "Jade",
  mint: "Mint",
  seafoam: "Seafoam",
  aqua: "Aqua",
  turquoise: "Turquoise",
  sky: "Sky",
  orchid: "Orchid",
  magenta: "Magenta",
  fuchsia: "Fuchsia",
  raspberry: "Raspberry",
  crimson: "Crimson",
  red: "Red",
  vermilion: "Vermilion",
  rust: "Rust",
};

/** Narrows a raw database value to a known accent, or null for anything else. */
export function accentColorFrom(value: unknown): CrewMemberAccent | null {
  return typeof value === "string" && (MEMBER_ACCENTS as readonly string[]).includes(value)
    ? (value as CrewMemberAccent)
    : null;
}

function hashAccent(userId: string): CrewMemberAccent {
  let hash = 2166136261;
  for (const character of userId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return MEMBER_ACCENTS[(hash >>> 0) % MEMBER_ACCENTS.length];
}

/**
 * The color a member actually renders with: their own pick when they have
 * made one, or a stable per-user default otherwise. The default is never a
 * placeholder shown alongside "real" colors — it is drawn from the same
 * 16-option set, so an unpicked runner still never collides with an
 * activity color, only possibly with another unpicked runner until one of
 * them opens Settings and picks explicitly.
 */
export function crewMemberAccent(
  userId: string,
  accentColor?: CrewMemberAccent | null,
): CrewMemberAccent {
  return accentColor ?? hashAccent(userId);
}
