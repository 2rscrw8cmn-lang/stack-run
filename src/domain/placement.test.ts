import { describe, expect, it } from "vitest";
import {
  assertPlacementFits,
  autoPlaceOption,
  fitsInRow,
  InvalidPlacementError,
  occupiedColumns,
  placementOptions,
  placementsForWeek,
  WEEK_COLUMNS,
} from "./placement";
import type { BlockPlacement } from "./types";

function placement(
  workoutId: string,
  weekNumber: number,
  columnStart: number,
  span: 1 | 2 | 3 | 4,
): BlockPlacement {
  return {
    workoutId,
    weekNumber,
    columnStart,
    span,
    placedAt: "2026-08-04T12:00:00.000Z",
  };
}

const starts = (options: ReturnType<typeof placementOptions>) =>
  options.map((option) => option.columnStart);

describe("fitsInRow", () => {
  it("keeps every block inside the eight columns", () => {
    expect(WEEK_COLUMNS).toBe(8);
    expect(fitsInRow(1, 4)).toBe(true);
    expect(fitsInRow(5, 4)).toBe(true);
    expect(fitsInRow(6, 4)).toBe(false);
    expect(fitsInRow(8, 1)).toBe(true);
    expect(fitsInRow(0, 1)).toBe(false);
  });
});

describe("occupiedColumns", () => {
  it("expands each placement across the columns it covers", () => {
    expect([
      ...occupiedColumns([placement("a", 1, 2, 3), placement("b", 1, 7, 2)]),
    ]).toEqual([2, 3, 4, 7, 8]);
  });
});

describe("placementsForWeek", () => {
  it("selects one week and orders it left to right", () => {
    const all = [
      placement("c", 2, 1, 1),
      placement("b", 1, 5, 2),
      placement("a", 1, 1, 1),
    ];
    expect(placementsForWeek(all, 1).map((p) => p.workoutId)).toEqual(["a", "b"]);
  });
});

describe("placementOptions", () => {
  it("offers every column a block fits in when the week is empty", () => {
    expect(starts(placementOptions(1, [], [], true))).toEqual([
      1, 2, 3, 4, 5, 6, 7, 8,
    ]);
    expect(starts(placementOptions(3, [], [], true))).toEqual([
      1, 2, 3, 4, 5, 6,
    ]);
    expect(starts(placementOptions(4, [], [], true))).toEqual([1, 2, 3, 4, 5]);
  });

  it("rejects positions that would overlap a block already placed", () => {
    const existing = [placement("a", 2, 4, 2)];
    // Columns 4 and 5 are taken, so a span-2 block cannot start at 3, 4, or 5.
    expect(starts(placementOptions(2, existing, [], false))).toEqual([
      1, 2, 6, 7,
    ]);
  });

  it("reports no options when the course is full", () => {
    const full = [
      placement("a", 2, 1, 4),
      placement("b", 2, 5, 4),
    ];
    expect(placementOptions(1, full, [], false)).toEqual([]);
  });

  it("marks a position supported when at least half its cells rest on the course below", () => {
    const below = [placement("a", 1, 3, 2)];
    const options = placementOptions(2, [], below, false);

    const supported = options
      .filter((option) => option.isSupported)
      .map((option) => option.columnStart);
    // Columns 3 and 4 are built below, so starts 2, 3, and 4 each cover one
    // supported cell out of two.
    expect(supported).toEqual([2, 3, 4]);
  });

  it("treats every position on the ground course as supported", () => {
    const options = placementOptions(2, [], [], true);
    expect(options.every((option) => option.isSupported)).toBe(true);
  });
});

describe("autoPlaceOption", () => {
  it("centres the block on the ground course", () => {
    expect(autoPlaceOption(placementOptions(1, [], [], true))?.columnStart).toBe(
      4,
    );
    expect(autoPlaceOption(placementOptions(2, [], [], true))?.columnStart).toBe(
      4,
    );
    expect(autoPlaceOption(placementOptions(4, [], [], true))?.columnStart).toBe(
      3,
    );
  });

  it("prefers a supported position over a more central unsupported one", () => {
    const below = [placement("a", 1, 1, 2)];
    const chosen = autoPlaceOption(placementOptions(2, [], below, false));

    // Centre would be column 4, but only starts 1 and 2 rest on the course
    // below; start 2 is the nearer of those to the centre.
    expect(chosen?.columnStart).toBe(2);
    expect(chosen?.isSupported).toBe(true);
  });

  it("falls back to any open position when nothing is supported", () => {
    const below = [placement("a", 1, 1, 1)];
    // A span-3 block can never get half its cells onto a single supported
    // column, so no option is supported and the centre rule applies.
    const chosen = autoPlaceOption(placementOptions(3, [], below, false));
    expect(chosen?.isSupported).toBe(false);
    expect(chosen?.columnStart).toBe(3);
  });

  it("breaks a tie by choosing the leftmost position", () => {
    // Starts 4 and 5 are equally far from the centre for a span-1 block.
    expect(autoPlaceOption(placementOptions(1, [], [], true))?.columnStart).toBe(
      4,
    );
  });

  it("is deterministic regardless of option order", () => {
    const options = placementOptions(2, [], [], true);
    expect(autoPlaceOption([...options].reverse())?.columnStart).toBe(
      autoPlaceOption(options)?.columnStart,
    );
  });

  it("returns null when there is no room", () => {
    expect(autoPlaceOption([])).toBeNull();
  });
});

describe("assertPlacementFits", () => {
  it("accepts a placement in free columns", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 1, columnStart: 1, span: 2 },
        [placement("a", 1, 5, 2)],
      ),
    ).not.toThrow();
  });

  it("rejects a block that would run past column 8", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 1, columnStart: 7, span: 3 },
        [],
      ),
    ).toThrow(InvalidPlacementError);
  });

  it("rejects a block that would overlap another in the same week", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 1, columnStart: 4, span: 2 },
        [placement("a", 1, 5, 2)],
      ),
    ).toThrow(InvalidPlacementError);
  });

  it("ignores placements in other weeks", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 2, columnStart: 5, span: 2 },
        [placement("a", 1, 5, 2)],
      ),
    ).not.toThrow();
  });

  it("does not treat a block as colliding with itself when it moves", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "a", weekNumber: 1, columnStart: 4, span: 2 },
        [placement("a", 1, 5, 2)],
      ),
    ).not.toThrow();
  });
});
