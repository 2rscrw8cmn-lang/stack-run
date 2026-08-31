import { describe, expect, it } from "vitest";
import { placementOptions } from "../../domain/placement.js";
import { handCanRotate, handFootprint, resolveHand } from "./placementHand.js";

/**
 * The block in hand, shared by both towers.
 *
 * The rule under test is issue #204's sharpest one: **rotation must never
 * relocate the block**. STACK is allowed to pick a column when the runner has
 * not picked one, and it is allowed to refuse a placement — but turning a
 * block and finding it somewhere else is the thing the issue rules out in as
 * many words, and it is exactly what falling back to Auto Place would do.
 */

/** An empty eight-column tower. */
const EMPTY: never[] = [];

describe("the block in hand", () => {
  it("lets the tower choose while the runner has not", () => {
    const footprint = handFootprint({ width: 1, height: 1 }, false);
    const options = placementOptions(footprint.width, footprint.height, EMPTY);

    const hand = resolveHand(options, null, footprint);

    // Auto Place's own answer: flush against the left edge of empty ground.
    expect(hand.candidate?.columnStart).toBe(1);
    expect(hand.blockedReason).toBeNull();
  });

  it("keeps the runner's column once they have picked one", () => {
    const footprint = handFootprint({ width: 1, height: 1 }, false);
    const options = placementOptions(footprint.width, footprint.height, EMPTY);

    expect(resolveHand(options, "5", footprint).candidate?.columnStart).toBe(5);
  });

  it("refuses rather than relocating when a turn runs past the grid", () => {
    // A 1x3 standing at column 7. Turned, it wants columns 7, 8 and 9 — and
    // there is no column 9.
    const turned = handFootprint({ width: 1, height: 3 }, true);
    expect(turned).toEqual({ width: 3, height: 1 });

    const options = placementOptions(turned.width, turned.height, EMPTY);
    const hand = resolveHand(options, "7", turned);

    // The block does not quietly reappear at column 6. It cannot be dropped,
    // and the reason names the way out.
    expect(hand.candidate).toBeNull();
    expect(hand.blockedReason).toContain("runs past column 8");
    expect(hand.blockedReason).toContain("Rotate it back");
    // There is plenty of room in the tower — this is not that problem.
    expect(options.length).toBeGreaterThan(0);
  });

  it("says the tower is full only when there is genuinely nowhere to land", () => {
    // The other dead end, and a different sentence: no landing exists at all,
    // so nothing the runner does with this block fixes it. Saying this when a
    // rotation is the real problem sends them looking for space that was
    // never missing.
    const footprint = handFootprint({ width: 4, height: 1 }, false);

    expect(resolveHand([], "3", footprint).blockedReason).toBe(
      "No room left in the tower.",
    );
    expect(resolveHand([], null, footprint).blockedReason).toBe(
      "No room left in the tower.",
    );
  });

  it("walks the steppers only as far as the options actually go", () => {
    const footprint = handFootprint({ width: 4, height: 1 }, false);
    const options = placementOptions(footprint.width, footprint.height, EMPTY);

    // A 4-wide block on eight columns anchors at 1 through 5.
    expect(options).toHaveLength(5);
    expect(resolveHand(options, "1", footprint).canStepBack).toBe(false);
    expect(resolveHand(options, "1", footprint).canStepForward).toBe(true);
    expect(resolveHand(options, "5", footprint).canStepBack).toBe(true);
    expect(resolveHand(options, "5", footprint).canStepForward).toBe(false);
  });

  it("offers no stepping at all from a position it cannot place", () => {
    const turned = handFootprint({ width: 1, height: 3 }, true);
    const options = placementOptions(turned.width, turned.height, EMPTY);
    const hand = resolveHand(options, "7", turned);

    // Nothing is chosen, so there is nothing to step from — the way out is
    // Rotate or Auto Place, both of which stay live.
    expect(hand.index).toBe(-1);
    expect(hand.canStepBack).toBe(false);
    expect(hand.canStepForward).toBe(false);
  });

  it("offers rotation only where there is a second orientation", () => {
    expect(handCanRotate({ width: 3, height: 1 })).toBe(true);
    expect(handCanRotate({ width: 2, height: 2 })).toBe(false);
  });
});
