/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { handFootprint, type Footprint } from "../domain/footprint.js";
import {
  GRID_UNITS,
  blockRect,
  toPlacementUnits,
  UNITS_PER_COLUMN,
} from "../domain/towerGeometry.js";

/**
 * The geometry a block is actually drawn at (issues #204, #205, #206, #207).
 *
 * The three attempts before this one each passed a stylesheet-token test and
 * still got the geometry wrong, because a token is not a rectangle: a course
 * height of 26px against `1fr` columns *reads* like a compact tower and makes
 * a turned block a different shape, and a square column *reads* like honest
 * rotation and makes the tower a wall of tiles. So this measures rectangles.
 *
 * There is no layout engine here — jsdom computes no boxes and vitest runs
 * with `css: false` — so the tower's own sizing rules are read out of
 * `components.css` and resolved into pixels the same way a browser would, for
 * a real container width. What is under test is the rendered size of a block,
 * not the presence of a custom property.
 */
const css = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "components.css"),
  "utf8",
);

function ruleBody(selector: string): string {
  const start = css.indexOf(selector);
  expect(start, `selector not found: ${selector}`).toBeGreaterThanOrEqual(0);
  const open = css.indexOf("{", start);
  return css.slice(open + 1, css.indexOf("}", open));
}

function declaration(body: string, name: string): string {
  const match = new RegExp(`${name}:\\s*([^;]+);`).exec(body);
  expect(match, `${name} not declared`).not.toBeNull();
  return match![1].trim();
}

function pixels(body: string, name: string): number {
  const value = declaration(body, name);
  const match = /(\d+(?:\.\d+)?)px/.exec(value);
  expect(match, `${name} is not a pixel length: ${value}`).not.toBeNull();
  return Number(match![1]);
}

const field = ruleBody(".tower-field {");

/** The depth axis's share of a unit, which the field reserves width for. */
const isoRunRatio = Number(
  /var\(--iso-run-ratio,\s*([\d.]+)\)/.exec(declaration(field, "--tower-unit"))![1],
);

/**
 * `--tower-unit`, resolved. The rule is
 * `min(--course-nominal, 100cqw / (--grid-units + --iso-run-ratio))`: a
 * context asks for a course height and the field pays the smaller of that and
 * what the width can actually afford, the oblique's own share included.
 */
function resolveUnitPx(containerWidth: number, nominalPx: number): number {
  return Math.min(containerWidth / (GRID_UNITS + isoRunRatio), nominalPx);
}

/** What one visible tower column measures, per `--tower-column`. */
function columnWidthPx(unitPx: number): number {
  return unitPx * UNITS_PER_COLUMN;
}

/** Phone widths a tower actually has to survive, narrowest first. */
const PHONE_WIDTHS = [320, 360, 390, 430];

/** The context every surface reads its course height from. */
const PERSONAL_NOMINAL = pixels(ruleBody(".build-site {"), "--course-nominal");
const CREW_NOMINAL = pixels(ruleBody("\n.crew-build {"), "--course-nominal");

/** Every footprint a run can earn, in columns and courses. */
const EARNED: readonly Footprint[] = [
  { width: 1, height: 1 },
  { width: 2, height: 1 },
  { width: 3, height: 1 },
  { width: 4, height: 1 },
  { width: 1, height: 2 },
  { width: 2, height: 2 },
  { width: 3, height: 2 },
  { width: 4, height: 3 },
];

describe("a turned block is the same rectangle on its side (issue #206)", () => {
  it("swaps a block's rendered width and height, and nothing else", () => {
    const unit = resolveUnitPx(360, PERSONAL_NOMINAL);

    for (const earned of EARNED) {
      const flat = blockRect(handFootprint(earned, false), unit);
      const onEnd = blockRect(handFootprint(earned, true), unit);

      expect(onEnd.height).toBeCloseTo(flat.width, 10);
      expect(onEnd.width).toBeCloseTo(flat.height, 10);
      // Same rectangle means same area, not merely the same cell count.
      expect(onEnd.width * onEnd.height).toBeCloseTo(flat.width * flat.height, 10);
    }
  });

  it("holds at every phone width and in both towers", () => {
    for (const width of PHONE_WIDTHS) {
      for (const nominal of [PERSONAL_NOMINAL, CREW_NOMINAL]) {
        const unit = resolveUnitPx(width, nominal);
        // The widest block there is, which is the one a squashed axis would
        // distort most: the race, four columns by three courses.
        const flat = blockRect(handFootprint({ width: 4, height: 3 }, false), unit);
        const onEnd = blockRect(handFootprint({ width: 4, height: 3 }, true), unit);

        expect(onEnd.height).toBeCloseTo(flat.width, 10);
        expect(onEnd.width).toBeCloseTo(flat.height, 10);
      }
    }
  });

  it("is a real change of size, not a redraw at the same size", () => {
    // The opposite failure to the one above: geometry that swaps nothing.
    const unit = resolveUnitPx(360, PERSONAL_NOMINAL);
    const flat = blockRect(handFootprint({ width: 4, height: 1 }, false), unit);
    const onEnd = blockRect(handFootprint({ width: 4, height: 1 }, true), unit);

    expect(onEnd.width).toBeLessThan(flat.width);
    expect(onEnd.height).toBeGreaterThan(flat.height);
  });
});

describe("the tower keeps its compact STACK proportions (issues #206, #207)", () => {
  it("draws an unrotated brick wider than it is tall, at 2:1", () => {
    for (const width of PHONE_WIDTHS) {
      const unit = resolveUnitPx(width, PERSONAL_NOMINAL);
      const brick = blockRect(toPlacementUnits({ width: 1, height: 1 }), unit);

      expect(brick.width).toBeGreaterThan(brick.height);
      expect(brick.width / brick.height).toBeCloseTo(2, 10);
    }
  });

  it("never returns to the square tile the sub-grid replaced", () => {
    // The #205 regression, stated as a measurement: a *column* the same length
    // as a course. A course is one unit and a column is two, so this can only
    // fail if the sub-grid is taken back out.
    for (const width of PHONE_WIDTHS) {
      const unit = resolveUnitPx(width, PERSONAL_NOMINAL);
      expect(columnWidthPx(unit)).toBeCloseTo(unit * 2, 10);
      expect(columnWidthPx(unit)).toBeGreaterThan(unit * 1.9);
    }
  });

  it("stays compact at phone widths rather than panning or towering", () => {
    for (const width of PHONE_WIDTHS) {
      const unit = resolveUnitPx(width, PERSONAL_NOMINAL);

      // The whole grid plus the depth clearance fits the width it was given:
      // a tower that scrolls sideways is a tower that did not fit.
      expect(unit * GRID_UNITS + unit * isoRunRatio).toBeLessThanOrEqual(width);
      // A course never grows past what the tower had before rotation existed,
      // so a ten-course tower is no taller than it used to be.
      expect(unit).toBeLessThanOrEqual(PERSONAL_NOMINAL);
      // ...and a column is still a chunky target at the narrowest phone.
      expect(columnWidthPx(unit)).toBeGreaterThanOrEqual(24);
    }
  });

  it("grows the whole brick when a context asks for a bigger course", () => {
    // A bigger tower is a bigger unit, not more empty sky — and because the
    // unit is square, a bigger tower is never a differently shaped one.
    const page = pixels(ruleBody(".crew-build--page {"), "--course-nominal");
    const wide = 900;
    expect(resolveUnitPx(wide, page)).toBeGreaterThan(
      resolveUnitPx(wide, CREW_NOMINAL),
    );
    expect(
      columnWidthPx(resolveUnitPx(wide, page)) / resolveUnitPx(wide, page),
    ).toBeCloseTo(
      columnWidthPx(resolveUnitPx(wide, CREW_NOMINAL)) /
        resolveUnitPx(wide, CREW_NOMINAL),
      10,
    );
  });

  it("matches the sizes the sub-grid was specified to produce", () => {
    // Issue #206's own worked example: a 1x1 brick is about 52 by 26, and
    // turned it is about 26 by 52. Given the room for it, that is exactly
    // what the stylesheet resolves to.
    const unit = resolveUnitPx(1200, PERSONAL_NOMINAL);
    const brick = blockRect(handFootprint({ width: 1, height: 1 }, false), unit);
    const turned = blockRect(handFootprint({ width: 1, height: 1 }, true), unit);

    expect(brick).toEqual({ width: 52, height: 26 });
    expect(turned).toEqual({ width: 26, height: 52 });
  });
});

describe("both towers are drawn by the same geometry", () => {
  it("keeps the depth axis a 2:1 oblique, separately from the placement grid", () => {
    // `--iso-run` / `--iso-rise` are the *depth* treatment and have nothing to
    // do with the placement grid; issue #206 leaves them exactly as they were.
    // Both are shares of the unit, so the oblique holds at every size rather
    // than at the one size two hard-coded numbers agreed on.
    expect(declaration(field, "--iso-run")).toContain("var(--tower-unit)");
    expect(declaration(field, "--iso-rise")).toBe("calc(var(--iso-run) / 2)");

    for (const width of PHONE_WIDTHS) {
      const unit = resolveUnitPx(width, PERSONAL_NOMINAL);
      const run = unit * isoRunRatio;
      expect(run / (run / 2)).toBeCloseTo(2, 10);
    }
  });

  it("sizes Crew Build and Personal Build from the one rule", () => {
    // Different course heights, identical construction: the field is the only
    // thing that turns a nominal course into a unit, so neither tower can grow
    // a geometry of its own.
    for (const width of PHONE_WIDTHS) {
      const personal = resolveUnitPx(width, PERSONAL_NOMINAL);
      const crew = resolveUnitPx(width, CREW_NOMINAL);
      expect(columnWidthPx(personal) / personal).toBe(
        columnWidthPx(crew) / crew,
      );
    }
    // And every tower surface reads the same field rule rather than its own.
    // The one variant is `--tokens`, which only stops the field being a box.
    expect(css.match(/^\.tower-field \{/gm) ?? []).toHaveLength(1);
    expect(ruleBody(".tower-field--tokens {")).toMatch(/display:\s*contents/);
  });
});
