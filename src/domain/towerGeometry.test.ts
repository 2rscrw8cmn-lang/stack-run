import { describe, expect, it } from "vitest";
import {
  blockRect,
  columnOfUnit,
  columnPhrase,
  columnSpanOf,
  GRID_COLUMNS,
  GRID_UNITS,
  toPlacementUnits,
  unitColumnStart,
  UNITS_PER_COLUMN,
  UNITS_PER_COURSE,
  unitsAcross,
  unitsUp,
} from "./towerGeometry.js";
import {
  footprintFor,
  handFootprint,
  isRotated,
  unitsFromLegacyPlacement,
  type Footprint,
} from "./footprint.js";
import { fitsInGrid, placementOptions } from "./placement.js";
import {
  crewBuildFootprint,
  crewBuildLandingOptions,
  CREW_BUILD_UNITS,
} from "../crew/crewBuild.js";
import { resolveHand } from "../features/build/placementHand.js";
import type { CrewBuildRun } from "../crew/types.js";
import type { RunActivityType, RunLog } from "./types.js";

/**
 * The logical placement sub-grid (issue #206).
 *
 * Rotation and the tower's proportions had been trading places: making a
 * column square kept a turned block honest and made the tower a wall of tiles;
 * declaring a course height against fluid columns kept the tower compact and
 * made a turned block a different rectangle. This is the arithmetic that lets
 * both be true — a square unit, two to a column — and the behaviour that has
 * to survive it.
 */

function runLog(miles: number, activityType: RunActivityType): RunLog {
  return {
    id: `run-${miles}-${activityType}`,
    workoutId: null,
    completedDate: "2026-08-10",
    distanceMiles: miles,
    durationSeconds: 2400,
    activityType,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
    source: "manual",
    externalSource: null,
    importedMetrics: null,
  };
}

function crewRun(miles: number, activityType: RunActivityType): CrewBuildRun {
  return {
    id: `crew-${miles}-${activityType}`,
    userId: "runner",
    displayName: "Runner",
    accentColor: null,
    localDate: "2026-08-10",
    activityType,
    distanceMiles: miles,
    durationSeconds: 2400,
    createdAt: "2026-08-10T12:00:00Z",
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildRotated: false,
    crewBuildPlacedAt: null,
  };
}

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

describe("the square placement unit", () => {
  it("subdivides a column and leaves a course alone", () => {
    expect(UNITS_PER_COLUMN).toBe(2);
    expect(UNITS_PER_COURSE).toBe(1);
    expect(GRID_UNITS).toBe(GRID_COLUMNS * UNITS_PER_COLUMN);
    expect(unitsAcross(4)).toBe(8);
    expect(unitsUp(3)).toBe(3);
  });

  it("puts a column's first unit where the column starts", () => {
    expect(unitColumnStart(1)).toBe(1);
    expect(unitColumnStart(8)).toBe(15);
    expect(columnOfUnit(1)).toBe(1);
    expect(columnOfUnit(2)).toBe(1);
    expect(columnOfUnit(3)).toBe(2);
    expect(columnOfUnit(GRID_UNITS)).toBe(GRID_COLUMNS);
  });

  it("keeps a turned block the same physical rectangle, at any unit size", () => {
    // The invariant the whole sub-grid exists for, stated without any CSS: a
    // unit is the same length on both axes, so a rotation can only swap a
    // rectangle's sides.
    for (const earned of EARNED) {
      for (const unitPx of [12, 19.28, 26, 40]) {
        const flat = blockRect(handFootprint(earned, false), unitPx);
        const onEnd = blockRect(handFootprint(earned, true), unitPx);

        expect(onEnd.height).toBeCloseTo(flat.width, 10);
        expect(onEnd.width).toBeCloseTo(flat.height, 10);
      }
    }
  });

  it("leaves an unrotated block wider than it is tall", () => {
    // No earned block is ever drawn taller than it is wide until someone
    // turns it: the sub-grid doubles the width axis, and nothing is earned
    // taller in courses than it is wide in columns.
    for (const earned of EARNED) {
      const units = toPlacementUnits(earned);
      expect(units.width).toBeGreaterThanOrEqual(units.height);
    }
    // The ordinary brick is the 2:1 one the tower is made of.
    expect(toPlacementUnits({ width: 1, height: 1 })).toEqual({
      width: 2,
      height: 1,
    });
    // One earned block comes out square, and it is the only one: a single
    // column standing two courses. It has no second orientation, which is why
    // `canRotateFootprint` has to decide squareness in units rather than in
    // columns and courses.
    const square = EARNED.filter((earned) => {
      const units = toPlacementUnits(earned);
      return units.width === units.height;
    });
    expect(square).toEqual([{ width: 1, height: 2 }]);
  });

  it("names a position by the columns the tower shows, not the units", () => {
    // Units are the packer's vocabulary. "Columns 3 through 5" is a place a
    // person can look at; "units 5 through 10" is not.
    expect(columnSpanOf(unitColumnStart(3), unitsAcross(3))).toEqual({
      first: 3,
      last: 5,
    });
    expect(columnPhrase(unitColumnStart(3), unitsAcross(3))).toBe(
      "columns 3 through 5",
    );
    expect(columnPhrase(unitColumnStart(4), unitsAcross(1))).toBe("column 4");
    // A turned block standing on half a column names the column it is in.
    expect(columnPhrase(7, 1)).toBe("column 4");
  });
});

describe("grid bounds at the right edge", () => {
  it("stops the widest block exactly where the grid ends", () => {
    const race = handFootprint({ width: 4, height: 1 }, false);
    expect(race.width).toBe(8);
    expect(fitsInGrid(GRID_UNITS - race.width + 1, race.width)).toBe(true);
    expect(fitsInGrid(GRID_UNITS - race.width + 2, race.width)).toBe(false);
  });

  it("lets a turned block reach the last unit, and no further", () => {
    const turned = handFootprint({ width: 4, height: 1 }, true);
    expect(turned.width).toBe(1);
    expect(fitsInGrid(GRID_UNITS, turned.width)).toBe(true);
    expect(fitsInGrid(GRID_UNITS + 1, turned.width)).toBe(false);
  });

  it("offers no landing that runs off the grid, turned or not", () => {
    for (const earned of EARNED) {
      for (const rotated of [false, true]) {
        const footprint = handFootprint(earned, rotated);
        const options = placementOptions(footprint.width, footprint.height, []);
        expect(options.length).toBeGreaterThan(0);
        for (const option of options) {
          expect(option.columnStart).toBeGreaterThanOrEqual(1);
          expect(option.columnEnd).toBeLessThanOrEqual(GRID_UNITS);
        }
      }
    }
  });
});

describe("rotation never relocates the block", () => {
  it("keeps the chosen anchor across a turn", () => {
    // Issue #204's sharpest rule, re-checked on the finer grid: turning a
    // block changes its footprint and nothing about where it is standing.
    const earned = { width: 4, height: 1 } as const;
    const chosen = "5";

    const flat = handFootprint(earned, false);
    const before = resolveHand(
      placementOptions(flat.width, flat.height, []),
      chosen,
      flat,
    );
    const turned = handFootprint(earned, true);
    const after = resolveHand(
      placementOptions(turned.width, turned.height, []),
      chosen,
      turned,
    );

    expect(before.candidate?.columnStart).toBe(5);
    expect(after.candidate?.columnStart).toBe(5);
    // ...and the footprint really did change underneath it.
    expect(after.candidate!.columnEnd).toBeLessThan(before.candidate!.columnEnd);
  });

  it("refuses rather than moving when the turn no longer fits", () => {
    // The other half of the same rule: a turn that runs off the grid is
    // reported, never silently corrected by sliding the block left.
    const turned = handFootprint({ width: 4, height: 1 }, false);
    const hand = resolveHand(
      placementOptions(turned.width, turned.height, []),
      String(GRID_UNITS - 1),
      turned,
    );

    expect(hand.candidate).toBeNull();
    expect(hand.blockedReason).toContain("Rotate it back");
  });

  it("reads a stored placement back in the orientation it was left", () => {
    const earned = footprintFor(runLog(9, "long"));
    expect(isRotated(handFootprint(earned, true), earned)).toBe(true);
    expect(isRotated(handFootprint(earned, false), earned)).toBe(false);
  });
});

describe("Crew Build and Personal Build share the geometry", () => {
  it("places on the same grid", () => {
    expect(CREW_BUILD_UNITS).toBe(GRID_UNITS);
  });

  it("gives the same run the same footprint on either tower", () => {
    for (const [miles, type] of [
      [2, "easy"],
      [4, "long"],
      [6, "intervals"],
      [9, "long"],
      [26.2, "race"],
    ] as const) {
      for (const rotated of [false, true]) {
        expect(handFootprint(crewBuildFootprint(crewRun(miles, type)), rotated)).toEqual(
          handFootprint(footprintFor(runLog(miles, type)), rotated),
        );
      }
    }
  });

  it("offers landings across the same anchors on an empty tower", () => {
    const run = crewRun(4, "long");
    const footprint = handFootprint(crewBuildFootprint(run), false);

    const crew = crewBuildLandingOptions(run, []).map(
      (option) => option.columnStart,
    );
    const personal = placementOptions(
      footprint.width,
      footprint.height,
      [],
    ).map((option) => option.columnStart);

    expect(crew).toEqual(personal);
    expect(crew[crew.length - 1]).toBe(GRID_UNITS - footprint.width + 1);
  });
});

describe("towers built before the sub-grid", () => {
  it("comes back standing exactly where it was left", () => {
    // Schema 12's conversion. A block covering columns 3 and 4 covers units 5
    // through 8 — the same span of tower, counted finer — so nothing about an
    // existing tower appears to move, stretch or turn.
    const legacy = { runLogId: "a", row: 2, columnStart: 3, width: 2, height: 1 };
    const converted = unitsFromLegacyPlacement(legacy);

    expect(converted).toEqual({
      runLogId: "a",
      row: 2,
      columnStart: 5,
      width: 4,
      height: 1,
    });
    expect(columnSpanOf(converted.columnStart, converted.width)).toEqual({
      first: 3,
      last: 4,
    });
    // The block it draws is the one the run still earns, unturned.
    expect(converted.width).toBe(unitsAcross(legacy.width));
    expect(converted.height).toBe(unitsUp(legacy.height));
  });
});
