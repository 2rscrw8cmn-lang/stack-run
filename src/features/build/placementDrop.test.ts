import { describe, expect, it } from "vitest";
import { dropMarks, placementImpact, PLACEMENT_DROP_MS } from "./placementDrop.js";
import {
  handFootprint,
  heightForActivityType,
  widthForMiles,
} from "../../domain/footprint.js";

/**
 * The block a run of this shape earns, straight from the footprint domain and
 * in the placement units a landing is actually measured in (issue #206).
 */
function footprintFor(miles: number, type: Parameters<typeof heightForActivityType>[0]) {
  return handFootprint(
    { width: widthForMiles(miles), height: heightForActivityType(type) },
    false,
  );
}

describe("placement landing weight (issue #76)", () => {
  it("reads weight off the footprint the run already earned", () => {
    // A short easy run: one cell, the lightest object in the tower.
    expect(placementImpact(footprintFor(2.4, "easy"))).toBe("light");
    // A medium easy run is wider but still one course.
    expect(placementImpact(footprintFor(4.2, "easy"))).toBe("light");
    // A long run is wide: the same block a runner sees as their biggest week.
    expect(placementImpact(footprintFor(9, "long"))).toBe("normal");
    // Hard sessions are two courses, so they reach heavy sooner than distance
    // alone would take them.
    expect(placementImpact(footprintFor(4, "intervals"))).toBe("normal");
    expect(placementImpact(footprintFor(6, "simulation"))).toBe("heavy");
    // The race is the largest object there is.
    expect(placementImpact(footprintFor(26.2, "race"))).toBe("heavy");
  });

  it("bands by cells covered, so width and height count the same", () => {
    // Cells are placement units, so the bands sit at twice the column-cell
    // counts they always did and a landing weighs exactly what it used to.
    expect(placementImpact({ width: 8, height: 1 })).toBe("normal");
    expect(placementImpact({ width: 2, height: 3 })).toBe("normal");
    expect(placementImpact({ width: 6, height: 2 })).toBe("heavy");
    expect(placementImpact({ width: 4, height: 3 })).toBe("heavy");
  });

  it("marks only the block that is actually landing", () => {
    expect(dropMarks(false, { width: 4, height: 3 })).toEqual({});
    expect(dropMarks(true, { width: 1, height: 1 })).toEqual({
      "data-just-placed": "true",
      "data-impact": "light",
    });
  });

  it("holds the mark for at least as long as the stylesheet animates", () => {
    // The longest animation on `[data-just-placed]` is the impact glow. If the
    // stylesheet grows past this the landing would be cut off mid-glow.
    expect(PLACEMENT_DROP_MS).toBeGreaterThanOrEqual(640);
    // ...and the whole interaction still has to feel like part of the tap.
    expect(PLACEMENT_DROP_MS).toBeLessThanOrEqual(800);
  });
});
