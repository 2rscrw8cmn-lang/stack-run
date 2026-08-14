/**
 * Text for the invite card, set in the app's own Space Mono.
 *
 * Glyph outlines come from `spaceMono.ts`, which `scripts/generate-og-font.mjs`
 * extracts from the very font file the browser downloads, so a crew name looks
 * the same in the share image as it does in the app. Layout is deliberately
 * plain — advance widths and optional letter spacing, no kerning or shaping —
 * because the font is monospaced and the card sets a few short lines.
 */

import { pathPolygons, type Polygon } from "./geometry.js";
import { SPACE_MONO_BOLD, type OgFont } from "./spaceMono.js";

export const CARD_FONT: OgFont = SPACE_MONO_BOLD;

export interface TextStyle {
  size: number;
  /** Extra space between characters, in the same units as `size`. */
  tracking?: number;
}

/**
 * The characters this font can draw.
 *
 * An accented character absent from the Latin subset is stripped to its base
 * letter rather than dropped — a crew called "Café" reads better as "Cafe"
 * than as "Caf" — and anything still unknown is left out entirely.
 */
export function drawableText(value: string): string {
  let out = "";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (CARD_FONT.glyphs[code]) {
      out += character;
      continue;
    }
    const stripped = character.normalize("NFD").replace(/[̀-ͯ]/g, "");
    for (const base of stripped) {
      if (CARD_FONT.glyphs[base.codePointAt(0) ?? 0]) out += base;
    }
  }
  return out;
}

function advanceOf(code: number): number {
  return CARD_FONT.glyphs[code]?.advance ?? CARD_FONT.advance;
}

export function measureText(value: string, style: TextStyle): number {
  const scale = style.size / CARD_FONT.unitsPerEm;
  const tracking = style.tracking ?? 0;
  let width = 0;
  let count = 0;
  for (const character of value) {
    width += advanceOf(character.codePointAt(0) ?? 0) * scale + tracking;
    count += 1;
  }
  return count ? width - tracking : 0;
}

/**
 * Polygons for a line of text, with `x`/`y` at the start of its baseline.
 *
 * Font units point up and the canvas points down, so the placement's vertical
 * scale is negative: the flip happens once, here.
 */
export function textPolygons(
  value: string,
  x: number,
  baseline: number,
  style: TextStyle,
): Polygon[] {
  const scale = style.size / CARD_FONT.unitsPerEm;
  const tracking = style.tracking ?? 0;
  const polygons: Polygon[] = [];
  let pen = x;
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    const glyph = CARD_FONT.glyphs[code];
    if (glyph?.path) {
      polygons.push(
        ...pathPolygons(glyph.path, { scaleX: scale, scaleY: -scale, x: pen, y: baseline }),
      );
    }
    pen += advanceOf(code) * scale + tracking;
  }
  return polygons;
}

/** The largest size at or below `size` that fits `width`, down to `minimum`. */
export function fitTextSize(
  value: string,
  width: number,
  size: number,
  minimum: number,
  tracking = 0,
): number {
  let candidate = size;
  while (candidate > minimum && measureText(value, { size: candidate, tracking }) > width) {
    candidate -= 1;
  }
  return candidate;
}

/** Truncates on a word boundary where it can, with a trailing ellipsis. */
export function truncateText(value: string, width: number, style: TextStyle): string {
  if (measureText(value, style) <= width) return value;
  const characters = [...value];
  let kept = characters.length;
  while (kept > 0 && measureText(`${characters.slice(0, kept).join("")}…`, style) > width) {
    kept -= 1;
  }
  let clipped = characters.slice(0, kept).join("").trimEnd();
  if (!clipped) return "";
  // Prefer a word boundary, but not one that throws most of the line away.
  const lastSpace = clipped.lastIndexOf(" ");
  if (lastSpace >= clipped.length * 0.6) clipped = clipped.slice(0, lastSpace);
  return `${clipped.trimEnd()}…`;
}

/** Breaks text into at most `maxLines` lines that each fit `width`. */
export function wrapText(
  value: string,
  width: number,
  style: TextStyle,
  maxLines: number,
): string[] {
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  let overflowed = false;
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (!line || measureText(candidate, style) <= width) {
      line = candidate;
      continue;
    }
    if (lines.length + 1 >= maxLines) {
      overflowed = true;
      break;
    }
    lines.push(line);
    line = word;
  }
  if (line) lines.push(line);
  if (!lines.length) return [];
  const last = lines.length - 1;
  lines[last] = truncateText(overflowed ? `${lines[last]}…` : lines[last], width, style);
  return lines.filter(Boolean);
}
