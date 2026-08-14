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
 * An icon is five indices (head, face, body, flair, background) into fixed
 * shape libraries, so the stored form is a short opaque code the database can
 * validate with a regular expression and every client can draw offline. It is
 * account-level: one icon per STACK account, the same in every crew.
 *
 * Indices are tolerant on the way in, exactly as crew emblems are. A runner
 * whose icon was saved against a later library must still render on an older
 * client, so an unknown index degrades to that part's first shape rather than
 * throwing.
 */

export type RunnerIconPart = "head" | "face" | "body" | "flair" | "background";

export interface RunnerIcon {
  head: number;
  face: number;
  body: number;
  flair: number;
  background: number;
}

export interface RunnerIconShape {
  name: string;
  /**
   * Filled plates: the runner's accent for the chassis parts, the mark tone
   * for `flair`, and the dark field with an accent edge for `background`.
   */
  plates: readonly string[];
  /** Holes punched through the plates above, drawn in ink. */
  cuts?: readonly string[];
  /**
   * Accent chips drawn back on top of a cut — the lit pupil inside a dark eye
   * socket. Always the last thing drawn for a part.
   */
  pips?: readonly string[];
  /**
   * Retired from the editor and Surprise Me, but the index stays put so a
   * runner who already saved this shape keeps decoding and drawing it.
   */
  deprecated?: boolean;
}

/** Code order, and the order the editor lists parts in. */
export const RUNNER_ICON_PARTS: readonly RunnerIconPart[] = [
  "head",
  "face",
  "body",
  "flair",
  "background",
];

/**
 * Paint order, which is not code order: the backdrop is behind the runner and
 * flair is in front of everything it touches.
 */
export const RUNNER_ICON_DRAW_ORDER: readonly RunnerIconPart[] = [
  "background",
  "head",
  "face",
  "body",
  "flair",
];

export const RUNNER_ICON_PART_LABEL: Record<RunnerIconPart, string> = {
  head: "Head",
  face: "Face",
  body: "Body",
  flair: "Flair",
  background: "Backdrop",
};

/**
 * The icon's own coordinate space, shared by every size it is drawn at.
 *
 * Square, because a backdrop is a badge and a badge is not lopsided. Inside
 * it every part is laid out against fixed landmarks rather than by eye, and
 * those landmarks are what make the library composable:
 *
 * - the chassis is x 30–70, so head, face and body always stack flush;
 * - the head sits above y 34, the face plate is exactly y 38–64, and every
 *   body's top twelve units are the full chassis width;
 * - anything drawn on the runner attaches to one of those edges;
 * - anything not drawn on the runner lives outside x 76 (or its mirror), so
 *   detached flair reads as detached instead of as a collision;
 * - the whole figure clears every backdrop's outline with room to spare.
 */
export const RUNNER_ICON_VIEW_BOX = "0 0 100 100";
export const RUNNER_ICON_VIEW_BOX_WIDTH = 100;
export const RUNNER_ICON_VIEW_BOX_HEIGHT = 100;

/**
 * Six silhouettes, not six trims on one silhouette: a boxy cap, a flared
 * visor, an antenna mast, twin peaks, side pods, a one-sided wedge. Two heads
 * that differ only in detail are the same head at the size this mark is
 * actually used. Each one meets the face plate at y 34, leaving the 4-unit
 * seam that makes the mark read as a stacked machine rather than a blob.
 */
const HEADS: readonly RunnerIconShape[] = [
  {
    name: "Flat Cap",
    plates: ["M32 28 H68 V34 H32 Z", "M40 16 H60 V28 H40 Z"],
  },
  {
    name: "Visor",
    plates: ["M30 34 L35 26 H65 L70 34 Z"],
  },
  {
    name: "Antenna",
    plates: ["M35 28 H65 V34 H35 Z", "M47 18 H53 V28 H47 Z", "M43 12 H57 V18 H43 Z"],
  },
  {
    name: "Twin Peak",
    plates: ["M32 34 H68 V20 L59 29 L50 14 L41 29 L32 20 Z"],
  },
  {
    name: "Side Lamps",
    plates: ["M35 28 H65 V34 H35 Z", "M26 18 H35 V30 H26 Z", "M65 18 H74 V30 H65 Z"],
  },
  {
    name: "Slant Cap",
    plates: ["M32 34 V26 L68 14 V34 Z"],
  },
];

/**
 * Every face is the same beveled plate with different holes in it. The plate
 * is the part of the mark that carries the accent color at small sizes, so it
 * stays constant and the cut pattern does the identifying — and because it
 * never moves, flair can attach to its edges exactly.
 */
const FACE_PLATE = "M34 38 H66 L70 42 V60 L66 64 H34 L30 60 V42 Z";

const FACES: readonly RunnerIconShape[] = [
  {
    name: "Two Slots",
    plates: [FACE_PLATE],
    cuts: ["M36 46 H47 V55 H36 Z", "M53 46 H64 V55 H53 Z"],
  },
  {
    name: "Visor Band",
    plates: [FACE_PLATE],
    cuts: ["M35 46 H65 V55 H35 Z"],
  },
  {
    // The single centered eye, lit: the socket is cut through the plate and
    // the pupil is the runner's color put back inside it.
    name: "One Eye",
    plates: [FACE_PLATE],
    cuts: ["M41 41 H59 V61 H41 Z"],
    pips: ["M46 47 H54 V55 H46 Z"],
  },
  {
    name: "Bot Eyes",
    plates: [FACE_PLATE],
    cuts: ["M36 44 H47 V57 H36 Z", "M53 44 H64 V57 H53 Z"],
    pips: ["M39 47 H44 V54 H39 Z", "M56 47 H61 V54 H56 Z"],
  },
  {
    name: "Scan",
    plates: [FACE_PLATE],
    cuts: ["M34 44 L50 54 L66 44 V51 L50 61 L34 51 Z"],
  },
  {
    name: "Grille",
    plates: [FACE_PLATE],
    cuts: ["M36 44 H64 V49 H36 Z", "M36 52 H64 V57 H36 Z"],
  },
];

/**
 * Every body is the full chassis width for its first twelve units, so the
 * chest band lands on all six identically and the seam under the face is
 * always the same seam. Below that they are free to differ.
 */
const BODIES: readonly RunnerIconShape[] = [
  {
    // The plainest option on purpose: a runner who wants the mark to be all
    // head and face should be able to choose a body that says nothing.
    name: "Flat Base",
    plates: ["M30 68 H70 V90 H30 Z"],
  },
  {
    name: "Clipped Base",
    plates: ["M30 68 H70 V82 L62 90 H38 L30 82 Z"],
  },
  {
    name: "Wide Foot",
    plates: ["M30 68 H70 V80 H74 V88 H26 V80 H30 Z"],
  },
  {
    name: "Split Foot",
    plates: ["M30 68 H70 V90 H57 V78 H43 V90 H30 Z"],
  },
  {
    name: "Center Tab",
    plates: ["M30 68 H70 V82 H58 V90 H42 V82 H30 Z"],
  },
  {
    name: "Short Point",
    plates: ["M30 68 H70 V80 L50 90 L30 80 Z"],
  },
];

/**
 * Flair is drawn in the mark tone rather than the accent, so it reads as
 * applied hardware instead of another slab of the runner's color.
 *
 * It splits cleanly in two, and the split is the whole reason this part
 * stopped looking accidental: a piece is either *on* the runner, in which
 * case it is flush against a landmark edge — pods on the face plate's sides,
 * a band across the chassis-width top of the body — or it is *off* the
 * runner, in which case it clears x 76 so there is honest space between the
 * runner and the mark. Nothing floats halfway.
 */
const FLAIR: readonly RunnerIconShape[] = [
  { name: "None", plates: [] },
  // Off the runner: a blocky bolt in the right channel, thick enough to
  // survive at ~10px, where the first pass's thin waist did not.
  { name: "Bolt", plates: ["M88 38 L78 52 H84 L80 66 L92 50 H86 Z"] },
  // On the runner: flush to the face plate's straight left and right edges,
  // centered on the plate.
  { name: "Ear Pods", plates: ["M24 44 H30 V58 H24 Z", "M70 44 H76 V58 H70 Z"] },
  // On the runner: the body's top is the chassis width on every body, so this
  // band lands identically no matter what is chosen below it.
  { name: "Chest Band", plates: ["M30 72 H70 V80 H30 Z"] },
  {
    // Retired: a thin vertical rule at the silhouette's left edge, which at
    // real size was indistinguishable from the icon's own outline. The index
    // stays put so anyone who saved it keeps decoding and drawing it.
    name: "Side Stripe",
    plates: ["M18 44 H26 V72 H18 Z"],
    deprecated: true,
  },
  // Off the runner: a four-point spark whose waist is cut in deep enough to
  // read as points rather than as a diamond, with its widest span exactly at
  // the vertical center — which is where every backdrop is widest too.
  {
    name: "Spark",
    plates: ["M84 40 L86 49 L93 51 L86 53 L84 62 L82 53 L75 51 L82 49 Z"],
  },
  // Off the runner, both sides, equidistant from the center line.
  { name: "Orbit", plates: ["M12 47 H22 V57 H12 Z", "M78 47 H88 V57 H78 Z"] },
];

/**
 * The backdrop: a badge plate behind the runner, drawn as a dark field with
 * an accent edge rather than an accent fill — a solid accent shape would
 * swallow the accent-colored runner standing on it.
 *
 * Every one of them clears the whole figure, including the widest head pods
 * and the widest foot, which is why the set has no needle-pointed diamond in
 * it: the shapes a runner can pick all have to hold the same runner.
 */
const BACKGROUNDS: readonly RunnerIconShape[] = [
  { name: "None", plates: [] },
  { name: "Disc", plates: ["M3 50 A47 47 0 1 0 97 50 A47 47 0 1 0 3 50 Z"] },
  { name: "Hex", plates: ["M28 4 H72 L96 50 L72 96 H28 L4 50 Z"] },
  { name: "Shield", plates: ["M6 6 H94 V60 L72 92 H28 L6 60 Z"] },
  { name: "Bevel Box", plates: ["M14 4 H86 L96 14 V86 L86 96 H14 L4 86 V14 Z"] },
  { name: "Arch", plates: ["M6 32 A44 28 0 0 1 94 32 V94 H6 Z"] },
];

export const RUNNER_ICON_SHAPES: Record<RunnerIconPart, readonly RunnerIconShape[]> = {
  head: HEADS,
  face: FACES,
  body: BODIES,
  flair: FLAIR,
  background: BACKGROUNDS,
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

/** Sets one part to a chosen option, leaving every other part alone. */
export function setRunnerIconPart(
  icon: RunnerIcon,
  part: RunnerIconPart,
  index: number,
): RunnerIcon {
  return { ...icon, [part]: readIndex(index, shapeCount(part)) };
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

const RUNNER_ICON_CODE_PATTERN = /^R2-\d{1,2}\.\d{1,2}\.\d{1,2}\.\d{1,2}\.\d{1,2}$/;
/** The four-part code shipped before backdrops existed. Still decodes. */
const RUNNER_ICON_V1_CODE_PATTERN = /^R1-\d{1,2}\.\d{1,2}\.\d{1,2}\.\d{1,2}$/;

/**
 * The stored form: `R2-<head>.<face>.<body>.<flair>.<background>`.
 *
 * No color rides along on purpose. The runner's color is their member accent
 * on `profiles.accent_color`, and duplicating it here is exactly how an icon
 * ends up one color while the same runner's Crew Build blocks are another.
 */
export function encodeRunnerIcon(icon: RunnerIcon): string {
  const parts = RUNNER_ICON_PARTS.map((part) => readIndex(icon[part], shapeCount(part)));
  return `R2-${parts.join(".")}`;
}

/**
 * Parses a stored code, or null when it is absent or not an icon at all.
 *
 * An `R1-` code is a runner who saved before backdrops existed: their four
 * choices are theirs and are kept, and the backdrop they never picked reads
 * as the empty one rather than as a shape chosen for them.
 */
export function decodeRunnerIcon(value: unknown): RunnerIcon | null {
  if (typeof value !== "string") return null;
  const isV1 = RUNNER_ICON_V1_CODE_PATTERN.test(value);
  if (!isV1 && !RUNNER_ICON_CODE_PATTERN.test(value)) return null;
  const [head, face, body, flair, background] = value.slice(3).split(".").map(Number);
  return {
    head: readIndex(head, shapeCount("head")),
    face: readIndex(face, shapeCount("face")),
    body: readIndex(body, shapeCount("body")),
    flair: readIndex(flair, shapeCount("flair")),
    background: isV1 ? 0 : readIndex(background, shapeCount("background")),
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
    // Defaults stay quiet: an icon nobody chose does not also wear a bolt or
    // stand on a badge.
    flair: 0,
    background: 0,
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
    flair: pick("flair"),
    background: pick("background"),
  };
}

/** Two icons are the same icon when they encode to the same code. */
export function sameRunnerIcon(left: RunnerIcon, right: RunnerIcon): boolean {
  return encodeRunnerIcon(left) === encodeRunnerIcon(right);
}
