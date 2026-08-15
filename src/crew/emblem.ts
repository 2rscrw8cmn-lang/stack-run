/**
 * Crew emblems — the combinatorial insignia a crew designs for itself.
 *
 * An emblem is three independently coloured layers, drawn back to front:
 *
 * - a **background** field the badge sits on (or none at all);
 * - a **secondary** accent that frames, underlines or haloes the mark;
 * - a **main** mark, the dominant symbol and the largest library.
 *
 * The whole identity is a short opaque code the database can validate with a
 * regular expression and every client can draw offline. Nothing here is
 * personal: an emblem describes a crew, never a runner or a run. A Runner Icon
 * answers *which person*; this answers *which crew*.
 *
 * Indices are deliberately tolerant on the way in. A crew built on a later
 * shape library must still render on an older client, so an unknown index
 * degrades to the first option of that layer rather than throwing — which for
 * the two optional layers is `None`, the one choice that can never look wrong.
 */

export type CrewEmblemLayer = "main" | "secondary" | "background";

export interface CrewEmblemPiece {
  shape: number;
  color: number;
}

export interface CrewEmblem {
  main: CrewEmblemPiece;
  secondary: CrewEmblemPiece;
  background: CrewEmblemPiece;
  /**
   * Whether the two foreground layers are inked.
   *
   * On, the mark and its accent are outlined and the mark carries a dropped
   * shadow — the arcade badge. Off, they are flat colour straight onto the
   * field, which is a different mark rather than a worse one, so it is a
   * crew's choice and rides along in the stored code.
   */
  outline: boolean;
}

export interface CrewEmblemShape {
  name: string;
  /** Empty for the `None` option of an optional layer. */
  d: string;
  /** Shapes with cut-outs need even-odd so the holes read as holes. */
  rule?: "evenodd";
}

export interface CrewEmblemColor {
  name: string;
  value: string;
}

/** Code order, and the order the builder lists the layers in. */
export const CREW_EMBLEM_LAYERS: readonly CrewEmblemLayer[] = [
  "main",
  "secondary",
  "background",
];

/**
 * Paint order, which is not code order: the field is behind everything and the
 * main mark is in front of everything, so the mark can never be obscured by a
 * choice made on another layer.
 */
export const CREW_EMBLEM_DRAW_ORDER: readonly CrewEmblemLayer[] = [
  "background",
  "secondary",
  "main",
];

export const CREW_EMBLEM_LAYER_LABEL: Record<CrewEmblemLayer, string> = {
  main: "Main mark",
  secondary: "Secondary",
  background: "Background",
};

/**
 * The emblem's own coordinate space, shared by every size it is drawn at.
 *
 * Square, because a badge is not lopsided, and 200 units so the whole library
 * can be written in whole numbers. Inside it three concentric budgets keep the
 * layers composable instead of merely stacked:
 *
 * - a **main** mark lives inside x/y 58–142, whose corners are 59 units from
 *   the centre — small enough that every background silhouette contains it;
 * - a **secondary** piece stays within 74 units of the centre, so it can reach
 *   past the mark on any side without leaving the field behind it;
 * - a **background** fills 4–196, and every silhouette in the library holds a
 *   78-unit disc, which is the widest a Main + Secondary pair can ever be.
 *
 * Those three numbers are the whole compatibility story: any combination of
 * the three libraries composes, and a new shape is safe if it respects the
 * budget for its layer.
 */
export const CREW_EMBLEM_VIEW_BOX = "0 0 200 200";
export const CREW_EMBLEM_VIEW_BOX_WIDTH = 200;
export const CREW_EMBLEM_VIEW_BOX_HEIGHT = 200;

export const CREW_EMBLEM_CENTER = 100;
/** Main marks are drawn inside this box. */
export const CREW_EMBLEM_MAIN_BOUNDS = { min: 58, max: 142 } as const;
/** Secondary pieces stay inside this radius of the centre. */
export const CREW_EMBLEM_SECONDARY_RADIUS = 74;
/** Background silhouettes are drawn inside this box. */
export const CREW_EMBLEM_BACKGROUND_BOUNDS = { min: 4, max: 196 } as const;
/** …and every one of them contains this much of the field around the centre. */
export const CREW_EMBLEM_BACKGROUND_CLEAR_RADIUS = 78;

/** Near-black outline, dark enough to separate any two layers on any surface. */
export const CREW_EMBLEM_INK = "#03070a";

/**
 * Eight crew colours: four light, four dark, none of them muddy at 24 px.
 *
 * They are crew colours, not member accents — a crew emblem answers "which
 * crew", the 16 member accents answer "which runner", and the two scales must
 * never be mistaken for each other. The split into light and dark tones is
 * what `Surprise Me` leans on to keep a random emblem readable.
 */
export const CREW_EMBLEM_COLORS: readonly CrewEmblemColor[] = [
  { name: "Lime", value: "#a6ff1a" },
  { name: "Blue", value: "#3d8bff" },
  { name: "Gold", value: "#ffd21a" },
  { name: "Violet", value: "#a14cff" },
  { name: "White", value: "#f6f7f8" },
  { name: "Ember", value: "#ff5a2b" },
  { name: "Teal", value: "#19d3c5" },
  { name: "Steel", value: "#7d94a3" },
];

/**
 * The main marks: the dominant symbol, and the reason two crews do not end up
 * with the same emblem by accident.
 *
 * Half of them are running and training marks — stride, tread, shoe, track,
 * lanes, finish, checker, stopwatch, split, route, peak, pace, pulse — and the
 * rest are the arcade/technical shapes STACK already speaks in. Every one is
 * drawn in this repository's own blocky language rather than borrowed, and
 * every one is built from whole-number straight edges (or the handful of cubic
 * arcs that make a circle) so it holds its shape down at header size.
 */
const MAIN_MARKS: readonly CrewEmblemShape[] = [
  {
    name: "Stride",
    d: [
      // A small round head clear of the shoulders. The first pass drew it big
      // enough for the leading arm to cross it, which read as a mask.
      "M110 58 C117.2 58 123 63.8 123 71 C123 78.2 117.2 84 110 84 C102.8 84 97 78.2 97 71 C97 63.8 102.8 58 110 58 Z",
      // Torso, then four limbs that each overlap it. The pairs are deliberately
      // asymmetric — leading arm and leg forward, trailing pair back — because
      // a figure with matching limbs on both sides is a jumping jack.
      "M92 86 H116 L104 116 H80 Z",
      "M106 88 L138 80 L142 94 L110 102 Z",
      "M86 92 L58 108 L64 120 L92 104 Z",
      "M96 110 H120 L138 132 L126 142 L104 124 Z",
      "M80 110 H100 L86 142 H62 Z",
    ].join(" "),
  },
  {
    name: "Podium",
    d: "M58 104 H82 V70 H118 V116 H142 V142 H58 Z",
  },
  {
    name: "Tread",
    d: [
      // An outsole, not a rectangle: the waist pinched at the arch is what
      // separates this from every other plate-with-slots in the library.
      "M100 58 Q138 58 138 88 Q138 102 128 110 Q120 118 120 130 Q120 142 100 142 Q80 142 80 130 Q80 118 72 110 Q62 102 62 88 Q62 58 100 58 Z",
      "M76 80 L100 70 L124 80 V90 L100 80 L76 90 Z",
      "M78 104 L100 94 L122 104 V114 L100 104 L78 114 Z",
      "M86 124 H114 V134 H86 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Shoe",
    d: [
      // Toe left, heel right, and the heel collar rounded rather than a tall
      // block — the square heel is what made the first pass read as a boot.
      "M58 122 V110 Q58 100 72 98 L100 92 L110 74 Q114 66 124 66 H130 Q142 66 142 82 V122 Z",
      "M58 122 H142 V136 H58 Z",
      "M96 100 H126 V108 H96 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Track",
    d: [
      "M96 74 H104 Q142 74 142 100 Q142 126 104 126 H96 Q58 126 58 100 Q58 74 96 74 Z",
      "M98 88 H102 Q124 88 124 100 Q124 112 102 112 H98 Q76 112 76 100 Q76 88 98 88 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Lanes",
    d: [
      "M58 58 H70 V142 H58 Z",
      "M76 66 H132 V82 H76 Z",
      "M76 92 H142 V108 H76 Z",
      "M76 118 H124 V134 H76 Z",
    ].join(" "),
  },
  {
    name: "Finish",
    d: [
      "M58 58 H70 V142 H58 Z",
      "M70 64 H142 V118 H70 Z",
      "M70 64 H88 V82 H70 Z",
      "M106 64 H124 V82 H106 Z",
      "M88 82 H106 V100 H88 Z",
      "M124 82 H142 V100 H124 Z",
      "M70 100 H88 V118 H70 Z",
      "M106 100 H124 V118 H106 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Checker",
    d: [
      "M60 60 H140 V140 H60 Z",
      "M80 60 H100 V80 H80 Z",
      "M120 60 H140 V80 H120 Z",
      "M60 80 H80 V100 H60 Z",
      "M100 80 H120 V100 H100 Z",
      "M80 100 H100 V120 H80 Z",
      "M120 100 H140 V120 H120 Z",
      "M60 120 H80 V140 H60 Z",
      "M100 120 H120 V140 H100 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Stopwatch",
    d: [
      // A crown wide enough to survive the outline, and hands thick enough to
      // still be hands once the whole mark is 24px across.
      "M86 58 H114 V74 H86 Z",
      "M100 74 C118.8 74 134 89.2 134 108 C134 126.8 118.8 142 100 142 C81.2 142 66 126.8 66 108 C66 89.2 81.2 74 100 74 Z",
      "M94 86 H106 V102 H94 Z",
      "M100 102 H126 V112 H100 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Split",
    d: [
      "M92 58 H108 V142 H92 Z",
      "M58 68 H84 V80 H58 Z",
      "M116 68 H142 V80 H116 Z",
      "M58 94 H84 V106 H58 Z",
      "M116 94 H142 V106 H116 Z",
      "M58 120 H84 V132 H58 Z",
      "M116 120 H142 V132 H116 Z",
    ].join(" "),
  },
  {
    name: "Route",
    d: [
      "M58 60 H142 V76 H58 Z",
      "M126 60 H142 V108 H126 Z",
      "M58 92 H142 V108 H58 Z",
      "M58 92 H74 V140 H58 Z",
      "M58 124 H142 V140 H58 Z",
    ].join(" "),
  },
  {
    name: "Peak",
    // One ridge, no ground bar: the bar overlapped the ridge's own outline and
    // drew a stack of stripes under the mountain.
    d: "M58 140 L86 76 L104 108 L120 72 L142 140 Z",
  },
  {
    name: "Pace",
    d: [
      "M58 62 H84 L112 100 L84 138 H58 L86 100 Z",
      "M100 62 H126 L142 100 L126 138 H100 L116 100 Z",
    ].join(" "),
  },
  { name: "Arrow", d: "M58 84 H104 V62 L142 100 L104 138 V116 H58 Z" },
  { name: "Bolt", d: "M110 58 L64 108 H92 L84 142 L136 88 H106 Z" },
  {
    name: "Flame",
    d: [
      "M100 58 C124 86 132 102 132 116 C132 133 118 142 100 142 C82 142 68 133 68 116 C68 102 76 86 100 58 Z",
      "M100 96 C112 112 116 118 116 125 C116 134 109 140 100 140 C91 140 84 134 84 125 C84 118 88 112 100 96 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Star",
    d: "M100 58 L111.2 88.6 L142 89.8 L117.6 109.4 L126.4 139.2 L100 121.4 L73.6 139.2 L82.4 109.4 L58 89.8 L88.8 88.6 Z",
  },
  {
    name: "Spark",
    d: "M100 58 L112 88 L142 100 L112 112 L100 142 L88 112 L58 100 L88 88 Z",
  },
  {
    name: "Target",
    d: [
      "M100 58 C123.2 58 142 76.8 142 100 C142 123.2 123.2 142 100 142 C76.8 142 58 123.2 58 100 C58 76.8 76.8 58 100 58 Z",
      "M100 70 C116.6 70 130 83.4 130 100 C130 116.6 116.6 130 100 130 C83.4 130 70 116.6 70 100 C70 83.4 83.4 70 100 70 Z",
      "M100 82 C110 82 118 90 118 100 C118 110 110 118 100 118 C90 118 82 110 82 100 C82 90 90 82 100 82 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Diamond",
    d: [
      "M100 58 L142 100 L100 142 L58 100 Z",
      "M100 78 L122 100 L100 122 L78 100 Z",
      "M100 90 L110 100 L100 110 L90 100 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Stack",
    d: ["M62 60 H138 V80 H62 Z", "M62 90 H118 V110 H62 Z", "M62 120 H142 V140 H62 Z"].join(" "),
  },
  {
    name: "Tower",
    d: [
      "M84 58 H116 V76 H84 Z",
      "M70 82 H130 V100 H70 Z",
      "M58 106 H142 V124 H58 Z",
      "M58 130 H142 V142 H58 Z",
    ].join(" "),
  },
  {
    name: "Grid",
    d: [
      "M60 60 H96 V96 H60 Z",
      "M104 60 H140 V96 H104 Z",
      "M60 104 H96 V140 H60 Z",
      "M104 104 H140 V140 H104 Z",
    ].join(" "),
  },
  {
    name: "Bars",
    d: [
      "M58 104 H76 V142 H58 Z",
      "M80 76 H98 V142 H80 Z",
      "M102 92 H120 V142 H102 Z",
      "M124 58 H142 V142 H124 Z",
    ].join(" "),
  },
  {
    name: "Crown",
    d: ["M58 120 H142 V140 H58 Z", "M58 62 L78 96 L100 62 L122 96 L142 62 V120 H58 Z"].join(" "),
  },
  {
    name: "Wing",
    d: [
      "M58 68 H130 L116 84 H58 Z",
      "M58 92 H142 L128 108 H58 Z",
      "M58 116 H118 L104 132 H58 Z",
    ].join(" "),
  },
  {
    name: "Pulse",
    d: [
      // Baseline, spike up, spike down, back to baseline. The first pass ran
      // off the bottom instead of returning, which read as a crossed bar.
      "M58 93 H88 V107 H58 Z",
      "M80 107 L90 60 L102 60 L94 107 Z",
      "M90 60 L102 60 L114 140 L102 140 Z",
      "M102 140 L112 100 L124 100 L114 140 Z",
      "M116 93 H142 V107 H116 Z",
    ].join(" "),
  },
  {
    name: "Hex Core",
    d: [
      "M100 58 L142 80 V120 L100 142 L58 120 V80 Z",
      "M100 76 L126 89 V111 L100 124 L74 111 V89 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Cross",
    d: "M84 58 H116 V84 H142 V116 H116 V142 H84 V116 H58 V84 H84 Z",
  },
];

/**
 * Secondary pieces: the accent that changes the character of a main mark.
 *
 * Each one either surrounds the mark (a ring, a halo, a burst — all drawn
 * behind it, so the mark stays the mark) or sits clear of the 58–142 main box
 * with deliberate space around it. Nothing lands two pixels off an edge,
 * because nothing is placed by eye: a piece is centred on the emblem's centre
 * or aligned to one of the main box's four sides.
 */
const SECONDARY_PIECES: readonly CrewEmblemShape[] = [
  { name: "None", d: "" },
  {
    name: "Ring",
    d: [
      "M100 32 C137.6 32 168 62.4 168 100 C168 137.6 137.6 168 100 168 C62.4 168 32 137.6 32 100 C32 62.4 62.4 32 100 32 Z",
      "M100 41 C132.6 41 159 67.4 159 100 C159 132.6 132.6 159 100 159 C67.4 159 41 132.6 41 100 C41 67.4 67.4 41 100 41 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Halo",
    d: [
      "M100 28 C139.8 28 172 60.2 172 100 C172 139.8 139.8 172 100 172 C60.2 172 28 139.8 28 100 C28 60.2 60.2 28 100 28 Z",
      "M100 40 C133.1 40 160 66.9 160 100 C160 133.1 133.1 160 100 160 C66.9 160 40 133.1 40 100 C40 66.9 66.9 40 100 40 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Orbit",
    d: [
      "M100 38 C134.2 38 162 65.8 162 100 C162 134.2 134.2 162 100 162 C65.8 162 38 134.2 38 100 C38 65.8 65.8 38 100 38 Z",
      "M100 44 C130.9 44 156 69.1 156 100 C156 130.9 130.9 156 100 156 C69.1 156 44 130.9 44 100 C44 69.1 69.1 44 100 44 Z",
      "M27 88 H37 V112 H27 Z",
      "M163 88 H173 V112 H163 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Burst",
    d: [
      "M92 28 H108 V54 H92 Z",
      "M92 146 H108 V172 H92 Z",
      "M28 92 H54 V108 H28 Z",
      "M146 92 H172 V108 H146 Z",
      "M136.7 128.3 L155.1 146.7 L146.7 155.1 L128.3 136.7 Z",
      "M63.3 128.3 L44.9 146.7 L53.3 155.1 L71.7 136.7 Z",
      "M136.7 71.7 L155.1 53.3 L146.7 44.9 L128.3 63.3 Z",
      "M63.3 71.7 L44.9 53.3 L53.3 44.9 L71.7 63.3 Z",
    ].join(" "),
  },
  {
    name: "Octa",
    d: [
      "M76 34 H124 L166 76 V124 L124 166 H76 L34 124 V76 Z",
      "M82 46 H118 L154 82 V118 L118 154 H82 L46 118 V82 Z",
    ].join(" "),
    rule: "evenodd",
  },
  {
    name: "Speed Lines",
    d: ["M34 76 H58 V90 H34 Z", "M28 94 H62 V108 H28 Z", "M34 112 H58 V126 H34 Z"].join(" "),
  },
  { name: "Crossbar", d: "M28 88 H172 V112 H28 Z" },
  {
    name: "Side Rails",
    d: ["M34 74 H48 V126 H34 Z", "M152 74 H166 V126 H152 Z"].join(" "),
  },
  {
    name: "Twin Tabs",
    d: ["M32 86 H50 V114 H32 Z", "M150 86 H168 V114 H150 Z"].join(" "),
  },
  {
    name: "Wings",
    d: ["M30 80 H64 L46 104 H30 Z", "M170 80 H136 L154 104 H170 Z"].join(" "),
  },
  { name: "Over Bar", d: "M62 42 H138 V54 H62 Z" },
  { name: "Under Stripe", d: "M62 146 H138 V158 H62 Z" },
  { name: "Peak", d: "M64 60 L100 42 L136 60 V50 L100 32 L64 50 Z" },
  { name: "Chevron", d: "M64 140 L100 158 L136 140 V150 L100 168 L64 150 Z" },
  {
    name: "Corner Ticks",
    d: [
      "M144 132 L156 144 L144 156 L132 144 Z",
      "M56 132 L68 144 L56 156 L44 144 Z",
      "M144 44 L156 56 L144 68 L132 56 Z",
      "M56 44 L68 56 L56 68 L44 56 Z",
    ].join(" "),
  },
];

/**
 * Background fields: the badge silhouette the two foreground layers sit on.
 *
 * Every one of them holds a 76-unit disc around the centre, which is what
 * makes the three libraries free to combine — the widest secondary piece still
 * lands inside the narrowest field. That is why there is no needle-pointed
 * diamond or deep swallowtail here: the shapes a crew can pick all have to
 * hold the same mark.
 */
const BACKGROUND_FIELDS: readonly CrewEmblemShape[] = [
  { name: "None", d: "" },
  {
    name: "Roundel",
    d: "M100 6 C151.9 6 194 48.1 194 100 C194 151.9 151.9 194 100 194 C48.1 194 6 151.9 6 100 C6 48.1 48.1 6 100 6 Z",
  },
  { name: "Hex", d: "M46 14 H154 L192 100 L154 186 H46 L8 100 Z" },
  { name: "Shield", d: "M8 8 H192 V138 L100 194 L8 138 Z" },
  { name: "Clipped Square", d: "M56 6 H144 L194 56 V144 L144 194 H56 L6 144 V56 Z" },
  { name: "Broad Diamond", d: "M100 6 L184 58 V142 L100 194 L16 142 V58 Z" },
  {
    name: "Track Oval",
    d: "M84 22 H116 Q186 22 186 100 Q186 178 116 178 H84 Q14 178 14 100 Q14 22 84 22 Z",
  },
  { name: "Banner", d: "M10 6 H190 V178 L146 194 L100 178 L54 194 L10 178 Z" },
  {
    name: "Plate",
    d: "M6 30 H30 V6 H170 V30 H194 V170 H170 V194 H30 V170 H6 Z",
  },
  { name: "Arch", d: "M6 60 Q6 6 100 6 Q194 6 194 60 V194 H6 Z" },
  { name: "Chevron Plate", d: "M40 12 H160 L194 100 L160 188 H40 L6 100 Z" },
  { name: "Bevel Box", d: "M28 6 H172 L194 28 V172 L172 194 H28 L6 172 V28 Z" },
  {
    name: "Soft Square",
    d: "M40 6 H160 Q194 6 194 40 V160 Q194 194 160 194 H40 Q6 194 6 160 V40 Q6 6 40 6 Z",
  },
];

export const CREW_EMBLEM_SHAPES: Record<CrewEmblemLayer, readonly CrewEmblemShape[]> = {
  main: MAIN_MARKS,
  secondary: SECONDARY_PIECES,
  background: BACKGROUND_FIELDS,
};

/**
 * A neutral emblem for a crew that has never designed one.
 *
 * Deliberately one fixed mark rather than something derived from the crew id:
 * an emblem is a decision a crew makes, and a randomly assembled stand-in
 * reads as a decision that was already made for them. This is the STACK block
 * mark on a plain field, and it says "not chosen yet" without looking broken.
 */
function indexOfShape(layer: CrewEmblemLayer, name: string): number {
  const index = CREW_EMBLEM_SHAPES[layer].findIndex((shape) => shape.name === name);
  return index < 0 ? 0 : index;
}

export const DEFAULT_CREW_EMBLEM: CrewEmblem = {
  main: { shape: indexOfShape("main", "Stack"), color: 0 },
  secondary: { shape: 0, color: 4 },
  background: { shape: indexOfShape("background", "Hex"), color: 7 },
  outline: true,
};

function shapeCount(layer: CrewEmblemLayer): number {
  return CREW_EMBLEM_SHAPES[layer].length;
}

/** An index this library does not have draws as that layer's first option. */
function readIndex(raw: number, count: number): number {
  return Number.isInteger(raw) && raw >= 0 && raw < count ? raw : 0;
}

export function crewEmblemShape(layer: CrewEmblemLayer, index: number): CrewEmblemShape {
  return CREW_EMBLEM_SHAPES[layer][readIndex(index, shapeCount(layer))];
}

export function crewEmblemShapeName(layer: CrewEmblemLayer, index: number): string {
  return crewEmblemShape(layer, index).name;
}

export function crewEmblemOptionCount(layer: CrewEmblemLayer): number {
  return shapeCount(layer);
}

/** Every index the builder and `Surprise Me` may offer for a layer. */
export function crewEmblemShapeIndices(layer: CrewEmblemLayer): readonly number[] {
  return CREW_EMBLEM_SHAPES[layer].map((_, index) => index);
}

export function crewEmblemColor(index: number): CrewEmblemColor {
  return CREW_EMBLEM_COLORS[readIndex(index, CREW_EMBLEM_COLORS.length)];
}

/** Sets one layer's shape, leaving every other layer alone. */
export function setCrewEmblemShape(
  emblem: CrewEmblem,
  layer: CrewEmblemLayer,
  shape: number,
): CrewEmblem {
  return { ...emblem, [layer]: { ...emblem[layer], shape: readIndex(shape, shapeCount(layer)) } };
}

/** Sets one layer's colour, leaving every other layer alone. */
export function setCrewEmblemColor(
  emblem: CrewEmblem,
  layer: CrewEmblemLayer,
  color: number,
): CrewEmblem {
  return {
    ...emblem,
    [layer]: { ...emblem[layer], color: readIndex(color, CREW_EMBLEM_COLORS.length) },
  };
}

/** Sets the ink style, leaving every layer alone. */
export function setCrewEmblemOutline(emblem: CrewEmblem, outline: boolean): CrewEmblem {
  return { ...emblem, outline };
}

/**
 * The stored form: `E2-<main>-<secondary>-<background>-<style>`, each layer
 * written `shape.color` and the style a single digit.
 *
 * Short, human-inspectable, and cheap for the database to validate — the
 * `crews.emblem` check constraint is this same pattern. Three digits of shape
 * are allowed so this library can grow to any size a person would actually
 * scroll through without needing another migration.
 *
 * The style group is optional on the way in, which is how the codes saved
 * before the ink style existed keep their meaning: no group is the inked
 * emblem those crews designed.
 */
const EMBLEM_CODE_PATTERN =
  /^E2-\d{1,3}\.\d{1,2}-\d{1,3}\.\d{1,2}-\d{1,3}\.\d{1,2}(?:-\d{1,2})?$/;

/** Style digits. Anything else fails soft to the inked default. */
const STYLE_OUTLINED = 0;
const STYLE_CLEAN = 1;

export function encodeCrewEmblem(emblem: CrewEmblem): string {
  const parts = CREW_EMBLEM_LAYERS.map((layer) => {
    const value = emblem[layer];
    const shape = readIndex(value.shape, shapeCount(layer));
    const color = readIndex(value.color, CREW_EMBLEM_COLORS.length);
    return `${shape}.${color}`;
  });
  parts.push(String(emblem.outline ? STYLE_OUTLINED : STYLE_CLEAN));
  return `E2-${parts.join("-")}`;
}

/**
 * Parses a stored code, or null when it is absent or not an emblem at all.
 *
 * There is no decoder for the retired four-part `E1-` codes on purpose. That
 * library was replaced rather than extended, so translating an old Crown into
 * an approximate new mark would be inventing a decision the crew never made;
 * an old code reads as unset and the crew picks again.
 */
export function decodeCrewEmblem(value: unknown): CrewEmblem | null {
  if (typeof value !== "string" || !EMBLEM_CODE_PATTERN.test(value)) return null;
  const [main, secondary, background, style] = value.slice(3).split("-");
  const piece = (layer: CrewEmblemLayer, raw: string): CrewEmblemPiece => {
    const [shape, color] = raw.split(".");
    return {
      shape: readIndex(Number(shape), shapeCount(layer)),
      color: readIndex(Number(color), CREW_EMBLEM_COLORS.length),
    };
  };
  return {
    main: piece("main", main),
    secondary: piece("secondary", secondary),
    background: piece("background", background),
    // A style digit this client does not know is the inked emblem, same as an
    // absent one — a future style must never render as a broken current one.
    outline: Number(style) !== STYLE_CLEAN,
  };
}

/** The emblem to draw for a crew: what it saved, or the neutral default. */
export function resolveCrewEmblem(stored: unknown): CrewEmblem {
  return decodeCrewEmblem(stored) ?? DEFAULT_CREW_EMBLEM;
}

/** Two emblems are the same emblem when they encode to the same code. */
export function sameCrewEmblem(left: CrewEmblem, right: CrewEmblem): boolean {
  return encodeCrewEmblem(left) === encodeCrewEmblem(right);
}

/* -------------------------------------------------------------------------- */
/* Colour pairing                                                             */
/* -------------------------------------------------------------------------- */

function channelLuminance(value: number): number {
  const channel = value / 255;
  return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
}

/** Standard sRGB relative luminance, so "readable" is measured, not guessed. */
export function crewEmblemColorLuminance(index: number): number {
  const hex = crewEmblemColor(index).value.slice(1);
  const value = Number.parseInt(hex, 16);
  return (
    0.2126 * channelLuminance((value >> 16) & 255) +
    0.7152 * channelLuminance((value >> 8) & 255) +
    0.0722 * channelLuminance(value & 255)
  );
}

export function crewEmblemColorContrast(left: number, right: number): number {
  const first = crewEmblemColorLuminance(left);
  const second = crewEmblemColorLuminance(right);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

/**
 * How far apart two layers' colours have to be to still read as two layers.
 *
 * The main mark sits directly on the background field, so that pair carries
 * the higher bar; the secondary only ever has to stay distinguishable from its
 * neighbours, and holding it to the same bar would leave `Surprise Me` with
 * almost nothing to choose from.
 */
const MAIN_ON_BACKGROUND_CONTRAST = 1.6;
const ADJACENT_CONTRAST = 1.35;

export type CrewEmblemColorRecipe = readonly [main: number, secondary: number, background: number];

let readableRecipes: CrewEmblemColorRecipe[] | null = null;

/**
 * Every colour triple that stays readable at crew-card size.
 *
 * Computed once from the palette rather than hand-listed, so adding a colour
 * cannot silently leave a stale recipe table behind.
 */
export function readableCrewEmblemColorRecipes(): readonly CrewEmblemColorRecipe[] {
  if (readableRecipes) return readableRecipes;
  const recipes: CrewEmblemColorRecipe[] = [];
  for (let main = 0; main < CREW_EMBLEM_COLORS.length; main += 1) {
    for (let background = 0; background < CREW_EMBLEM_COLORS.length; background += 1) {
      if (crewEmblemColorContrast(main, background) < MAIN_ON_BACKGROUND_CONTRAST) continue;
      for (let secondary = 0; secondary < CREW_EMBLEM_COLORS.length; secondary += 1) {
        if (secondary === main || secondary === background) continue;
        if (crewEmblemColorContrast(secondary, main) < ADJACENT_CONTRAST) continue;
        if (crewEmblemColorContrast(secondary, background) < ADJACENT_CONTRAST) continue;
        recipes.push([main, secondary, background]);
      }
    }
  }
  readableRecipes = recipes;
  return recipes;
}

/**
 * `Surprise Me`: a random emblem that is still a usable one.
 *
 * Shapes are picked freely — the three libraries are built to compose, so
 * there is no combination to guard against — and the colours come from the
 * readable triples rather than three independent picks, which is the only
 * thing standing between a shuffle and a violet mark on a blue field.
 */
export function randomCrewEmblem(random: () => number = Math.random): CrewEmblem {
  const pick = (count: number): number => Math.min(count - 1, Math.floor(random() * count));
  const recipes = readableCrewEmblemColorRecipes();
  const [main, secondary, background] = recipes[pick(recipes.length)];
  return {
    main: { shape: pick(shapeCount("main")), color: main },
    secondary: { shape: pick(shapeCount("secondary")), color: secondary },
    background: { shape: pick(shapeCount("background")), color: background },
    // Both ink styles are reachable: the recipes already guarantee the mark
    // separates from its field, so a flat emblem is a different look rather
    // than an unreadable one, and leaving it out would put half the design
    // space beyond a button whose whole job is finding the rest of it.
    outline: random() < 0.5,
  };
}

/* -------------------------------------------------------------------------- */
/* Drawing                                                                    */
/* -------------------------------------------------------------------------- */

/** One drawn path of an emblem, in the emblem's own view box coordinates. */
export interface CrewEmblemDrawOp {
  /** SVG path data, straight from the shape tables above. */
  d: string;
  /** Vertical offset applied to this path before it is drawn. */
  dy: number;
  fill?: string;
  fillRule?: "nonzero" | "evenodd";
  stroke?: string;
  strokeWidth?: number;
  strokeLinejoin?: "miter" | "round";
  /** Which layer this path belongs to. */
  part: CrewEmblemLayer;
}

/** Outline weights, chosen so the layers still separate at ~24 px. */
const OUTLINE: Record<CrewEmblemLayer, number> = {
  background: 5,
  secondary: 4,
  main: 4.5,
};

/** The main mark alone gets a dropped shadow, so it reads as the top layer. */
const MAIN_DROP = 4;

/**
 * The canonical emblem drawing: every path, in order, with its own paint.
 *
 * This is the one description of what a crew's mark looks like. The React
 * component serialises it to SVG and the invite share image rasterises it, so
 * an emblem cannot be one shape in the app and another in a shared link.
 */
export function crewEmblemDrawing(emblem: CrewEmblem): CrewEmblemDrawOp[] {
  const operations: CrewEmblemDrawOp[] = [];
  for (const layer of CREW_EMBLEM_DRAW_ORDER) {
    const shape = crewEmblemShape(layer, emblem[layer].shape);
    if (!shape.d) continue;
    const fillRule = shape.rule ?? "nonzero";
    const color = crewEmblemColor(emblem[layer].color).value;
    // The field keeps its edge either way: that outline separates the badge
    // from whatever surface it is sitting on, which is not what the crew is
    // turning off. The ink style is about the two foreground layers.
    const inked = layer === "background" || emblem.outline;
    if (layer === "main" && inked) {
      operations.push({ part: layer, d: shape.d, dy: MAIN_DROP, fill: CREW_EMBLEM_INK, fillRule });
    }
    operations.push({
      part: layer,
      d: shape.d,
      dy: 0,
      fill: color,
      fillRule,
      ...(inked
        ? {
            stroke: CREW_EMBLEM_INK,
            strokeWidth: OUTLINE[layer],
            strokeLinejoin: "round" as const,
          }
        : {}),
    });
  }
  return operations;
}

function drawOpMarkup(operation: CrewEmblemDrawOp): string {
  const attributes = [
    `d="${operation.d}"`,
    operation.dy ? `transform="translate(0 ${operation.dy})"` : "",
    `fill="${operation.fill ?? "none"}"`,
    operation.fill && operation.fillRule ? `fill-rule="${operation.fillRule}"` : "",
    operation.stroke ? `stroke="${operation.stroke}"` : "",
    operation.strokeWidth ? `stroke-width="${operation.strokeWidth}"` : "",
    operation.strokeLinejoin ? `stroke-linejoin="${operation.strokeLinejoin}"` : "",
  ].filter(Boolean);
  return `<path ${attributes.join(" ")}/>`;
}

/**
 * The canonical drawing as SVG markup, for the React mark.
 *
 * Each layer is wrapped in its own group so a builder thumbnail can dim the
 * layers it is not offering without the drawing model knowing anything about
 * the builder.
 *
 * The values interpolated here are all trusted table constants and colours
 * from the tables above — never crew-supplied text — so the markup is safe to
 * hand to `dangerouslySetInnerHTML`.
 */
export function crewEmblemSvgMarkup(emblem: CrewEmblem): string {
  let markup = "";
  let open: CrewEmblemLayer | null = null;
  for (const operation of crewEmblemDrawing(emblem)) {
    if (operation.part !== open) {
      if (open) markup += "</g>";
      markup += `<g class="crew-emblem__${operation.part}">`;
      open = operation.part;
    }
    markup += drawOpMarkup(operation);
  }
  return open ? `${markup}</g>` : markup;
}
