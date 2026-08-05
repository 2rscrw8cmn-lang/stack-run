import { describe, expect, it } from "vitest";
import {
  assertPlacementFits,
  autoPlaceOption,
  courseBelow,
  courseKeys,
  fitsInRow,
  InvalidPlacementError,
  occupiedColumns,
  placementOptions,
  placementsForWeek,
  repackPlacements,
  topRowOfWeek,
  WEEK_COLUMNS,
} from "./placement";
import type { BlockPlacement } from "./types";

function placement(
  workoutId: string,
  weekNumber: number,
  row: number,
  columnStart: number,
  span: 1 | 2 | 3 | 4,
): BlockPlacement {
  return {
    workoutId,
    weekNumber,
    row,
    columnStart,
    span,
    placedAt: "2026-08-04T12:00:00.000Z",
  };
}

const at = (options: ReturnType<typeof placementOptions>) =>
  options.map((option) => `${option.row}:${option.columnStart}`);

describe("fitsInRow", () => {
  it("keeps every block inside the five columns of a course", () => {
    expect(WEEK_COLUMNS).toBe(5);
    expect(fitsInRow(1, 4)).toBe(true);
    expect(fitsInRow(2, 4)).toBe(true);
    expect(fitsInRow(3, 4)).toBe(false);
    expect(fitsInRow(5, 1)).toBe(true);
    expect(fitsInRow(0, 1)).toBe(false);
  });
});

describe("occupiedColumns", () => {
  it("expands each placement across the columns it covers", () => {
    expect([
      ...occupiedColumns([
        placement("a", 1, 0, 2, 3),
        placement("b", 1, 0, 5, 1),
      ]),
    ]).toEqual([2, 3, 4, 5]);
  });
});

describe("placementsForWeek", () => {
  it("selects one week and orders it course by course, left to right", () => {
    const all = [
      placement("c", 2, 0, 1, 1),
      placement("b", 1, 1, 1, 2),
      placement("a", 1, 0, 3, 1),
    ];
    expect(placementsForWeek(all, 1).map((p) => p.workoutId)).toEqual([
      "a",
      "b",
    ]);
  });
});

describe("courseKeys and courseBelow", () => {
  const placements = [
    placement("a", 1, 0, 1, 2),
    placement("b", 1, 1, 1, 3),
    placement("c", 2, 0, 2, 2),
  ];

  it("lists every built course from the ground up", () => {
    expect(courseKeys(placements)).toEqual([
      { weekNumber: 1, row: 0 },
      { weekNumber: 1, row: 1 },
      { weekNumber: 2, row: 0 },
    ]);
  });

  it("finds the course directly beneath, across a week boundary", () => {
    expect(
      courseBelow(placements, { weekNumber: 2, row: 0 }).map((p) => p.workoutId),
    ).toEqual(["b"]);
    expect(
      courseBelow(placements, { weekNumber: 1, row: 1 }).map((p) => p.workoutId),
    ).toEqual(["a"]);
  });

  it("reports nothing beneath the ground course", () => {
    expect(courseBelow(placements, { weekNumber: 1, row: 0 })).toEqual([]);
  });
});

describe("topRowOfWeek", () => {
  it("is -1 for a week nothing has been built into", () => {
    expect(topRowOfWeek([], 4)).toBe(-1);
    expect(topRowOfWeek([placement("a", 1, 2, 1, 1)], 1)).toBe(2);
  });
});

describe("placementOptions", () => {
  it("offers every column of the ground course when the week is empty", () => {
    expect(at(placementOptions(1, 1, []))).toEqual([
      "0:1",
      "0:2",
      "0:3",
      "0:4",
      "0:5",
    ]);
    expect(at(placementOptions(3, 1, []))).toEqual(["0:1", "0:2", "0:3"]);
    expect(at(placementOptions(4, 1, []))).toEqual(["0:1", "0:2"]);
  });

  it("offers the next course up once the current one is started", () => {
    const existing = [placement("a", 1, 0, 1, 3)];
    // Columns 1-3 of course 0 are taken; course 1 is open across the board.
    expect(at(placementOptions(2, 1, existing))).toEqual([
      "0:4",
      "1:1",
      "1:2",
      "1:3",
      "1:4",
    ]);
  });

  it("never offers a course that would float above a gap", () => {
    const existing = [placement("a", 1, 0, 1, 1)];
    const rows = new Set(placementOptions(1, 1, existing).map((o) => o.row));
    expect([...rows]).toEqual([0, 1]);
  });

  it("marks a position supported when at least half its cells rest on the course below", () => {
    const existing = [placement("a", 1, 0, 2, 2)];
    const supported = placementOptions(2, 1, existing)
      .filter((option) => option.row === 1 && option.isSupported)
      .map((option) => option.columnStart);

    // Columns 2 and 3 are built below, so starts 1, 2, and 3 each cover at
    // least one supported cell out of two.
    expect(supported).toEqual([1, 2, 3]);
  });

  it("treats every position on the ground course as supported", () => {
    expect(placementOptions(2, 1, []).every((o) => o.isSupported)).toBe(true);
  });

  it("supports a week's first course from the top course of the week below", () => {
    const existing = [placement("a", 1, 0, 1, 3)];
    const supported = placementOptions(2, 2, existing)
      .filter((option) => option.isSupported)
      .map((option) => option.columnStart);

    expect(supported).toEqual([1, 2, 3]);
  });
});

describe("autoPlaceOption", () => {
  it("centres the block on the ground course", () => {
    expect(autoPlaceOption(placementOptions(1, 1, []))).toMatchObject({
      row: 0,
      columnStart: 3,
    });
    expect(autoPlaceOption(placementOptions(2, 1, []))).toMatchObject({
      row: 0,
      columnStart: 2,
    });
    expect(autoPlaceOption(placementOptions(4, 1, []))).toMatchObject({
      row: 0,
      columnStart: 1,
    });
  });

  it("finishes the lowest open course before starting a new one", () => {
    const existing = [placement("a", 1, 0, 1, 3)];
    expect(autoPlaceOption(placementOptions(2, 1, existing))).toMatchObject({
      row: 0,
      columnStart: 4,
    });
  });

  it("starts a new course when the current one has no room", () => {
    const existing = [
      placement("a", 1, 0, 1, 3),
      placement("b", 1, 0, 4, 2),
    ];
    expect(autoPlaceOption(placementOptions(2, 1, existing))?.row).toBe(1);
  });

  it("prefers a supported position over a more central unsupported one", () => {
    const existing = [placement("a", 1, 0, 1, 2)];
    const chosen = autoPlaceOption(
      placementOptions(2, 1, existing).filter((option) => option.row === 1),
    );

    // Start 2 covers columns 2-3: nearest the centre of the course, and column
    // 2 rests on the block below, so it is supported as well.
    expect(chosen).toMatchObject({ columnStart: 2, isSupported: true });
  });

  it("is deterministic regardless of option order", () => {
    const options = placementOptions(2, 1, [placement("a", 1, 0, 1, 2)]);
    expect(autoPlaceOption([...options].reverse())).toEqual(
      autoPlaceOption(options),
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
        { workoutId: "b", weekNumber: 1, row: 0, columnStart: 1, span: 2 },
        [placement("a", 1, 0, 4, 2)],
      ),
    ).not.toThrow();
  });

  it("rejects a block that would run past the last column", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 1, row: 0, columnStart: 4, span: 3 },
        [],
      ),
    ).toThrow(InvalidPlacementError);
  });

  it("rejects a block that would overlap another in the same course", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 1, row: 0, columnStart: 3, span: 2 },
        [placement("a", 1, 0, 4, 2)],
      ),
    ).toThrow(InvalidPlacementError);
  });

  it("allows the same columns in a different course of the same week", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 1, row: 1, columnStart: 4, span: 2 },
        [placement("a", 1, 0, 4, 2)],
      ),
    ).not.toThrow();
  });

  it("rejects a course that would float above a gap", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 1, row: 3, columnStart: 1, span: 1 },
        [placement("a", 1, 0, 1, 1)],
      ),
    ).toThrow(InvalidPlacementError);
  });

  it("ignores placements in other weeks", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "b", weekNumber: 2, row: 0, columnStart: 4, span: 2 },
        [placement("a", 1, 0, 4, 2)],
      ),
    ).not.toThrow();
  });

  it("does not treat a block as colliding with itself when it moves", () => {
    expect(() =>
      assertPlacementFits(
        { workoutId: "a", weekNumber: 1, row: 0, columnStart: 3, span: 2 },
        [placement("a", 1, 0, 4, 2)],
      ),
    ).not.toThrow();
  });
});

describe("repackPlacements", () => {
  it("re-lays a week that no longer fits one course, keeping its order", () => {
    // What an eight-column week looked like before the grid narrowed.
    const wide = [
      placement("a", 1, 0, 1, 1),
      placement("b", 1, 0, 2, 1),
      placement("c", 1, 0, 3, 1),
      placement("d", 1, 0, 4, 3),
    ];

    expect(
      repackPlacements(wide).map((p) => [p.workoutId, p.row, p.columnStart]),
    ).toEqual([
      ["a", 0, 1],
      ["b", 0, 2],
      ["c", 0, 3],
      ["d", 1, 1],
    ]);
  });

  it("keeps every placement and never exceeds the course width", () => {
    const wide = [
      placement("a", 2, 0, 1, 4),
      placement("b", 2, 0, 5, 4),
      placement("c", 3, 0, 1, 2),
    ];
    const repacked = repackPlacements(wide);

    expect(repacked).toHaveLength(3);
    for (const p of repacked) {
      expect(p.columnStart + p.span - 1).toBeLessThanOrEqual(WEEK_COLUMNS);
    }
  });
});
