import { describe, expect, it } from "vitest";
import {
  flattenPath,
  pathPolygons,
  rectPolygon,
  roundedRectPolygon,
  strokePolygons,
  translated,
  type Polygon,
} from "./geometry.js";

function bounds(polygons: readonly Polygon[]) {
  const xs = polygons.flat().map((point) => point.x);
  const ys = polygons.flat().map((point) => point.y);
  return {
    left: Math.min(...xs),
    right: Math.max(...xs),
    top: Math.min(...ys),
    bottom: Math.max(...ys),
  };
}

describe("Path flattening", () => {
  it("reads the shorthand the emblem shapes are written in", () => {
    const [contour] = flattenPath("M25 78 H155 V132 H25 Z");
    expect(contour.closed).toBe(true);
    expect(contour.points).toEqual([
      { x: 25, y: 78 },
      { x: 155, y: 78 },
      { x: 155, y: 132 },
      { x: 25, y: 132 },
    ]);
  });

  it("keeps each subpath of a cut-out shape separate", () => {
    const polygons = pathPolygons("M25 78 H155 V132 H25 Z M56 92 H124 V118 H56 Z");
    expect(polygons).toHaveLength(2);
  });

  it("places a drawing by scale and offset", () => {
    const polygons = pathPolygons("M0 0 H10 V10 H0 Z", { scaleX: 3, scaleY: 3, x: 100, y: 50 });
    expect(bounds(polygons)).toEqual({ left: 100, right: 130, top: 50, bottom: 80 });
  });

  it("nests an operation's own offset inside the placement", () => {
    const placement = translated({ scaleX: 2, scaleY: 2, x: 10, y: 10 }, 0, 5);
    expect(placement.y).toBe(20);
  });

  it("flattens a curve into steps small enough to read as smooth", () => {
    const [contour] = flattenPath("M0 100 Q0 0 100 0");
    expect(contour.points[0]).toEqual({ x: 0, y: 100 });
    expect(contour.points.at(-1)).toEqual({ x: 100, y: 0 });
    for (let index = 1; index < contour.points.length; index += 1) {
      const from = contour.points[index - 1];
      const to = contour.points[index];
      expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeLessThan(4);
    }
  });

  it("spends its steps where they show: a bigger curve gets more of them", () => {
    const small = flattenPath("M0 10 Q0 0 10 0")[0];
    const large = flattenPath("M0 10 Q0 0 10 0", { scaleX: 20, scaleY: 20, x: 0, y: 0 })[0];
    expect(large.points.length).toBeGreaterThan(small.points.length);
  });

  it("ignores a command it does not know instead of losing the path", () => {
    const polygons = pathPolygons("M0 0 A5 5 0 0 1 10 10 M20 20 H30 V30 H20 Z");
    expect(polygons.at(-1)).toHaveLength(4);
  });
});

describe("Stroking", () => {
  it("covers the stroke's full width on both sides of the line", () => {
    const [contour] = flattenPath("M20 50 H80");
    const polygons = strokePolygons(contour, { width: 10 });
    expect(bounds(polygons)).toEqual({ left: 20, right: 80, top: 45, bottom: 55 });
  });

  it("extends a square cap past the end of the line", () => {
    const [contour] = flattenPath("M20 50 H80");
    const polygons = strokePolygons(contour, { width: 10, cap: "square" });
    expect(bounds(polygons)).toEqual({ left: 15, right: 85, top: 45, bottom: 55 });
  });

  it("fills the outside of a corner so a mitred frame keeps its point", () => {
    const [contour] = flattenPath("M20 20 H80 V80");
    const polygons = strokePolygons(contour, { width: 20, join: "miter" });
    // The mitre reaches the corner of the outer offset, ten each way.
    expect(bounds(polygons).right).toBe(90);
    expect(bounds(polygons).top).toBe(10);
  });

  it("bevels a spike instead of letting the mitre run away", () => {
    const [contour] = flattenPath("M0 0 L100 0 L0 2");
    const polygons = strokePolygons(contour, { width: 10, join: "miter", miterLimit: 4 });
    expect(bounds(polygons).right).toBeLessThan(140);
  });

  it("closes a closed contour, so a ring has no seam", () => {
    const [contour] = flattenPath("M20 20 H80 V80 H20 Z");
    const open = strokePolygons({ ...contour, closed: false }, { width: 10 });
    const closed = strokePolygons(contour, { width: 10 });
    expect(closed.length).toBeGreaterThan(open.length);
  });

  it("has nothing to stroke on a degenerate contour", () => {
    expect(strokePolygons({ points: [{ x: 5, y: 5 }], closed: false }, { width: 4 })).toEqual([]);
  });
});

describe("Panels", () => {
  it("keeps a rectangle's four corners", () => {
    expect(rectPolygon(10, 20, 30, 40)).toHaveLength(4);
  });

  it("rounds a corner inside the rectangle it belongs to", () => {
    const polygon = roundedRectPolygon(0, 0, 100, 40, 8);
    expect(bounds([polygon])).toEqual({ left: 0, right: 100, top: 0, bottom: 40 });
    expect(polygon.some((point) => point.x === 0 && point.y === 0)).toBe(false);
  });

  it("falls back to square corners when there is no radius", () => {
    expect(roundedRectPolygon(0, 0, 10, 10, 0)).toEqual(rectPolygon(0, 0, 10, 10));
  });
});
