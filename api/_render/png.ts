/**
 * PNG encoding, the same way `scripts/generate-icons.mjs` does it: a couple of
 * chunks, a CRC table and Node's own zlib.
 *
 * The card is opaque, so it is written as truecolour without alpha — a third
 * less data through deflate than RGBA, which matters when Messages is waiting
 * on the image.
 */

import { deflateSync } from "node:zlib";
import type { Canvas } from "./canvas.js";

const CRC_TABLE = Array.from({ length: 256 }, (_, start) => {
  let value = start;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes: Uint8Array): number {
  let value = 0xffffffff;
  for (const byte of bytes) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const body = new Uint8Array(4 + data.length);
  for (let index = 0; index < 4; index += 1) body[index] = type.charCodeAt(index);
  body.set(data, 4);
  const out = new Uint8Array(body.length + 8);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(body, 4);
  view.setUint32(out.length - 4, crc32(body));
  return out;
}

function paeth(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft;
  const distanceLeft = Math.abs(estimate - left);
  const distanceUp = Math.abs(estimate - up);
  const distanceUpLeft = Math.abs(estimate - upLeft);
  if (distanceLeft <= distanceUp && distanceLeft <= distanceUpLeft) return left;
  return distanceUp <= distanceUpLeft ? up : upLeft;
}

/**
 * Filters one row five ways and keeps the cheapest.
 *
 * This is the standard heuristic, and it earns its keep here: the card's
 * background is a gradient over a grid, which filters down to almost nothing
 * but compresses poorly unfiltered.
 */
function filterRow(row: Uint8Array, previous: Uint8Array, into: Uint8Array, at: number): void {
  const stride = 3;
  const candidates: Uint8Array[] = [];
  for (let filter = 0; filter < 5; filter += 1) candidates.push(new Uint8Array(row.length));
  for (let index = 0; index < row.length; index += 1) {
    const left = index >= stride ? row[index - stride] : 0;
    const up = previous[index];
    const upLeft = index >= stride ? previous[index - stride] : 0;
    candidates[0][index] = row[index];
    candidates[1][index] = (row[index] - left) & 255;
    candidates[2][index] = (row[index] - up) & 255;
    candidates[3][index] = (row[index] - ((left + up) >> 1)) & 255;
    candidates[4][index] = (row[index] - paeth(left, up, upLeft)) & 255;
  }
  let best = 0;
  let bestScore = Number.POSITIVE_INFINITY;
  for (let filter = 0; filter < candidates.length; filter += 1) {
    let score = 0;
    for (const byte of candidates[filter]) score += byte < 128 ? byte : 256 - byte;
    if (score < bestScore) {
      bestScore = score;
      best = filter;
    }
  }
  into[at] = best;
  into.set(candidates[best], at + 1);
}

export function encodePng(canvas: Canvas): Uint8Array {
  const { width, height, data } = canvas;
  const header = new Uint8Array(13);
  const headerView = new DataView(header.buffer);
  headerView.setUint32(0, width);
  headerView.setUint32(4, height);
  header[8] = 8; // bit depth
  header[9] = 2; // truecolour, no alpha
  // 10-12: deflate, adaptive filtering, no interlace — all zero.

  const stride = width * 3;
  const raw = new Uint8Array(height * (stride + 1));
  const row = new Uint8Array(stride);
  let previous = new Uint8Array(stride);
  for (let y = 0; y < height; y += 1) {
    for (let index = 0; index < stride; index += 1) {
      const value = data[y * stride + index];
      row[index] = value < 0 ? 0 : value > 255 ? 255 : Math.round(value);
    }
    filterRow(row, previous, raw, y * (stride + 1));
    previous = Uint8Array.from(row);
  }

  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const parts = [
    signature,
    chunk("IHDR", header),
    chunk("IDAT", new Uint8Array(deflateSync(raw, { level: 9 }))),
    chunk("IEND", new Uint8Array(0)),
  ];
  const png = new Uint8Array(parts.reduce((total, part) => total + part.length, 0));
  let at = 0;
  for (const part of parts) {
    png.set(part, at);
    at += part.length;
  }
  return png;
}
