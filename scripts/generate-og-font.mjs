// Extracts the glyph outlines the Crew invite share image draws with.
//
// The invite card is rasterised on the server (`api/_render`), so it cannot
// ask a browser to lay out text. Rather than add a font-rendering dependency
// to a repository that already draws its own PNGs, this reads the Space Mono
// the app itself loads and writes the outlines out as data.
//
// The generated module is committed, so a normal build and deploy never runs
// this — it exists so the card's type can be regenerated from the same font
// `@fontsource/space-mono` serves to the browser.
//
//   node scripts/generate-og-font.mjs
//
import { inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = join(
  ROOT,
  "node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff",
);
const OUTPUT = join(ROOT, "api/_render/spaceMono.ts");

/**
 * What a crew name, a race name and the card's own labels can contain.
 *
 * The Latin-1 range covers the accented names a small running club actually
 * types; the handful above it are the punctuation macOS and iOS substitute
 * while typing. Anything outside this set is dropped at layout time rather
 * than drawn as a wrong glyph.
 */
const CHARACTERS = [
  ...range(0x20, 0x7e),
  ...range(0xa0, 0xff),
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac,
];

function range(from, to) {
  const values = [];
  for (let code = from; code <= to; code += 1) values.push(code);
  return values;
}

/** WOFF is an sfnt with each table individually zlib-compressed. */
function readWoffTables(file) {
  const woff = readFileSync(file);
  if (woff.toString("ascii", 0, 4) !== "wOFF") throw new Error(`${file} is not a WOFF file`);
  const tables = new Map();
  const count = woff.readUInt16BE(12);
  for (let index = 0; index < count; index += 1) {
    const entry = 44 + index * 20;
    const tag = woff.toString("ascii", entry, entry + 4);
    const offset = woff.readUInt32BE(entry + 4);
    const compressed = woff.readUInt32BE(entry + 8);
    const original = woff.readUInt32BE(entry + 12);
    const data = woff.subarray(offset, offset + compressed);
    tables.set(tag, compressed < original ? inflateSync(data) : data);
  }
  return tables;
}

/** Unicode → glyph id, from the Windows BMP `cmap` subtable every font has. */
function readCharacterMap(cmap) {
  const count = cmap.readUInt16BE(2);
  let subtable = 0;
  for (let index = 0; index < count; index += 1) {
    const platform = cmap.readUInt16BE(4 + index * 8);
    const encoding = cmap.readUInt16BE(6 + index * 8);
    const offset = cmap.readUInt32BE(8 + index * 8);
    if (platform === 3 && (encoding === 1 || encoding === 10)) subtable = offset;
    else if (!subtable && platform === 0) subtable = offset;
  }
  if (!subtable || cmap.readUInt16BE(subtable) !== 4) throw new Error("no format 4 cmap subtable");

  const segments = cmap.readUInt16BE(subtable + 6) / 2;
  const endAt = subtable + 14;
  const startAt = endAt + segments * 2 + 2;
  const deltaAt = startAt + segments * 2;
  const rangeAt = deltaAt + segments * 2;
  const map = new Map();
  for (let segment = 0; segment < segments; segment += 1) {
    const end = cmap.readUInt16BE(endAt + segment * 2);
    const start = cmap.readUInt16BE(startAt + segment * 2);
    const delta = cmap.readInt16BE(deltaAt + segment * 2);
    const rangeOffset = cmap.readUInt16BE(rangeAt + segment * 2);
    for (let code = start; code <= end && code !== 0xffff; code += 1) {
      let glyph;
      if (rangeOffset === 0) glyph = (code + delta) & 0xffff;
      else {
        const at = rangeAt + segment * 2 + rangeOffset + (code - start) * 2;
        if (at + 1 >= cmap.length) continue;
        const raw = cmap.readUInt16BE(at);
        glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
      }
      if (glyph) map.set(code, glyph);
    }
  }
  return map;
}

const ON_CURVE = 1;
const X_SHORT = 2;
const Y_SHORT = 4;
const REPEAT = 8;
const X_SAME = 16;
const Y_SAME = 32;

/** One glyph's contours as absolute points, in font units with y pointing up. */
function readContours(glyf, loca, index, depth = 0) {
  const from = loca[index];
  const to = loca[index + 1];
  if (from >= to || depth > 4) return [];
  const glyph = glyf.subarray(from, to);
  const contourCount = glyph.readInt16BE(0);
  if (contourCount < 0) return readComposite(glyf, loca, glyph, depth);

  const endPoints = [];
  for (let contour = 0; contour < contourCount; contour += 1) {
    endPoints.push(glyph.readUInt16BE(10 + contour * 2));
  }
  const points = endPoints.length ? endPoints[endPoints.length - 1] + 1 : 0;
  let at = 10 + contourCount * 2;
  at += 2 + glyph.readUInt16BE(at); // skip the hinting instructions

  const flags = [];
  while (flags.length < points) {
    const flag = glyph[at];
    at += 1;
    flags.push(flag);
    if (flag & REPEAT) {
      const repeats = glyph[at];
      at += 1;
      for (let repeat = 0; repeat < repeats; repeat += 1) flags.push(flag);
    }
  }

  const readAxis = (shortBit, sameBit) => {
    const values = [];
    let value = 0;
    for (const flag of flags) {
      if (flag & shortBit) {
        const delta = glyph[at];
        at += 1;
        value += flag & sameBit ? delta : -delta;
      } else if (!(flag & sameBit)) {
        value += glyph.readInt16BE(at);
        at += 2;
      }
      values.push(value);
    }
    return values;
  };
  const xs = readAxis(X_SHORT, X_SAME);
  const ys = readAxis(Y_SHORT, Y_SAME);

  const contours = [];
  let start = 0;
  for (const end of endPoints) {
    const contour = [];
    for (let point = start; point <= end; point += 1) {
      contour.push({ x: xs[point], y: ys[point], on: Boolean(flags[point] & ON_CURVE) });
    }
    if (contour.length) contours.push(contour);
    start = end + 1;
  }
  return contours;
}

const ARGS_ARE_WORDS = 1;
const ARGS_ARE_XY = 2;
const HAS_SCALE = 8;
const MORE_COMPONENTS = 32;
const HAS_XY_SCALE = 64;
const HAS_TWO_BY_TWO = 128;

/** Accents and the like reference other glyphs; flatten them where they sit. */
function readComposite(glyf, loca, glyph, depth) {
  const contours = [];
  let at = 10;
  for (;;) {
    const flags = glyph.readUInt16BE(at);
    const component = glyph.readUInt16BE(at + 2);
    at += 4;
    let dx = 0;
    let dy = 0;
    if (flags & ARGS_ARE_WORDS) {
      if (flags & ARGS_ARE_XY) {
        dx = glyph.readInt16BE(at);
        dy = glyph.readInt16BE(at + 2);
      }
      at += 4;
    } else {
      if (flags & ARGS_ARE_XY) {
        dx = glyph.readInt8(at);
        dy = glyph.readInt8(at + 1);
      }
      at += 2;
    }
    let a = 1;
    let b = 0;
    let c = 0;
    let d = 1;
    const f2dot14 = (offset) => glyph.readInt16BE(offset) / 16384;
    if (flags & HAS_SCALE) {
      a = d = f2dot14(at);
      at += 2;
    } else if (flags & HAS_XY_SCALE) {
      a = f2dot14(at);
      d = f2dot14(at + 2);
      at += 4;
    } else if (flags & HAS_TWO_BY_TWO) {
      a = f2dot14(at);
      b = f2dot14(at + 2);
      c = f2dot14(at + 4);
      d = f2dot14(at + 6);
      at += 8;
    }
    for (const contour of readContours(glyf, loca, component, depth + 1)) {
      contours.push(
        contour.map((point) => ({
          x: Math.round(a * point.x + c * point.y + dx),
          y: Math.round(b * point.x + d * point.y + dy),
          on: point.on,
        })),
      );
    }
    if (!(flags & MORE_COMPONENTS)) break;
  }
  return contours;
}

/**
 * TrueType contours as an SVG path.
 *
 * TrueType stores quadratic curves and allows two consecutive control points,
 * with the on-curve point between them left implied at their midpoint; this
 * puts those midpoints back so the result is an ordinary `M/L/Q/Z` path.
 */
function contoursToPath(contours) {
  const parts = [];
  for (const contour of contours) {
    if (contour.length < 2) continue;
    const points = [...contour];
    // Start on the curve, inventing the implied midpoint when a contour opens
    // on a control point.
    let startIndex = points.findIndex((point) => point.on);
    let start;
    if (startIndex < 0) {
      const first = points[0];
      const last = points[points.length - 1];
      start = { x: (first.x + last.x) / 2, y: (first.y + last.y) / 2, on: true };
      startIndex = 0;
    } else {
      start = points[startIndex];
      startIndex += 1;
    }
    const ordered = [];
    for (let step = 0; step < points.length; step += 1) {
      ordered.push(points[(startIndex + step) % points.length]);
    }

    parts.push(`M${round(start.x)} ${round(start.y)}`);
    let control = null;
    for (const point of ordered) {
      if (point.on) {
        parts.push(
          control
            ? `Q${round(control.x)} ${round(control.y)} ${round(point.x)} ${round(point.y)}`
            : `L${round(point.x)} ${round(point.y)}`,
        );
        control = null;
      } else if (control) {
        const between = { x: (control.x + point.x) / 2, y: (control.y + point.y) / 2 };
        parts.push(`Q${round(control.x)} ${round(control.y)} ${round(between.x)} ${round(between.y)}`);
        control = point;
      } else {
        control = point;
      }
    }
    parts.push(
      control
        ? `Q${round(control.x)} ${round(control.y)} ${round(start.x)} ${round(start.y)}Z`
        : "Z",
    );
  }
  return parts.join("");
}

function round(value) {
  return Math.round(value * 2) / 2;
}

const tables = readWoffTables(SOURCE);
for (const tag of ["head", "maxp", "hhea", "hmtx", "cmap", "loca", "glyf"]) {
  if (!tables.has(tag)) throw new Error(`${SOURCE} has no ${tag} table`);
}

const head = tables.get("head");
const unitsPerEm = head.readUInt16BE(18);
const longLoca = head.readInt16BE(50) === 1;
const glyphCount = tables.get("maxp").readUInt16BE(4);
const metricCount = tables.get("hhea").readUInt16BE(34);
const ascender = tables.get("hhea").readInt16BE(4);
const descender = tables.get("hhea").readInt16BE(6);

const locaTable = tables.get("loca");
const loca = [];
for (let index = 0; index <= glyphCount; index += 1) {
  loca.push(longLoca ? locaTable.readUInt32BE(index * 4) : locaTable.readUInt16BE(index * 2) * 2);
}

const hmtx = tables.get("hmtx");
const advanceOf = (glyph) =>
  hmtx.readUInt16BE(Math.min(glyph, metricCount - 1) * 4);

const characters = readCharacterMap(tables.get("cmap"));
const glyf = tables.get("glyf");

const entries = [];
const missing = [];
for (const code of CHARACTERS) {
  const glyph = characters.get(code);
  if (!glyph) {
    missing.push(code);
    continue;
  }
  entries.push({
    code,
    advance: advanceOf(glyph),
    path: contoursToPath(readContours(glyf, loca, glyph)),
  });
}

const advances = new Map();
for (const entry of entries) advances.set(entry.advance, (advances.get(entry.advance) ?? 0) + 1);
const common = [...advances.entries()].sort((left, right) => right[1] - left[1])[0][0];

const lines = entries.map((entry) => {
  const key = String(entry.code).padStart(5, " ");
  const advance = entry.advance === common ? "" : `, advance: ${entry.advance}`;
  return `  ${key}: { path: ${JSON.stringify(entry.path)}${advance} },`;
});

const module = `// Generated by \`node scripts/generate-og-font.mjs\` — do not edit by hand.
//
// Space Mono Bold outlines for the characters the Crew invite share image can
// draw, taken from the same \`@fontsource/space-mono\` file the app loads in the
// browser. Coordinates are font units with y pointing up, as SVG path data.
//
// Space Mono is licensed under the SIL Open Font License 1.1; see
// \`node_modules/@fontsource/space-mono/LICENSE\`.

export interface OgGlyph {
  path: string;
  /** Omitted on the monospaced default; see \`SPACE_MONO_BOLD.advance\`. */
  advance?: number;
}

export interface OgFont {
  unitsPerEm: number;
  ascender: number;
  descender: number;
  /** The advance shared by every glyph that does not override it. */
  advance: number;
  glyphs: Readonly<Record<number, OgGlyph>>;
}

export const SPACE_MONO_BOLD: OgFont = {
  unitsPerEm: ${unitsPerEm},
  ascender: ${ascender},
  descender: ${descender},
  advance: ${common},
  glyphs: {
${lines.join("\n")}
  },
};
`;

writeFileSync(OUTPUT, module);
console.log(
  `api/_render/spaceMono.ts — ${entries.length} glyphs, ${module.length} bytes` +
    (missing.length ? `, ${missing.length} character(s) absent from the subset` : ""),
);
