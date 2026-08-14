/**
 * A very small anti-aliased polygon rasteriser.
 *
 * `scripts/generate-icons.mjs` already draws this repository's PNGs by hand
 * with nothing but arithmetic and Node's own zlib, and the Crew invite share
 * image follows it: the card is flat colour on flat colour, so a scanline fill
 * with a few subsamples per row is all the quality it needs and it keeps the
 * serverless function free of a native image dependency.
 *
 * Coverage is measured per pixel — `SUBSAMPLES` sample rows, each contributing
 * exact horizontal span coverage — and composited straight over the canvas.
 */

import type { Polygon } from "./geometry.js";

export interface Canvas {
  width: number;
  height: number;
  /**
   * Opaque RGB, three channels per pixel, top row first.
   *
   * Kept as floats while drawing so that stacking a dozen half-covered edges
   * does not accumulate a rounding error; the PNG encoder rounds once.
   */
  data: Float32Array;
}

export type Rgb = readonly [number, number, number];

/** Vertical sample rows per pixel; horizontal coverage is exact. */
const SUBSAMPLES = 5;

export function createCanvas(width: number, height: number, background: Rgb): Canvas {
  const data = new Float32Array(width * height * 3);
  for (let index = 0; index < data.length; index += 3) {
    data[index] = background[0];
    data[index + 1] = background[1];
    data[index + 2] = background[2];
  }
  return { width, height, data };
}

export function parseColor(color: string): Rgb {
  const hex = color.replace("#", "");
  const full = hex.length === 3 ? [...hex].map((character) => character + character).join("") : hex;
  const value = Number.parseInt(full, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function blend(canvas: Canvas, x: number, y: number, color: Rgb, alpha: number): void {
  if (alpha <= 0 || x < 0 || y < 0 || x >= canvas.width || y >= canvas.height) return;
  const index = (y * canvas.width + x) * 3;
  const weight = Math.min(1, alpha);
  canvas.data[index] += (color[0] - canvas.data[index]) * weight;
  canvas.data[index + 1] += (color[1] - canvas.data[index + 1]) * weight;
  canvas.data[index + 2] += (color[2] - canvas.data[index + 2]) * weight;
}

/** Paints every pixel from a function of its position: gradients, fields. */
export function paint(canvas: Canvas, color: (x: number, y: number) => Rgb): void {
  for (let y = 0; y < canvas.height; y += 1) {
    for (let x = 0; x < canvas.width; x += 1) {
      const [red, green, blue] = color(x, y);
      const index = (y * canvas.width + x) * 3;
      canvas.data[index] = red;
      canvas.data[index + 1] = green;
      canvas.data[index + 2] = blue;
    }
  }
}

export interface FillOptions {
  color: string | Rgb;
  rule?: "nonzero" | "evenodd";
  opacity?: number;
}

interface Edge {
  topY: number;
  bottomY: number;
  x: number;
  slope: number;
  winding: 1 | -1;
}

function edgesOf(polygons: readonly Polygon[]): { edges: Edge[]; top: number; bottom: number } {
  const edges: Edge[] = [];
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

/**
 * Fills polygons as one shape.
 *
 * Passing every ring of a path in a single call is what makes the fill rules
 * mean anything: an even-odd emblem plate is a solid ring plus its cut-outs,
 * and a stroke is a pile of overlapping pieces unioned by the nonzero rule.
 */
export function fillPolygons(
  canvas: Canvas,
  polygons: readonly Polygon[],
  options: FillOptions,
): void {
  const color = typeof options.color === "string" ? parseColor(options.color) : options.color;
  const opacity = options.opacity ?? 1;
  if (opacity <= 0 || !polygons.length) return;
  const evenOdd = options.rule === "evenodd";
  const { edges, top, bottom } = edgesOf(polygons);
  if (!edges.length) return;

  const firstRow = Math.max(0, Math.floor(top));
  const lastRow = Math.min(canvas.height - 1, Math.ceil(bottom));
  const coverage = new Float32Array(canvas.width);
  const crossings: { x: number; winding: 1 | -1 }[] = [];

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
        winding += evenOdd ? 1 : crossings[index].winding;
        const inside = evenOdd ? winding % 2 !== 0 : winding !== 0;
        if (!inside) continue;
        const from = Math.max(0, crossings[index].x);
        const to = Math.min(canvas.width, crossings[index + 1].x);
        if (to <= from) continue;
        touched = true;
        // Exact horizontal coverage: whole pixels plus the fractional ends.
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
      if (coverage[x] > 0) blend(canvas, x, row, color, coverage[x] * opacity);
    }
  }
}
