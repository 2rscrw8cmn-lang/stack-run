/**
 * Crew emblems — the modular insignia a crew designs for itself.
 *
 * An emblem is four stacked decisions (top, middle, base, frame), each a
 * shape index plus a color index, so the whole identity is a short opaque
 * code the database can validate with a regular expression and every client
 * can render offline. Nothing here is personal: an emblem describes a crew,
 * never a runner or a run.
 *
 * Indices are deliberately tolerant on the way in. A crew built on a later
 * shape library must still render on an older client, so an unknown index
 * degrades to the first shape of that section rather than throwing.
 */

export type CrewEmblemSection = "top" | "middle" | "bottom" | "frame";

export interface CrewEmblemPiece {
  shape: number;
  color: number;
}

export interface CrewEmblem {
  top: CrewEmblemPiece;
  middle: CrewEmblemPiece;
  bottom: CrewEmblemPiece;
  frame: CrewEmblemPiece;
}

export interface CrewEmblemShape {
  name: string;
  d: string;
  /** Shapes with cut-outs need even-odd so the holes read as holes. */
  rule?: "evenodd";
}

export interface CrewEmblemFrame {
  name: string;
  /** Empty for the frameless option. */
  d: string;
  inkWidth: number;
  colorWidth: number;
  linecap?: "square";
}

export interface CrewEmblemColor {
  name: string;
  value: string;
}

export const CREW_EMBLEM_SECTIONS: readonly CrewEmblemSection[] = [
  "top",
  "middle",
  "bottom",
  "frame",
];

export const CREW_EMBLEM_BODY_SECTIONS: readonly Exclude<CrewEmblemSection, "frame">[] = [
  "top",
  "middle",
  "bottom",
];

export const CREW_EMBLEM_SECTION_LABEL: Record<CrewEmblemSection, string> = {
  top: "Crown",
  middle: "Core",
  bottom: "Base",
  frame: "Frame",
};

/**
 * The emblem's own coordinate space, shared by every size it is drawn at.
 *
 * The body occupies x 24–156 and the frames overhang it on both sides; the
 * box is exactly wide enough for the widest of them, so the mark never
 * shrinks to leave room for margin it does not use. One box for all frames
 * also means a crew's emblem is the same size with or without one.
 */
export const CREW_EMBLEM_VIEW_BOX = "-20 -4 220 228";
export const CREW_EMBLEM_VIEW_BOX_WIDTH = 220;
export const CREW_EMBLEM_VIEW_BOX_HEIGHT = 228;

/** Near-black outline and seam shadow, dark enough to hold on any surface. */
export const CREW_EMBLEM_INK = "#03070a";
export const CREW_EMBLEM_SEAM = "#101b24";

/**
 * Five colors, drawn from the product palette rather than invented for this
 * feature. They are crew colors, not member accents: a crew emblem answers
 * "which crew", the 16 member accents answer "which runner", and the two
 * scales must never be mistaken for each other.
 */
export const CREW_EMBLEM_COLORS: readonly CrewEmblemColor[] = [
  { name: "Lime", value: "#a6ff1a" },
  { name: "Blue", value: "#287dff" },
  { name: "Gold", value: "#ffd21a" },
  { name: "Violet", value: "#a14cff" },
  { name: "White", value: "#f6f7f8" },
];

export const CREW_EMBLEM_SHAPES: Record<
  Exclude<CrewEmblemSection, "frame">,
  readonly CrewEmblemShape[]
> = {
  top: [
    { name: "Flat Cap", d: "M24 66 L24 42 L48 42 L48 30 L132 30 L132 42 L156 42 L156 66 Z" },
    {
      name: "Stepped Crown",
      d: "M28 68 L28 52 L48 52 L48 38 L68 38 L68 25 L112 25 L112 38 L132 38 L132 52 L152 52 L152 68 Z",
    },
    { name: "Twin Peak", d: "M24 68 L34 40 L56 28 L70 51 L110 51 L124 28 L146 40 L156 68 Z" },
    { name: "Dome", d: "M24 68 L24 56 Q24 28 52 28 L128 28 Q156 28 156 56 L156 68 Z" },
    { name: "Point", d: "M25 68 L25 56 L70 56 L90 22 L110 56 L155 56 L155 68 Z" },
    { name: "Offset", d: "M25 68 L25 45 L58 45 L58 27 L106 27 L106 39 L155 39 L155 68 Z" },
  ],
  middle: [
    {
      name: "Two Slots",
      d: "M25 78 H155 V132 H25 Z M49 94 H72 V116 H49 Z M108 94 H131 V116 H108 Z",
      rule: "evenodd",
    },
    {
      name: "Center Diamond",
      d: "M25 78 H155 V132 H25 Z M90 90 L107 105 L90 120 L73 105 Z",
      rule: "evenodd",
    },
    {
      name: "Hollow Center",
      d: "M25 78 H155 V132 H25 Z M56 92 H124 V118 H56 Z",
      rule: "evenodd",
    },
    { name: "Chamfer Band", d: "M38 78 H142 L155 91 V119 L142 132 H38 L25 119 V91 Z" },
    { name: "Chevron", d: "M25 78 H155 V96 L90 132 L25 96 Z" },
    { name: "Center Spine", d: "M25 78 H155 V94 H106 V132 H74 V94 H25 Z" },
  ],
  bottom: [
    { name: "Flat Base", d: "M25 144 H155 V184 H143 V195 H37 V184 H25 Z" },
    { name: "Shallow V", d: "M25 144 H155 V174 L90 203 L25 174 Z" },
    { name: "Double Foot", d: "M25 144 H155 V176 H130 V198 H102 V176 H78 V198 H50 V176 H25 Z" },
    { name: "Stepped Base", d: "M25 144 H155 V168 H140 V184 H120 V198 H60 V184 H40 V168 H25 Z" },
    { name: "Rounded Base", d: "M25 144 H155 V170 Q155 198 126 198 H54 Q25 198 25 170 Z" },
    { name: "Split Base", d: "M25 144 H155 V178 H116 L104 199 H76 L64 178 H25 Z" },
  ],
};

/**
 * Frames sit outside the body and widen the silhouette. The side frames are
 * centered on the core band (y 78–132, center 105) rather than the drawing's
 * vertical middle, so the emblem never looks four pixels heavy at the top.
 */
export const CREW_EMBLEM_FRAMES: readonly CrewEmblemFrame[] = [
  { name: "None", d: "", inkWidth: 0, colorWidth: 0 },
  {
    name: "Open Brackets",
    d: "M-4 48 V13 H35 M145 13 H184 V48 M-4 165 V205 H35 M145 205 H184 V165",
    inkWidth: 11,
    colorWidth: 7,
  },
  {
    name: "Side Rails",
    d: "M-2 43 V174 L18 204 M182 43 V174 L162 204",
    inkWidth: 12,
    colorWidth: 7,
    linecap: "square",
  },
  {
    name: "Shoulder Tabs",
    d: "M30 84 H8 V98 H-10 V112 H8 V126 H30 M150 84 H172 V98 H190 V112 H172 V126 H150",
    inkWidth: 16,
    colorWidth: 10,
  },
  {
    name: "Outriggers",
    d: "M30 79 H10 V91 H-8 V119 H14 V131 H34 M150 79 H170 V91 H188 V119 H166 V131 H146",
    inkWidth: 14,
    colorWidth: 8,
  },
  {
    name: "Heavy Keyline",
    d: "M-8 8 H188 V184 L158 214 H22 L-8 184 Z",
    inkWidth: 14,
    colorWidth: 8,
  },
];

export interface CrewEmblemPreset {
  name: string;
  emblem: CrewEmblem;
}

function piece(shape: number, color: number): CrewEmblemPiece {
  return { shape, color };
}

export const CREW_EMBLEM_PRESETS: readonly CrewEmblemPreset[] = [
  {
    name: "CLEAN",
    emblem: { top: piece(0, 4), middle: piece(3, 4), bottom: piece(0, 4), frame: piece(1, 0) },
  },
  {
    name: "HEAVY",
    emblem: { top: piece(1, 2), middle: piece(5, 1), bottom: piece(3, 3), frame: piece(5, 4) },
  },
  {
    name: "ARCADE",
    emblem: { top: piece(3, 2), middle: piece(1, 1), bottom: piece(1, 3), frame: piece(3, 4) },
  },
  {
    name: "TOTEM",
    emblem: { top: piece(4, 0), middle: piece(0, 4), bottom: piece(5, 0), frame: piece(2, 1) },
  },
  {
    name: "WIDE",
    emblem: { top: piece(5, 1), middle: piece(2, 2), bottom: piece(3, 3), frame: piece(4, 4) },
  },
];

/** Color recipes that stay legible at the 24 px sizes Crew actually uses. */
const CURATED_COLOR_RECIPES: ReadonlyArray<readonly [number, number, number, number]> = [
  [4, 4, 4, 0],
  [2, 1, 3, 4],
  [0, 4, 0, 1],
  [1, 1, 3, 4],
  [3, 2, 3, 4],
  [4, 1, 4, 0],
  [2, 4, 1, 4],
];

export const DEFAULT_CREW_EMBLEM: CrewEmblem = {
  top: piece(1, 4),
  middle: piece(3, 0),
  bottom: piece(0, 4),
  frame: piece(1, 0),
};

function shapeCount(section: CrewEmblemSection): number {
  return section === "frame"
    ? CREW_EMBLEM_FRAMES.length
    : CREW_EMBLEM_SHAPES[section].length;
}

/** An index this library does not have renders as that section's first option. */
function readIndex(raw: number, count: number): number {
  return Number.isInteger(raw) && raw >= 0 && raw < count ? raw : 0;
}

export function shapeOptionCount(section: CrewEmblemSection): number {
  return shapeCount(section);
}

export function shapeName(section: CrewEmblemSection, index: number): string {
  return section === "frame"
    ? CREW_EMBLEM_FRAMES[readIndex(index, CREW_EMBLEM_FRAMES.length)].name
    : CREW_EMBLEM_SHAPES[section][readIndex(index, CREW_EMBLEM_SHAPES[section].length)].name;
}

export function crewEmblemColor(index: number): CrewEmblemColor {
  return CREW_EMBLEM_COLORS[readIndex(index, CREW_EMBLEM_COLORS.length)];
}

/** Steps one section forward or backward through its options, wrapping. */
export function cycleEmblemShape(
  emblem: CrewEmblem,
  section: CrewEmblemSection,
  direction: 1 | -1,
): CrewEmblem {
  const count = shapeCount(section);
  const current = readIndex(emblem[section].shape, count);
  return {
    ...emblem,
    [section]: { ...emblem[section], shape: (current + direction + count) % count },
  };
}

export function setEmblemColor(
  emblem: CrewEmblem,
  section: CrewEmblemSection,
  color: number,
): CrewEmblem {
  return {
    ...emblem,
    [section]: {
      ...emblem[section],
      color: readIndex(color, CREW_EMBLEM_COLORS.length),
    },
  };
}

const EMBLEM_CODE_PATTERN = /^E1-\d{1,2}\.\d{1,2}-\d{1,2}\.\d{1,2}-\d{1,2}\.\d{1,2}-\d{1,2}\.\d{1,2}$/;

/**
 * The stored form: `E1-<top>-<middle>-<bottom>-<frame>`, each `shape.color`.
 *
 * Short, human-inspectable, and cheap for the database to validate — the
 * `crews.emblem` check constraint is this same pattern.
 */
export function encodeCrewEmblem(emblem: CrewEmblem): string {
  const parts = CREW_EMBLEM_SECTIONS.map((section) => {
    const value = emblem[section];
    const shape = readIndex(value.shape, shapeCount(section));
    const color = readIndex(value.color, CREW_EMBLEM_COLORS.length);
    return `${shape}.${color}`;
  });
  return `E1-${parts.join("-")}`;
}

/** Parses a stored code, or null when it is absent or not an emblem at all. */
export function decodeCrewEmblem(value: unknown): CrewEmblem | null {
  if (typeof value !== "string" || !EMBLEM_CODE_PATTERN.test(value)) return null;
  const parts = value.slice(3).split("-");
  const pieces = parts.map((part) => {
    const [shape, color] = part.split(".");
    return { shape: Number(shape), color: Number(color) };
  });
  const [top, middle, bottom, frame] = pieces;
  return {
    top: { shape: readIndex(top.shape, shapeCount("top")), color: readIndex(top.color, CREW_EMBLEM_COLORS.length) },
    middle: { shape: readIndex(middle.shape, shapeCount("middle")), color: readIndex(middle.color, CREW_EMBLEM_COLORS.length) },
    bottom: { shape: readIndex(bottom.shape, shapeCount("bottom")), color: readIndex(bottom.color, CREW_EMBLEM_COLORS.length) },
    frame: { shape: readIndex(frame.shape, shapeCount("frame")), color: readIndex(frame.color, CREW_EMBLEM_COLORS.length) },
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
 * A stable emblem for a crew that has never designed one.
 *
 * Crews created before emblems existed still need a mark, and it must be the
 * same mark on every device, so it is derived from the crew id rather than
 * stored or randomized.
 */
export function crewEmblemFromSeed(seed: string): CrewEmblem {
  const hash = hashOf(seed);
  const recipe = CURATED_COLOR_RECIPES[hash % CURATED_COLOR_RECIPES.length];
  return {
    top: piece(Math.floor(hash / 7) % shapeCount("top"), recipe[0]),
    middle: piece(Math.floor(hash / 53) % shapeCount("middle"), recipe[1]),
    bottom: piece(Math.floor(hash / 389) % shapeCount("bottom"), recipe[2]),
    frame: piece(Math.floor(hash / 2879) % shapeCount("frame"), recipe[3]),
  };
}

/**
 * The emblem to draw for a crew: what it saved, or its stable derived mark.
 */
export function resolveCrewEmblem(stored: unknown, seed: string): CrewEmblem {
  return decodeCrewEmblem(stored) ?? crewEmblemFromSeed(seed);
}

/**
 * A curated shuffle for the builder's Surprise Me.
 *
 * Colors come from the recipes rather than four independent picks, and the
 * busiest core is kept away from the widest frame, so a random emblem is
 * still a usable one at crew-card size.
 */
export function randomCrewEmblem(random: () => number = Math.random): CrewEmblem {
  const recipe = CURATED_COLOR_RECIPES[Math.floor(random() * CURATED_COLOR_RECIPES.length)];
  const frame = Math.floor(random() * shapeCount("frame"));
  let middle = Math.floor(random() * shapeCount("middle"));
  if (frame === 4 && middle === 0 && random() < 0.65) middle = 3;
  return {
    top: piece(Math.floor(random() * shapeCount("top")), recipe[0]),
    middle: piece(middle, recipe[1]),
    bottom: piece(Math.floor(random() * shapeCount("bottom")), recipe[2]),
    frame: piece(frame, recipe[3]),
  };
}

/** Two emblems are the same emblem when they encode to the same code. */
export function sameCrewEmblem(left: CrewEmblem, right: CrewEmblem): boolean {
  return encodeCrewEmblem(left) === encodeCrewEmblem(right);
}
