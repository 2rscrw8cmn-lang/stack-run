// Draws STACK install assets from the canonical runner-man vector.
//
// There is no image-tooling dependency in this repository. The small path
// flattener and scanline rasterizer below use the same arithmetic as the Crew
// invite-card renderer, while the artwork itself remains owned by one shared
// source. The generated PNG/SVG files are committed; normal builds do not run
// this script.
//
//   node scripts/generate-icons.mjs
//
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  STACK_RUNNER_PATHS,
  STACK_RUNNER_VIEW_BOX,
  stackRunnerSvgMarkup,
} from "../src/components/shared/stackRunnerMark.js";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Tokens from `src/styles/tokens.css`. */
const GROUND = [12, 22, 32]; // --bg-elevated #0c1620
const SAMPLES = 4;
const SUBSAMPLES = 5;

function insideRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || px > x + w || py < y || py > y + h) return false;
  const radius = Math.min(r, w / 2, h / 2);
  const dx = Math.max(x + radius - px, 0, px - (x + w - radius));
  const dy = Math.max(y + radius - py, 0, py - (y + h - radius));
  return dx * dx + dy * dy <= radius * radius;
}

/**
 * @param size    pixel size of the square icon
 * @param scale   how much of the icon the mark occupies, edge to edge
 * @param corner  ground corner radius as a fraction of the size; 0 is square
 */
function parseColor(color) {
  const value = Number.parseInt(color.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function createCanvas(size) {
  const data = new Float32Array(size * size * 3);
  for (let index = 0; index < data.length; index += 3) {
    data[index] = GROUND[0];
    data[index + 1] = GROUND[1];
    data[index + 2] = GROUND[2];
  }
  return { width: size, height: size, data };
}

function blend(canvas, x, y, color, alpha) {
  if (alpha <= 0 || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 3;
  const weight = Math.min(1, alpha);
  canvas.data[index] += (color[0] - canvas.data[index]) * weight;
  canvas.data[index + 1] += (color[1] - canvas.data[index + 1]) * weight;
  canvas.data[index + 2] += (color[2] - canvas.data[index + 2]) * weight;
}

function edgesOf(polygons) {
  const edges = [];
  let top = Number.POSITIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const polygon of polygons) {
    for (let index = 0; index < polygon.length; index += 1) {
      const from = polygon[index];
      const to = polygon[(index + 1) % polygon.length];
      if (from.y === to.y) continue;
      const upward = from.y < to.y;
      const start = upward ? from : to;
      const end = upward ? to : from;
      edges.push({
        topY: start.y,
        bottomY: end.y,
        x: start.x,
        slope: (end.x - start.x) / (end.y - start.y),
        winding: upward ? 1 : -1,
      });
      top = Math.min(top, start.y);
      bottom = Math.max(bottom, end.y);
    }
  }
  return { edges, top, bottom };
}

function fillPolygons(canvas, polygons, colorSource) {
  const color = parseColor(colorSource);
  const { edges, top, bottom } = edgesOf(polygons);
  if (!edges.length) return;
  const firstRow = Math.max(0, Math.floor(top));
  const lastRow = Math.min(canvas.height - 1, Math.ceil(bottom));
  const coverage = new Float32Array(canvas.width);
  const crossings = [];

  for (let row = firstRow; row <= lastRow; row += 1) {
    coverage.fill(0);
    let touched = false;
    for (let sample = 0; sample < SUBSAMPLES; sample += 1) {
      const y = row + (sample + 0.5) / SUBSAMPLES;
      crossings.length = 0;
      for (const edge of edges) {
        if (y < edge.topY || y >= edge.bottomY) continue;
        crossings.push({ x: edge.x + (y - edge.topY) * edge.slope, winding: edge.winding });
      }
      if (crossings.length < 2) continue;
      crossings.sort((left, right) => left.x - right.x);

      let winding = 0;
      for (let index = 0; index < crossings.length - 1; index += 1) {
        winding += crossings[index].winding;
        if (winding === 0) continue;
        const from = Math.max(0, crossings[index].x);
        const to = Math.min(canvas.width, crossings[index + 1].x);
        if (to <= from) continue;
        touched = true;
        const firstPixel = Math.floor(from);
        const lastPixel = Math.min(canvas.width - 1, Math.ceil(to) - 1);
        for (let pixel = firstPixel; pixel <= lastPixel; pixel += 1) {
          const left = Math.max(from, pixel);
          const right = Math.min(to, pixel + 1);
          if (right > left) coverage[pixel] += (right - left) / SUBSAMPLES;
        }
      }
    }
    if (!touched) continue;
    for (let x = 0; x < canvas.width; x += 1) {
      if (coverage[x] > 0) blend(canvas, x, row, color, coverage[x]);
    }
  }
}

const COMMAND_PATTERN = /([MmLlHhVvQqCcZz])([^MmLlHhVvQqCcZz]*)/g;
const NUMBER_PATTERN = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function readCommands(d) {
  return [...d.matchAll(COMMAND_PATTERN)].map((match) => ({
    type: match[1],
    values: (match[2].match(NUMBER_PATTERN) ?? []).map(Number),
  }));
}

function place(placement, point) {
  return {
    x: placement.x + point.x * placement.scale,
    y: placement.y + point.y * placement.scale,
  };
}

function curveSteps(points) {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return Math.max(3, Math.min(64, Math.ceil(length / 2.5)));
}

function cubic(from, first, second, to, into) {
  const steps = curveSteps([from, first, second, to]);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const inverse = 1 - t;
    into.push({
      x: inverse ** 3 * from.x + 3 * inverse ** 2 * t * first.x + 3 * inverse * t ** 2 * second.x + t ** 3 * to.x,
      y: inverse ** 3 * from.y + 3 * inverse ** 2 * t * first.y + 3 * inverse * t ** 2 * second.y + t ** 3 * to.y,
    });
  }
}

function flattenPath(d, placement) {
  const contours = [];
  let current = [];
  let cursor = { x: 0, y: 0 };
  let startedAt = { x: 0, y: 0 };
  const flush = () => {
    if (current.length > 1) contours.push(current);
    current = [];
  };
  const moveTo = (point) => {
    flush();
    cursor = point;
    startedAt = point;
    current = [place(placement, point)];
  };
  const lineTo = (point) => {
    cursor = point;
    current.push(place(placement, point));
  };

  for (const command of readCommands(d)) {
    const { values } = command;
    const relative = command.type === command.type.toLowerCase();
    const base = () => (relative ? cursor : { x: 0, y: 0 });
    switch (command.type.toUpperCase()) {
      case "M":
        for (let index = 0; index + 1 < values.length; index += 2) {
          const from = base();
          const point = { x: from.x + values[index], y: from.y + values[index + 1] };
          if (index === 0) moveTo(point);
          else lineTo(point);
        }
        break;
      case "L":
        for (let index = 0; index + 1 < values.length; index += 2) {
          const from = base();
          lineTo({ x: from.x + values[index], y: from.y + values[index + 1] });
        }
        break;
      case "H":
        for (const value of values) lineTo({ x: base().x + value, y: cursor.y });
        break;
      case "V":
        for (const value of values) lineTo({ x: cursor.x, y: base().y + value });
        break;
      case "C":
        for (let index = 0; index + 5 < values.length; index += 6) {
          const from = base();
          const first = { x: from.x + values[index], y: from.y + values[index + 1] };
          const second = { x: from.x + values[index + 2], y: from.y + values[index + 3] };
          const to = { x: from.x + values[index + 4], y: from.y + values[index + 5] };
          const placed = [];
          cubic(place(placement, cursor), place(placement, first), place(placement, second), place(placement, to), placed);
          current.push(...placed);
          cursor = to;
        }
        break;
      case "Z":
        flush();
        cursor = startedAt;
        current = [place(placement, cursor)];
        break;
      default:
        throw new Error(`Unsupported runner path command: ${command.type}`);
    }
  }
  flush();
  return contours;
}

function render(size, { scale, corner }) {
  const canvas = createCanvas(size);
  const unit = (size * scale) / Math.max(STACK_RUNNER_VIEW_BOX.width, STACK_RUNNER_VIEW_BOX.height);
  const placement = {
    scale: unit,
    x: (size - STACK_RUNNER_VIEW_BOX.width * unit) / 2,
    y: (size - STACK_RUNNER_VIEW_BOX.height * unit) / 2,
  };
  for (const path of STACK_RUNNER_PATHS) {
    fillPolygons(canvas, flattenPath(path.d, placement), path.fill);
  }

  const pixels = Buffer.alloc(size * size * 4);
  const radius = size * corner;
  const step = 1 / SAMPLES;
  const offset = step / 2;
  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let covered = 0;
      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = px + sx * step + offset;
          const y = py + sy * step + offset;
          if (insideRoundedRect(x, y, 0, 0, size, size, radius)) covered += 1;
        }
      }
      const source = (py * size + px) * 3;
      const target = (py * size + px) * 4;
      pixels[target] = Math.round(canvas.data[source]);
      pixels[target + 1] = Math.round(canvas.data[source + 1]);
      pixels[target + 2] = Math.round(canvas.data[source + 2]);
      pixels[target + 3] = Math.round((covered / (SAMPLES * SAMPLES)) * 255);
    }
  }
  return pixels;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

function encodePng(size, pixels) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8; // bit depth
  header[9] = 6; // truecolour with alpha
  // 10-12: deflate, adaptive filtering, no interlace — all zero.

  // One filter byte per row; filter 0 (none) keeps this readable and the
  // images are flat enough that deflate handles the rest.
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const from = y * size * 4;
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, from, from + size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const ICONS = [
  // Rounded, transparent outside: browser tabs, install prompts, shortcuts.
  { file: "icon-192.png", size: 192, scale: 0.72, corner: 0.22 },
  { file: "icon-512.png", size: 512, scale: 0.72, corner: 0.22 },
  // Square ground: iOS applies its own mask and dark corners would show.
  { file: "apple-touch-icon.png", size: 180, scale: 0.66, corner: 0 },
  // Android maskable: the full runner remains inside the central safe zone.
  { file: "icon-maskable-512.png", size: 512, scale: 0.56, corner: 0 },
];

mkdirSync(PUBLIC_DIR, { recursive: true });

for (const { file, size, scale, corner } of ICONS) {
  const png = encodePng(size, render(size, { scale, corner }));
  writeFileSync(join(PUBLIC_DIR, file), png);
  console.log(`${file} — ${size}×${size}, ${png.length} bytes`);
}

const faviconSize = 64;
const faviconScale = (faviconSize * 0.72) / STACK_RUNNER_VIEW_BOX.height;
const faviconX = (faviconSize - STACK_RUNNER_VIEW_BOX.width * faviconScale) / 2;
const faviconY = (faviconSize - STACK_RUNNER_VIEW_BOX.height * faviconScale) / 2;
const favicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${faviconSize} ${faviconSize}" width="64" height="64" role="img" aria-label="STACK">
  <rect width="64" height="64" rx="14" fill="#0c1620"/>
  <g transform="translate(${faviconX} ${faviconY}) scale(${faviconScale})">${stackRunnerSvgMarkup()}</g>
</svg>
`;
writeFileSync(join(PUBLIC_DIR, "favicon.svg"), favicon);
console.log("favicon.svg");

const runnerAsset = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${STACK_RUNNER_VIEW_BOX.width} ${STACK_RUNNER_VIEW_BOX.height}" role="img" aria-label="STACK">${stackRunnerSvgMarkup()}</svg>
`;
writeFileSync(join(PUBLIC_DIR, "stack-runner-mark.svg"), runnerAsset);
console.log("stack-runner-mark.svg");
