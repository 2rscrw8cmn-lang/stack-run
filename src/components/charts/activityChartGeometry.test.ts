import { describe, expect, it } from "vitest";
import {
  axisTicks,
  contiguousRuns,
  displayDomain,
  domainSpan,
  nearestSampleIndex,
  ratioAtTime,
  timeAtRatio,
  type ActivitySample,
} from "./activityChartGeometry.js";

const samples = (values: (number | null)[]): ActivitySample[] =>
  values.map((value, index) => ({ timeSeconds: index * 30, value }));

describe("display domain", () => {
  it("uses the data's own extent when it is not asked for a robust one", () => {
    expect(displayDomain([10, 20, 30])).toEqual({ low: 10, high: 30 });
  });

  it("keeps a short series honest rather than reading quartiles off five points", () => {
    // Below the minimum sample count the fences say nothing, so the extent
    // stands — including the outlier, which is the truthful answer here.
    expect(displayDomain([10, 11, 12, 900], true)).toEqual({ low: 10, high: 900 });
  });

  it("scales past an outlier once there are enough samples to know it is one", () => {
    const run = [600, 605, 610, 602, 608, 612, 604, 606, 3_200];
    const { low, high } = displayDomain(run, true);

    // The 53-minute-mile near-stop no longer dictates the window; the rest of
    // the run gets the height. The sample itself is untouched — clamping is the
    // drawing code's business, not this function's.
    expect(high).toBeLessThan(700);
    expect(low).toBeLessThanOrEqual(600);
    expect(run).toContain(3_200);
  });

  it("gives a flat series its own extent rather than dividing by zero", () => {
    const flat = Array.from({ length: 12 }, () => 150);
    expect(displayDomain(flat, true)).toEqual({ low: 150, high: 150 });
    expect(domainSpan({ low: 150, high: 150 })).toBeGreaterThan(0);
  });
});

describe("axis ticks", () => {
  it("lands on round numbers a runner can read without arithmetic", () => {
    expect(axisTicks({ low: 138, high: 176 })).toEqual([140, 150, 160, 170]);
    expect(axisTicks({ low: 0, high: 300 })).toEqual([0, 100, 200, 300]);
  });

  it("labels a pace axis whose range does not divide into round hundreds", () => {
    // The QA interval session: about 8:24 to 11:18 a mile. Counting the labels
    // a step would produce, rather than dividing the range, is what keeps this
    // axis from coming out empty.
    expect(axisTicks({ low: 503.8, high: 678.4 })).toEqual([550, 600, 650]);
  });

  it("offers no axis at all rather than one repeated label", () => {
    expect(axisTicks({ low: 150, high: 150 })).toEqual([]);
    expect(axisTicks({ low: Number.NaN, high: 10 })).toEqual([]);
  });

  it("keeps every tick inside the window it labels", () => {
    for (const tick of axisTicks({ low: 71.4, high: 113.9 })) {
      expect(tick).toBeGreaterThanOrEqual(71.4);
      expect(tick).toBeLessThanOrEqual(113.9);
    }
  });
});

describe("contiguous runs", () => {
  it("splits a series wherever the stream stopped recording", () => {
    const runs = contiguousRuns(samples([140, 145, null, null, 150, 155]));

    expect(runs).toHaveLength(2);
    expect(runs[0].map((point) => point.value)).toEqual([140, 145]);
    expect(runs[1].map((point) => point.value)).toEqual([150, 155]);
    // Each point remembers where it came from, so a gap never shifts the x-axis.
    expect(runs[1][0]).toMatchObject({ index: 4, timeSeconds: 120 });
  });

  it("keeps a lone measured sample between two gaps", () => {
    expect(contiguousRuns(samples([null, 148, null]))).toEqual([
      [{ index: 1, timeSeconds: 30, value: 148 }],
    ]);
  });

  it("has nothing to draw for a series that measured nothing", () => {
    expect(contiguousRuns(samples([null, null]))).toEqual([]);
    expect(contiguousRuns([])).toEqual([]);
  });
});

describe("cursor position", () => {
  it("finds the nearest sample by elapsed time rather than by index", () => {
    // A watch that paused leaves an uneven series; halfway across the plot is
    // halfway through the run, not halfway through the array.
    const uneven: ActivitySample[] = [
      { timeSeconds: 0, value: 1 },
      { timeSeconds: 10, value: 2 },
      { timeSeconds: 600, value: 3 },
    ];
    expect(nearestSampleIndex(uneven, 300)).toBe(1);
    expect(nearestSampleIndex(uneven, 320)).toBe(2);
    expect(nearestSampleIndex([], 10)).toBe(-1);
  });

  it("clamps a finger that slid off the end of the chart to the end of the run", () => {
    expect(timeAtRatio(1.4, 1_800)).toBe(1_800);
    expect(timeAtRatio(-0.2, 1_800)).toBe(0);
    expect(timeAtRatio(0.5, 1_800)).toBe(900);
  });

  it("plots a single-position series at the start rather than dividing by zero", () => {
    expect(ratioAtTime(0, 0)).toBe(0);
    expect(ratioAtTime(900, 1_800)).toBe(0.5);
  });
});
