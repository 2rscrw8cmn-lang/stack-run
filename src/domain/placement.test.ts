import { describe, expect, it } from "vitest";
import {
  assertPlacementFits,
  autoPlaceOption,
  canMove,
  faceVisibilityOf,
  fitsInGrid,
  GRID_UNITS,
  InvalidPlacementError,
  landingRow,
  lastColumnOf,
  newestPlacement,
  occupiedCellsOf,
  placementOptions,
  repackPlacements,
  skylineOf,
  topOf,
  voidsOf,
} from "./placement.js";
import type { BlockPlacement } from "./types.js";

/**
 * Coordinates here are logical placement units, not visible columns: the tower
 * is `GRID_UNITS` across and a 1-column brick is 2 units wide (issue #206).
 */
function placement(
  runLogId: string,
  row: number,
  columnStart: number,
  width: number,
  height = 1,
  placedAt = "2026-08-04T12:00:00.000Z",
): BlockPlacement {
  return { runLogId, row, columnStart, width, height, placedAt };
}

const columns = (options: ReturnType<typeof placementOptions>) =>
  options.map((option) => `${option.columnStart}@${option.row}`);

describe("skylineOf", () => {
  it("is flat ground when nothing is placed", () => {
    expect(skylineOf([])).toEqual(new Array(GRID_UNITS).fill(0));
  });

  it("takes the top of each block across the units it spans", () => {
    const skyline = skylineOf([placement("a", 0, 2, 3, 2)]);
    expect(skyline.slice(0, 5)).toEqual([0, 2, 2, 2, 0]);
    expect(skyline).toHaveLength(GRID_UNITS);
  });

  it("takes the highest block when two share a column", () => {
    const skyline = skylineOf([
      placement("a", 0, 1, 2, 1),
      placement("b", 1, 1, 1, 3),
    ]);
    expect(skyline[0]).toBe(4);
    expect(skyline[1]).toBe(1);
  });
});

describe("occupiedCellsOf / faceVisibilityOf / voidsOf", () => {
  // Deliberately not `BlockPlacement`: these are the primitives Crew Build's
  // `CrewBuildBlock` also satisfies structurally (issue #65), so the
  // geometry is exercised here against a plain footprint shape rather than
  // Personal's own placement type.
  const footprint = (row: number, columnStart: number, width: number, height = 1) => ({
    row,
    columnStart,
    width,
    height,
  });

  it("fills every cell a block spans, for any structurally-compatible footprint", () => {
    const filled = occupiedCellsOf([footprint(0, 1, 2, 2)]);
    expect(filled.has("1:0")).toBe(true);
    expect(filled.has("2:1")).toBe(true);
    expect(filled.has("3:0")).toBe(false);
  });

  it("hides a top face where a neighbour rests, one flag per spanned column", () => {
    const below = footprint(0, 1, 2, 1);
    const above = footprint(1, 1, 1, 1);
    const filled = occupiedCellsOf([below, above]);
    expect(faceVisibilityOf(below, filled).topFace).toEqual([false, true]);
  });

  it("hides a right face where a neighbour abuts, and always shows it at the grid edge", () => {
    const left = footprint(0, 1, 1, 1);
    const right = footprint(0, 2, 1, 1);
    const filled = occupiedCellsOf([left, right]);
    expect(faceVisibilityOf(left, filled).rightFace).toEqual([false]);
    expect(faceVisibilityOf(right, filled).rightFace).toEqual([true]);
  });

  it("reports a void only under cells the skyline covers but nothing fills", () => {
    const support = footprint(0, 1, 1, 1);
    const bridge = footprint(1, 1, 3, 1);
    const filled = occupiedCellsOf([support, bridge]);
    const voids = voidsOf([support, bridge], filled);
    expect(voids).toContainEqual({ row: 0, column: 2 });
    expect(voids).toContainEqual({ row: 0, column: 3 });
    expect(voids).not.toContainEqual({ row: 0, column: 1 });
  });
});

describe("fitsInGrid", () => {
  it("keeps every block inside the sixteen placement units", () => {
    // Eight columns of two units. A race is 8 units wide, so it fits flush
    // left and flush right and nowhere past that.
    expect(GRID_UNITS).toBe(16);
    expect(fitsInGrid(1, 8)).toBe(true);
    expect(fitsInGrid(9, 8)).toBe(true);
    expect(fitsInGrid(10, 8)).toBe(false);
    expect(fitsInGrid(0, 1)).toBe(false);
  });

  it("lets a turned block stand on the half of a column it needs", () => {
    // A 1-unit-wide block — a 1x1 brick stood on end — can start at any unit,
    // including the odd ones a whole-column grid could not express (#206).
    expect(fitsInGrid(2, 1)).toBe(true);
    expect(fitsInGrid(16, 1)).toBe(true);
    expect(fitsInGrid(17, 1)).toBe(false);
  });
});

describe("landingRow", () => {
  it("rests on the highest unit the block spans", () => {
    const skyline = [0, 3, 1, 0, 0, 0, 0, 0, 0, 0];
    expect(landingRow(skyline, 1, 3)).toBe(3);
    expect(landingRow(skyline, 3, 2)).toBe(1);
    expect(landingRow(skyline, 4, 2)).toBe(0);
  });
});

describe("placementOptions", () => {
  it("offers one landing per column, never a floating row", () => {
    const options = placementOptions(2, 1, []);
    expect(columns(options)).toEqual(
      Array.from({ length: GRID_UNITS - 1 }, (_, index) => `${index + 1}@0`),
    );
  });

  it("drops the block onto whatever is already built", () => {
    const options = placementOptions(2, 1, [placement("a", 0, 1, 2, 2)]);
    expect(options[0].row).toBe(2);
    expect(options[2].row).toBe(0);
  });

  it("reports the dead space a landing seals underneath", () => {
    // A 3-wide block bridging a column-1 tower and empty ground arches over it.
    const options = placementOptions(3, 1, [placement("a", 0, 1, 1, 2)]);
    expect(options[0].row).toBe(2);
    expect(options[0].opened).toBe(4);
  });

  it("counts a landing as flush against the grid edge", () => {
    const options = placementOptions(2, 1, []);
    expect(options[0].flush).toBeGreaterThan(options[3].flush);
  });
});

describe("autoPlaceOption", () => {
  it("returns null only when the block cannot fit at all", () => {
    expect(autoPlaceOption([])).toBeNull();
  });

  it("lands lowest before anything else", () => {
    const placements = [placement("a", 0, 1, 4, 3)];
    const chosen = autoPlaceOption(placementOptions(2, 1, placements));
    expect(chosen?.row).toBe(0);
  });

  it("prefers the landing that seals least dead space", () => {
    // Columns 1-2 stand at 2; the rest is ground. A 4-wide block landing at
    // column 1 would arch over four cells, so it goes to open ground instead.
    const placements = [placement("a", 0, 1, 2, 2)];
    const chosen = autoPlaceOption(placementOptions(4, 1, placements));
    expect(chosen?.opened).toBe(0);
    expect(chosen?.row).toBe(0);
  });

  it("prefers a landing flush against a wall over a free-standing one", () => {
    const chosen = autoPlaceOption(placementOptions(3, 1, []));
    // Ground is level everywhere, so flushness decides: hard against an edge.
    expect(chosen?.flush).toBeGreaterThan(0);
  });

  it("is independent of the order the options arrive in", () => {
    const placements = [placement("a", 0, 4, 2, 1)];
    const options = placementOptions(2, 1, placements);
    const forward = autoPlaceOption(options);
    const backward = autoPlaceOption([...options].reverse());
    expect(backward?.columnStart).toBe(forward?.columnStart);
    expect(backward?.row).toBe(forward?.row);
  });
});

describe("newestPlacement and canMove", () => {
  const older = placement("a", 0, 1, 1, 1, "2026-08-04T10:00:00.000Z");
  const newer = placement("b", 0, 2, 1, 1, "2026-08-04T11:00:00.000Z");

  it("finds the most recently placed block regardless of array order", () => {
    expect(newestPlacement([older, newer])?.runLogId).toBe("b");
    expect(newestPlacement([newer, older])?.runLogId).toBe("b");
  });

  it("only lets the newest block move, because nothing rests on it", () => {
    expect(canMove([older, newer], "b")).toBe(true);
    expect(canMove([older, newer], "a")).toBe(false);
  });

  it("has nothing to move in an empty tower", () => {
    expect(newestPlacement([])).toBeNull();
    expect(canMove([], "a")).toBe(false);
  });
});

describe("assertPlacementFits", () => {
  const candidate = {
    runLogId: "w",
    row: 0,
    columnStart: 1,
    width: 2 as const,
    height: 1 as const,
  };

  it("accepts a block exactly where gravity would drop it", () => {
    expect(() => assertPlacementFits(candidate, [])).not.toThrow();
  });

  it("rejects a block that runs off the right edge", () => {
    expect(() =>
      assertPlacementFits({ ...candidate, columnStart: 16, width: 2 }, []),
    ).toThrow(InvalidPlacementError);
  });

  it("rejects a row gravity would not produce", () => {
    expect(() => assertPlacementFits({ ...candidate, row: 4 }, [])).toThrow(
      InvalidPlacementError,
    );
  });

  it("rejects a block that would float above what is built", () => {
    const existing = [placement("a", 0, 1, 2, 1)];
    // Gravity puts it on course 1; claiming course 0 would overlap.
    expect(() => assertPlacementFits(candidate, existing)).toThrow(
      InvalidPlacementError,
    );
    expect(() =>
      assertPlacementFits({ ...candidate, row: 1 }, existing),
    ).not.toThrow();
  });

  it("does not collide a block with its own former position", () => {
    const existing = [placement("w", 0, 1, 2, 1)];
    expect(() => assertPlacementFits(candidate, existing)).not.toThrow();
  });
});

describe("repackPlacements", () => {
  it("keeps every block and stacks them all from the ground up", () => {
    const repacked = repackPlacements([
      placement("a", 9, 1, 8, 1, "2026-08-04T10:00:00.000Z"),
      placement("b", 4, 1, 8, 1, "2026-08-04T11:00:00.000Z"),
      placement("c", 7, 1, 8, 1, "2026-08-04T12:00:00.000Z"),
    ]);

    expect(repacked.map((item) => item.runLogId)).toEqual(["a", "b", "c"]);
    expect(repacked.every((item) => item.row >= 0)).toBe(true);
    // Three race-width blocks — 8 units, four columns — fit two to a course
    // in a sixteen-unit grid.
    expect(Math.max(...repacked.map(topOf))).toBe(2);
  });

  it("never overlaps two blocks", () => {
    const repacked = repackPlacements(
      Array.from({ length: 20 }, (_, index) =>
        placement(
          `w${index}`,
          0,
          1,
          ((index % 4) + 1) * 2,
          (index % 2) + 1,
          `2026-08-${String(4 + index).padStart(2, "0")}T10:00:00.000Z`,
        ),
      ),
    );

    const seen = new Set<string>();
    for (const item of repacked) {
      for (let column = item.columnStart; column <= lastColumnOf(item); column += 1) {
        for (let row = item.row; row < topOf(item); row += 1) {
          expect(seen.has(`${column}:${row}`)).toBe(false);
          seen.add(`${column}:${row}`);
        }
      }
    }
  });

  it("replays in the order the blocks were built, not array order", () => {
    const first = placement("first", 0, 1, 4, 1, "2026-08-01T10:00:00.000Z");
    const second = placement("second", 0, 1, 4, 1, "2026-08-02T10:00:00.000Z");
    expect(repackPlacements([second, first])[0].runLogId).toBe("first");
  });
});
