// Draws the STACK app icons.
//
// There is no image tooling in this repository and no reason to add a
// dependency for four flat shapes: the mark is three rounded bars on a solid
// ground, which is a few hundred lines of arithmetic and Node's own zlib. The
// PNGs are committed, so a normal build never runs this — it exists so the
// icons can be regenerated from the same geometry `StackMark.tsx` draws.
//
//   node scripts/generate-icons.mjs
//
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

/** Tokens from `src/styles/tokens.css`. */
const GROUND = [12, 22, 32]; // --bg-elevated #0c1620
const BARS = [
  // x, y, width, height in the 24-unit box `StackMark.tsx` uses, and colour.
  { x: 7, y: 2.5, w: 10, h: 5.5, r: 2, color: [155, 109, 255] }, // --simulation
  { x: 4.5, y: 8.75, w: 15, h: 5.5, r: 2, color: [79, 155, 255] }, // --intervals
  { x: 2, y: 15, w: 20, h: 5.5, r: 2, color: [184, 241, 59] }, // --easy
];
/** The mark's own bounds inside that box, so it can be centred exactly. */
const MARK = { x: 2, y: 2.5, w: 20, h: 18 };

const SAMPLES = 4;

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
function render(size, { scale, corner }) {
  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / SAMPLES;
  const offset = step / 2;

  // Fit the mark's bounds into `scale` of the icon and centre it.
  const unit = (size * scale) / Math.max(MARK.w, MARK.h);
  const originX = (size - MARK.w * unit) / 2 - MARK.x * unit;
  const originY = (size - MARK.h * unit) / 2 - MARK.y * unit;
  const place = (bar) => ({
    x: originX + bar.x * unit,
    y: originY + bar.y * unit,
    w: bar.w * unit,
    h: bar.h * unit,
    r: bar.r * unit,
    color: bar.color,
  });
  const placed = BARS.map(place);
  const radius = size * corner;

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const x = px + sx * step + offset;
          const y = py + sy * step + offset;
          if (!insideRoundedRect(x, y, 0, 0, size, size, radius)) continue;

          let color = GROUND;
          for (const bar of placed) {
            if (insideRoundedRect(x, y, bar.x, bar.y, bar.w, bar.h, bar.r)) {
              color = bar.color;
              break;
            }
          }
          r += color[0];
          g += color[1];
          b += color[2];
          a += 255;
        }
      }

      const total = SAMPLES * SAMPLES;
      const covered = a / 255;
      const index = (py * size + px) * 4;
      // Straight (unpremultiplied) alpha: the colour is the average of the
      // samples that landed on the icon, not of the whole cell.
      pixels[index] = covered ? Math.round(r / covered) : 0;
      pixels[index + 1] = covered ? Math.round(g / covered) : 0;
      pixels[index + 2] = covered ? Math.round(b / covered) : 0;
      pixels[index + 3] = Math.round(a / total);
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
  { file: "icon-192.png", size: 192, scale: 0.66, corner: 0.22 },
  { file: "icon-512.png", size: 512, scale: 0.66, corner: 0.22 },
  // Square ground: iOS applies its own mask and dark corners would show.
  { file: "apple-touch-icon.png", size: 180, scale: 0.62, corner: 0 },
  // Android maskable: everything that matters inside the middle 80%.
  { file: "icon-maskable-512.png", size: 512, scale: 0.5, corner: 0 },
];

mkdirSync(PUBLIC_DIR, { recursive: true });

for (const { file, size, scale, corner } of ICONS) {
  const png = encodePng(size, render(size, { scale, corner }));
  writeFileSync(join(PUBLIC_DIR, file), png);
  console.log(`${file} — ${size}×${size}, ${png.length} bytes`);
}

// The same mark as vector, for browsers that take an SVG favicon.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
  <rect width="24" height="24" rx="5.5" fill="#0c1620"/>
  <rect x="7" y="4.25" width="10" height="4.25" rx="1.6" fill="#9b6dff"/>
  <rect x="4.75" y="9.9" width="14.5" height="4.25" rx="1.6" fill="#4f9bff"/>
  <rect x="2.5" y="15.55" width="19" height="4.25" rx="1.6" fill="#b8f13b"/>
</svg>
`;
writeFileSync(join(PUBLIC_DIR, "favicon.svg"), svg);
console.log("favicon.svg");
