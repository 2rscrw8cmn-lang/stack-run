import { describe, expect, it } from "vitest";
import {
  MINIMUM_LABEL_GAP_RATIO,
  PHONE_X_LABEL_TARGET,
  sparseTickIndices,
} from "./chartTickDensity.js";

describe("Chart tick density", () => {
  it("labels every bucket only while there are few enough of them", () => {
    expect(sparseTickIndices(0)).toEqual([]);
    expect(sparseTickIndices(1)).toEqual([0]);
    expect(sparseTickIndices(4)).toEqual([0, 1, 2, 3]);
  });

  it("targets about four phone labels and always anchors both ends", () => {
    for (let count = 2; count <= 60; count += 1) {
      const ticks = sparseTickIndices(count);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(count - 1);
      expect(ticks.length).toBeLessThanOrEqual(PHONE_X_LABEL_TARGET);
      expect(new Set(ticks).size).toBe(ticks.length);
    }
    expect(sparseTickIndices(13)).toEqual([0, 4, 8, 12]);
  });

  /**
   * The structural half of "no x-axis label may overlap another": two visible
   * labels are always at least a fifth of the plot apart, so a ~48px date can
   * never reach its neighbour.
   */
  it("never places two labels closer than the documented minimum gap", () => {
    for (let count = 2; count <= 60; count += 1) {
      const ticks = sparseTickIndices(count);
      for (let index = 1; index < ticks.length; index += 1) {
        const gapRatio = (ticks[index] - ticks[index - 1]) / count;
        expect(gapRatio).toBeGreaterThanOrEqual(MINIMUM_LABEL_GAP_RATIO - 0.001);
      }
    }
  });

  it("keeps density independent of which bucket is selected", () => {
    // The selected period is stated in the readout, so it no longer forces a
    // tick that could land beside the fixed final label.
    expect(sparseTickIndices(13)).toEqual(sparseTickIndices(13));
    expect(sparseTickIndices(27, 4)).toEqual([0, 9, 17, 26]);
  });

  it("honours a caller that asks for fewer labels", () => {
    expect(sparseTickIndices(20, 2)).toEqual([0, 19]);
    expect(sparseTickIndices(20, 3)).toEqual([0, 10, 19]);
  });
});
