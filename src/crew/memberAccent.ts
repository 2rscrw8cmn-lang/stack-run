export type CrewMemberAccent =
  | "lime"
  | "blue"
  | "purple"
  | "yellow"
  | "cyan"
  | "orange";

const MEMBER_ACCENTS: readonly CrewMemberAccent[] = [
  "lime",
  "blue",
  "purple",
  "yellow",
  "cyan",
  "orange",
];

/** A small, stable identity cue. It never affects comparison order or value. */
export function crewMemberAccent(userId: string): CrewMemberAccent {
  let hash = 2166136261;
  for (const character of userId) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return MEMBER_ACCENTS[(hash >>> 0) % MEMBER_ACCENTS.length];
}
