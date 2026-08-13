/**
 * Runner Icons — the small personal mark a runner wears across Crew.
 *
 * Three concepts sit side by side and must not blur together: a Crew Emblem
 * answers *which crew*, a Runner Icon answers *which person*, and the member
 * accent answers *which person, at a glance, in one color*. This module owns
 * the middle one, and deliberately borrows the third rather than inventing a
 * second personal color — a runner has exactly one identity color, and it is
 * the accent already stored on their profile.
 *
 * An icon is four indices (head, face, body, extra) into fixed shape
 * libraries, so the stored form is a short opaque code the database can
 * validate with a regular expression and every client can draw offline. It is
 * account-level: one icon per STACK account, the same in every crew.
 *
 * Indices are tolerant on the way in, exactly as crew emblems are. A runner
 * whose icon was saved against a later library must still render on an older
 * client, so an unknown index degrades to that part's first shape rather than
 * throwing.
 */

export type RunnerIconPart = "head" | "face" | "body" | "extra";

export interface RunnerIcon {
  head: number;
  face: number;
  body: number;
  extra: number;
}

export interface RunnerIconShape {
  name: string;
  /** Filled plates, drawn in the runner's accent color (or ink for `extra`). */
  plates: readonly string[];
  /** Holes punched through the plates above, drawn in ink. */
  cuts?: readonly string[];
  /**
   * Retired from the editor and Surprise Me, but the index stays put so a
   * runner who already saved this shape keeps decoding and drawing it.
   */
  deprecated?: boolean;
}

export const RUNNER_ICON_PARTS: readonly RunnerIconPart[] = ["head", "face", "body", "extra"];

export const RUNNER_ICON_PART_LABEL: Record<RunnerIconPart, string> = {
  head: "Head",
  face: "Face",
  body: "Body",
  extra: "Extra",
};

/**
 * The icon's own coordinate space, shared by every size it is drawn at.
 *
 * The figure runs x 27–73 and y 16–97; the box widens to the right because
 * the side extras (bolt, sweat, star) hang off that shoulder. One box for all
 * four parts means a runner's icon is the same size with or without an extra,
 * so a roster of icons never jitters between rows.
 */
export const RUNNER_ICON_VIEW_BOX = "20 12 72 90";
export const RUNNER_ICON_VIEW_BOX_WIDTH = 72;
export const RUNNER_ICON_VIEW_BOX_HEIGHT = 90;

/**
 * The head sits above the face with a deliberate seam at y 35–41, and the
 * body below one at y 65–70. Those gaps are what make the mark read as a
 * stacked totem rather than a single silhouette, and they survive at 32px
 * where almost no interior detail does.
 */
const HEADS: readonly RunnerIconShape[] = [
  // Each head is a different silhouette, not a different detail on the same
  // one: a boxy crown, a bare flared brim, a tall spike, twin peaks, a thin
  // band, a one-sided wedge. Two heads that differ only in trim would be the
  // same head at the size this mark is actually used.
  {
    name: "Flat Cap",
    plates: ["M28 26 H76 V35 H28 Z", "M37 15 H67 V26 H37 Z"],
  },
  {
    name: "Visor",
    plates: ["M26 35 L30 26 H74 L78 35 Z"],
  },
  {
    name: "Center Step",
    plates: ["M31 27 H73 V35 H31 Z", "M46 14 H58 V27 H46 Z"],
  },
  {
    name: "Twin Peak",
    plates: ["M30 35 H74 V22 L64 30 L52 15 L40 30 L30 22 Z"],
  },
  {
    name: "Headband",
    plates: ["M30 29 H74 V35 H30 Z", "M64 27 L79 20 L76 31 Z"],
  },
  {
    name: "Slant Cap",
    plates: ["M30 35 V29 L74 16 V35 Z"],
  },
];

/**
 * Every face is the same plate with different holes in it. The plate is the
 * part of the mark that carries the accent color at small sizes, so it stays
 * constant and the cut pattern does the identifying.
 */
const FACE_PLATE =
  "M34 41 H70 A3 3 0 0 1 73 44 V62 A3 3 0 0 1 70 65 H34 A3 3 0 0 1 31 62 V44 A3 3 0 0 1 34 41 Z";

const FACES: readonly RunnerIconShape[] = [
  {
    name: "Two Slots",
    plates: [FACE_PLATE],
    cuts: ["M38 48 H47 V55 H38 Z", "M57 48 H66 V55 H57 Z"],
  },
  {
    name: "Shades",
    plates: [FACE_PLATE],
    cuts: ["M35 47 H49 V56 H35 Z", "M55 47 H69 V56 H55 Z", "M49 50 H55 V53 H49 Z"],
  },
  {
    name: "Single Slot",
    plates: [FACE_PLATE],
    cuts: ["M39 49 H65 V56 H39 Z"],
  },
  {
    name: "One Eye",
    plates: [FACE_PLATE],
    cuts: ["M46 53 A6 6 0 0 1 58 53 A6 6 0 0 1 46 53 Z"],
  },
  {
    name: "Chevron",
    plates: [FACE_PLATE],
    cuts: ["M39 46 L52 55 L65 46 L65 53 L52 62 L39 53 Z"],
  },
  {
    name: "Blank",
    plates: [FACE_PLATE],
  },
];

const BODIES: readonly RunnerIconShape[] = [
  {
    // The plainest option on purpose: a runner who wants the mark to be all
    // head and face should be able to choose a body that says nothing.
    name: "Flat Base",
    plates: ["M31 70 H73 V95 H31 Z"],
  },
  {
    name: "Clipped Base",
    plates: ["M31 70 H73 V86 L66 93 H38 L31 86 Z"],
  },
  {
    name: "Wide Foot",
    plates: ["M34 70 H70 V86 H77 V94 H27 V86 H34 Z"],
  },
  {
    name: "Center Tab",
    plates: ["M31 70 H73 V89 H59 V96 H45 V89 H31 Z"],
  },
  {
    name: "Split Foot",
    plates: ["M31 70 H73 V88 H60 V96 H45 V88 H31 Z"],
    cuts: ["M49 86 H55 V96 H49 Z"],
  },
  {
    name: "Short Point",
    plates: ["M31 70 H73 V87 L52 97 L31 87 Z"],
  },
];

/**
 * Extras are drawn in the mark color rather than the accent, so they read as
 * applied hardware instead of another slab of the runner's color. They are
 * the one part that is honestly a large-size detail — at 32px an extra is a
 * few bright pixels, which is why it is never the thing distinguishing two
 * runners on its own.
 */
const EXTRAS: readonly RunnerIconShape[] = [
  { name: "None", plates: [] },
  // Widened and squared off from the first pass: a bolt is only a bolt if its
  // strokes survive at ~10px, and the original's thin waist did not.
  { name: "Bolt", plates: ["M78 42 H89 L83 54 H91 L73 74 L78 58 H70 Z"] },
  // A rounder, larger drop. The first pass's narrow teardrop read as a smudge
  // once the icon dropped under about 30px.
  { name: "Sweat", plates: ["M81 40 C87 51 90 55 90 60 A9 9 0 0 1 72 60 C72 55 75 51 81 40 Z"] },
  // Was a 5px pinstripe across the chest — invisible at crew size. Now a band
  // deep enough to register as a band.
  { name: "Band", plates: ["M33 73 H71 V83 H33 Z"] },
  {
    // Retired: a thin vertical rule at the silhouette's left edge, which at
    // real size was indistinguishable from the icon's own outline. The index
    // stays put so anyone who saved it keeps decoding and drawing it.
    name: "Side Stripe",
    plates: ["M27 45 H32 V80 H27 Z"],
    deprecated: true,
  },
  {
    name: "Star",
    plates: ["M81 42 L84 49 L91.5 49.5 L85.8 54.4 L87.6 61.7 L81 57.8 L74.4 61.7 L76.2 54.4 L70.5 49.5 L78 49 Z"],
  },
  {
    // Four points on a tall axis, kept deliberately thick-waisted. A slender
    // sparkle looked right at 90px and vanished at 26px, where thin diagonal
    // arms carry almost no area; this reads as a bright four-point mark all
    // the way down, and its symmetry keeps it distinct from the five-point
    // Star above it.
    name: "Spark",
    plates: ["M82 42 L86 50 L91 54 L86 58 L82 66 L78 58 L73 54 L78 50 Z"],
  },
];

export const RUNNER_ICON_SHAPES: Record<RunnerIconPart, readonly RunnerIconShape[]> = {
  head: HEADS,
  face: FACES,
  body: BODIES,
  extra: EXTRAS,
};

/** An index this library does not have draws as that part's first option. */
function readIndex(raw: number, count: number): number {
  return Number.isInteger(raw) && raw >= 0 && raw < count ? raw : 0;
}

function shapeCount(part: RunnerIconPart): number {
  return RUNNER_ICON_SHAPES[part].length;
}

function isDeprecated(part: RunnerIconPart, index: number): boolean {
  return RUNNER_ICON_SHAPES[part][index]?.deprecated ?? false;
}

/**
 * Indices the editor and Surprise Me may reach — every index except the ones
 * retired via `deprecated`. Retired options stay addressable so a saved icon
 * still decodes and draws; they just stop being reachable by cycling.
 */
function availableIndices(part: RunnerIconPart): readonly number[] {
  const indices: number[] = [];
  for (let index = 0; index < shapeCount(part); index += 1) {
    if (!isDeprecated(part, index)) indices.push(index);
  }
  return indices;
}

/**
 * The indices the editor and Surprise Me will actually offer for a part.
 * Retired options are absent here but still decode and draw.
 */
export function selectableRunnerIconIndices(part: RunnerIconPart): readonly number[] {
  return availableIndices(part);
}

export function runnerIconShape(part: RunnerIconPart, index: number): RunnerIconShape {
  return RUNNER_ICON_SHAPES[part][readIndex(index, shapeCount(part))];
}

export function runnerIconPartName(part: RunnerIconPart, index: number): string {
  return runnerIconShape(part, index).name;
}

export function runnerIconOptionCount(part: RunnerIconPart): number {
  return shapeCount(part);
}

/**
 * Steps one part forward or backward through its options, wrapping. Retired
 * shapes are skipped in both directions, so a runner sitting on one from a
 * legacy save steps straight to the nearest live option.
 */
export function cycleRunnerIconPart(
  icon: RunnerIcon,
  part: RunnerIconPart,
  direction: 1 | -1,
): RunnerIcon {
  const count = shapeCount(part);
  let next = readIndex(icon[part], count);
  for (let step = 0; step < count; step += 1) {
    next = (next + direction + count) % count;
    if (!isDeprecated(part, next)) break;
  }
  return { ...icon, [part]: next };
}

const RUNNER_ICON_CODE_PATTERN = /^R1-\d{1,2}\.\d{1,2}\.\d{1,2}\.\d{1,2}$/;

/**
 * The stored form: `R1-<head>.<face>.<body>.<extra>`.
 *
 * No color rides along on purpose. The runner's color is their member accent
 * on `profiles.accent_color`, and duplicating it here is exactly how an icon
 * ends up one color while the same runner's Crew Build blocks are another.
 */
export function encodeRunnerIcon(icon: RunnerIcon): string {
  const parts = RUNNER_ICON_PARTS.map((part) => readIndex(icon[part], shapeCount(part)));
  return `R1-${parts.join(".")}`;
}

/** Parses a stored code, or null when it is absent or not an icon at all. */
export function decodeRunnerIcon(value: unknown): RunnerIcon | null {
  if (typeof value !== "string" || !RUNNER_ICON_CODE_PATTERN.test(value)) return null;
  const parts = value.slice(3).split(".").map(Number);
  const [head, face, body, extra] = parts;
  return {
    head: readIndex(head, shapeCount("head")),
    face: readIndex(face, shapeCount("face")),
    body: readIndex(body, shapeCount("body")),
    extra: readIndex(extra, shapeCount("extra")),
  };
}

function hashOf(seed: string): number {
  let hash = 2166136261;
  for (const character of seed) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/**
 * A stable icon for a runner who has never built one.
 *
 * Every account that predates this feature still needs a mark, and it has to
 * be the same mark on every device and in every crewmate's roster, so it is
 * derived from the user id rather than stored or randomized. The default is
 * never a placeholder shown next to "real" icons — it is drawn from the same
 * library, so an uncustomized runner simply has an icon they did not pick.
 */
export function runnerIconFromSeed(seed: string): RunnerIcon {
  const hash = hashOf(seed);
  const pick = (part: RunnerIconPart, divisor: number): number => {
    const indices = availableIndices(part);
    return indices[Math.floor(hash / divisor) % indices.length];
  };
  return {
    head: pick("head", 7),
    face: pick("face", 53),
    body: pick("body", 389),
    // Defaults stay quiet: an icon nobody chose does not also wear a bolt.
    extra: 0,
  };
}

/** The icon to draw for a runner: what they saved, or their derived mark. */
export function resolveRunnerIcon(stored: unknown, seed: string): RunnerIcon {
  return decodeRunnerIcon(stored) ?? runnerIconFromSeed(seed);
}

/** Surprise Me: valid random parts, no generative anything. */
export function randomRunnerIcon(random: () => number = Math.random): RunnerIcon {
  const pick = (part: RunnerIconPart): number => {
    const indices = availableIndices(part);
    return indices[Math.floor(random() * indices.length)];
  };
  return {
    head: pick("head"),
    face: pick("face"),
    body: pick("body"),
    extra: pick("extra"),
  };
}

/** Two icons are the same icon when they encode to the same code. */
export function sameRunnerIcon(left: RunnerIcon, right: RunnerIcon): boolean {
  return encodeRunnerIcon(left) === encodeRunnerIcon(right);
}
