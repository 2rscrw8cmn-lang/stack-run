/**
 * The 1200×630 Crew invite share card.
 *
 * Messages, and every other link previewer, is handed a PNG rather than SVG:
 * the same card drawn as SVG loaded inconsistently on iOS, and a raster image
 * is what these clients are built to fetch. The whole card is drawn here from
 * geometry the app already owns — the crew's own emblem from `src/crew/emblem`
 * and the STACK mark from `src/components/shared/stackMarkSvg` — so the share
 * image cannot drift away from what the invite page shows.
 *
 * The composition is an identity card: the crew's emblem large on the left,
 * the crew's name and kind on the right, race context underneath for a Race
 * Crew, and STACK subordinate at the bottom.
 */

import {
  CREW_EMBLEM_VIEW_BOX_HEIGHT,
  CREW_EMBLEM_VIEW_BOX_WIDTH,
  crewEmblemDrawing,
  type CrewEmblem,
} from "../../src/crew/emblem.js";
import {
  STACK_MARK_BARS,
  STACK_MARK_BOUNDS,
} from "../../src/components/shared/stackMarkSvg.js";
import {
  createCanvas,
  fillPolygons,
  paint,
  parseColor,
  type Canvas,
  type Rgb,
} from "./canvas.js";
import {
  flattenPath,
  rectPolygon,
  roundedRectPolygon,
  strokePolygons,
  translated,
  type Placement,
  type Polygon,
} from "./geometry.js";
import { encodePng } from "./png.js";
import {
  drawableText,
  fitTextSize,
  textPolygons,
  truncateText,
  wrapText,
} from "./text.js";

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

/** Tokens from `src/styles/tokens.css`. */
const INK: Rgb = parseColor("#05080a");
const INK_WARM: Rgb = parseColor("#0a1219");
const ACCENT = "#a6ff1a";
const TEXT = "#f6f7f8";
const TEXT_MUTED = "#b8c4c2";
const TEXT_SUBTLE = "#8f9aa4";
const GRID = "#5d8ca8";

/** The emblem's box, and the column the identity sits in. */
const EMBLEM_LEFT = 96;
const EMBLEM_WIDTH = 316;
const TEXT_LEFT = 470;
const TEXT_WIDTH = CARD_WIDTH - TEXT_LEFT - 96;

/** Space Mono's capitals fill about this much of the em. */
const CAP_HEIGHT = 0.7;

export interface InviteCard {
  crewName: string;
  /** `RACE CREW` or `RUN CLUB` — the crew's kind, in the card's own words. */
  kind: string;
  /** The race a Race Crew is built around; null for a Run Club. */
  raceName: string | null;
  /** That race's date and distance, on their own line; null for a Run Club. */
  raceDetail: string | null;
  emblem: CrewEmblem;
}

function background(canvas: Canvas): void {
  // A soft diagonal lift towards the top left, so the emblem sits in light.
  paint(canvas, (x, y) => {
    const lift = Math.max(0, 1 - (x / canvas.width) * 0.75 - (y / canvas.height) * 0.55);
    return [
      INK[0] + (INK_WARM[0] - INK[0]) * lift,
      INK[1] + (INK_WARM[1] - INK[1]) * lift,
      INK[2] + (INK_WARM[2] - INK[2]) * lift,
    ];
  });

  const lines: Polygon[] = [];
  for (let x = 48; x < CARD_WIDTH; x += 48) lines.push(rectPolygon(x, 0, 1, CARD_HEIGHT));
  for (let y = 48; y < CARD_HEIGHT; y += 48) lines.push(rectPolygon(0, y, CARD_WIDTH, 1));
  fillPolygons(canvas, lines, { color: GRID, opacity: 0.13 });
}

/** Draws an emblem's canonical paths into a box, keeping its own proportions. */
function drawEmblem(canvas: Canvas, emblem: CrewEmblem, left: number, width: number): void {
  const scale = width / CREW_EMBLEM_VIEW_BOX_WIDTH;
  const height = CREW_EMBLEM_VIEW_BOX_HEIGHT * scale;
  const placement: Placement = {
    scaleX: scale,
    scaleY: scale,
    x: left,
    y: (CARD_HEIGHT - height) / 2,
  };
  for (const operation of crewEmblemDrawing(emblem)) {
    const contours = flattenPath(operation.d, translated(placement, 0, operation.dy));
    if (operation.fill) {
      fillPolygons(
        canvas,
        contours.map((contour) => contour.points),
        { color: operation.fill, rule: operation.fillRule },
      );
    }
    if (!operation.stroke || !operation.strokeWidth) continue;
    const outline = contours.flatMap((contour) =>
      strokePolygons(contour, {
        width: operation.strokeWidth! * scale,
        join: operation.strokeLinejoin === "round" ? "round" : "miter",
      }),
    );
    fillPolygons(canvas, outline, { color: operation.stroke });
  }
}

function drawStackMark(canvas: Canvas, left: number, top: number, height: number): number {
  const scale = height / STACK_MARK_BOUNDS.height;
  for (const bar of STACK_MARK_BARS) {
    fillPolygons(
      canvas,
      [
        roundedRectPolygon(
          left + (bar.x - STACK_MARK_BOUNDS.x) * scale,
          top + (bar.y - STACK_MARK_BOUNDS.y) * scale,
          bar.width * scale,
          bar.height * scale,
          bar.radius * scale,
        ),
      ],
      { color: bar.color },
    );
  }
  return STACK_MARK_BOUNDS.width * scale;
}

interface Line {
  text: string;
  size: number;
  tracking?: number;
  color: string;
  /** Space above this line, measured from the previous line's cap top. */
  gap: number;
}

function drawLines(canvas: Canvas, lines: readonly Line[], top: number): void {
  let baseline = top;
  lines.forEach((line, index) => {
    baseline += (index ? line.gap : 0) + line.size * CAP_HEIGHT;
    fillPolygons(canvas, textPolygons(line.text, TEXT_LEFT, baseline, line), {
      color: line.color,
    });
  });
}

function heightOf(lines: readonly Line[]): number {
  return lines.reduce(
    (total, line, index) => total + (index ? line.gap : 0) + line.size * CAP_HEIGHT,
    0,
  );
}

/**
 * The card for a resolved invite.
 *
 * Crew and race names are the only untrusted text on the card; they are cut to
 * the characters the font can draw and then to the width of their column, so
 * no name can push the layout out of the image.
 */
function drawInvite(canvas: Canvas, card: InviteCard): void {
  drawEmblem(canvas, card.emblem, EMBLEM_LEFT, EMBLEM_WIDTH);

  const name = drawableText(card.crewName) || "Crew";
  const nameSize = fitTextSize(name, TEXT_WIDTH, 76, 46);
  const nameLines = wrapText(name, TEXT_WIDTH, { size: nameSize }, 2);

  const lines: Line[] = [
    { text: card.kind, size: 26, tracking: 8, color: ACCENT, gap: 0 },
    ...nameLines.map((text, index) => ({
      text,
      size: nameSize,
      color: TEXT,
      gap: index ? nameSize * 0.34 : 40,
    })),
  ];
  // The race gets its own two lines rather than one long one: at this width a
  // race name and its date only fit together by shrinking both out of reading
  // size.
  const raceName = card.raceName ? drawableText(card.raceName) : "";
  if (raceName) {
    lines.push({
      text: truncateText(raceName, TEXT_WIDTH, { size: 30 }),
      size: 30,
      color: TEXT_MUTED,
      gap: 36,
    });
  }
  const raceDetail = card.raceDetail ? drawableText(card.raceDetail) : "";
  if (raceDetail) {
    lines.push({
      text: truncateText(raceDetail, TEXT_WIDTH, { size: 26 }),
      size: 26,
      color: TEXT_SUBTLE,
      gap: 18,
    });
  }

  // Centre the identity in the space above the footer.
  const footer = 512;
  drawLines(canvas, lines, Math.max(120, (footer - heightOf(lines)) / 2));

  const markWidth = drawStackMark(canvas, TEXT_LEFT, footer + 6, 40);
  fillPolygons(
    canvas,
    textPolygons("Join on STACK", TEXT_LEFT + markWidth + 22, footer + 38, {
      size: 30,
      tracking: 1,
    }),
    { color: TEXT },
  );
}

/** The card an invalid, expired or revoked invite gets: STACK and nothing else. */
function drawFallback(canvas: Canvas): void {
  const markHeight = 168;
  const markLeft = EMBLEM_LEFT + 60;
  const markWidth = drawStackMark(canvas, markLeft, (CARD_HEIGHT - markHeight) / 2, markHeight);
  const left = markLeft + markWidth + 72;
  fillPolygons(canvas, textPolygons("STACK", left, 306, { size: 88, tracking: 6 }), {
    color: TEXT,
  });
  fillPolygons(canvas, textPolygons("Join a Crew on STACK", left, 372, { size: 30 }), {
    color: TEXT_MUTED,
  });
}

/** The finished share image: PNG bytes, ready to return as `image/png`. */
export function renderInviteCard(card: InviteCard | null): Uint8Array {
  const canvas = createCanvas(CARD_WIDTH, CARD_HEIGHT, INK);
  background(canvas);
  // The accent rule that runs down the left of every STACK surface.
  fillPolygons(canvas, [rectPolygon(56, 58, 4, CARD_HEIGHT - 116)], { color: ACCENT });
  if (card) drawInvite(canvas, card);
  else drawFallback(canvas);
  return encodePng(canvas);
}
