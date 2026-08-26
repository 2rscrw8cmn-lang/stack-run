import { describe, expect, it } from "vitest";
import { historicalRun } from "../history/runnerFixtures.js";
import { unifiedRunnerHistory } from "../history/runnerRun.js";
import { signalRuns, type WindowSpec } from "./signalTestRuns.js";
import {
  aggregateZoneSeconds,
  zoneSignal,
  ZONE_LOWER_ZONE_COUNT,
  ZONE_STABLE_BAND_SHARE,
} from "./zoneSignal.js";

const TODAY = "2026-08-15";

/** 75% of zone time in zones 1–2. */
const MOSTLY_LOWER = [1200, 1800, 600, 300, 100, 0, 0];
/** 50%. */
const EVEN = [600, 1400, 1200, 600, 200, 0, 0];
/** 55%. */
const SLIGHTLY_LOWER = [1100, 1100, 1000, 600, 200, 0, 0];

/** A window of `runCount` runs, the first `covered` of which carry zone time. */
function zoned(runCount: number, covered: number, zones: number[]): WindowSpec {
  return {
    runCount,
    options: { hrZoneSeconds: zones },
    perRun: Object.fromEntries(
      Array.from({ length: Math.max(runCount - covered, 0) }, (_, index) => [
        covered + index,
        { hrZoneSeconds: null },
      ]),
    ),
  };
}

function zones(current: WindowSpec, baseline: WindowSpec) {
  return zoneSignal(signalRuns({ today: TODAY, current, baseline }), TODAY);
}

describe("zone distribution signal", () => {
  it("reports a shift toward the lower zones as a share of recorded time", () => {
    const signal = zones(zoned(10, 10, MOSTLY_LOWER), zoned(10, 10, EVEN));

    expect(signal.isPresentable).toBe(true);
    expect(signal.direction).toBe("rising");
    expect(signal.headline).toBe("More time in your lower zones");
    expect(signal.support).toBe(
      "75% of recorded zone time in zones 1–2, up from 50% in the 28 days before.",
    );
    expect(signal.facts).toMatchObject({
      currentLowerShare: 0.75,
      baselineLowerShare: 0.5,
      zoneCount: 7,
      lowerZoneCount: ZONE_LOWER_ZONE_COUNT,
    });
  });

  it("reports a shift away from them", () => {
    const signal = zones(zoned(10, 10, EVEN), zoned(10, 10, MOSTLY_LOWER));

    expect(signal.direction).toBe("falling");
    expect(signal.headline).toBe("Less time in your lower zones");
    expect(signal.support).toContain("down from 75%");
  });

  it("makes no claim about what a zone means or which is better", () => {
    const signal = zones(zoned(10, 10, MOSTLY_LOWER), zoned(10, 10, EVEN));
    const copy = `${signal.headline} ${signal.support}`;

    expect(copy).not.toMatch(
      /aerobic|easy|recovery|fitness|threshold|effort|good|better|improv/i,
    );
  });

  it("calls a small shift about the same", () => {
    const signal = zones(zoned(10, 10, SLIGHTLY_LOWER), zoned(10, 10, EVEN));

    expect(signal.direction).toBe("steady");
    expect(signal.headline).toBe("Zone mix is about the same");
    expect(signal.support).toContain("against 50%");
  });

  it("moves exactly on the eight-point band and not below it", () => {
    expect(ZONE_STABLE_BAND_SHARE).toBe(0.08);
    // 58% against 50% is exactly eight points.
    expect(
      zones(zoned(10, 10, [1160, 1160, 1000, 480, 200, 0, 0]), zoned(10, 10, EVEN))
        .direction,
    ).toBe("rising");
    // 57% is not.
    expect(
      zones(zoned(10, 10, [1140, 1140, 1020, 500, 200, 0, 0]), zoned(10, 10, EVEN))
        .direction,
    ).toBe("steady");
  });

  it("describes the mix rather than the volume behind it", () => {
    // Twice as much recorded zone time, in exactly the same proportions.
    const doubled = MOSTLY_LOWER.map((seconds) => seconds * 2);
    const signal = zones(zoned(10, 10, doubled), zoned(10, 10, MOSTLY_LOWER));

    expect(signal.direction).toBe("steady");
    expect(signal.facts?.currentLowerShare).toBe(0.75);
  });

  it("refuses when too few runs carry zone data", () => {
    expect(zones(zoned(7, 7, EVEN), zoned(10, 10, EVEN)).unavailableReason).toBe(
      "insufficient-coverage",
    );
    expect(zones(zoned(14, 8, EVEN), zoned(10, 10, EVEN)).unavailableReason).toBe(
      "insufficient-coverage",
    );
  });

  it("refuses two windows recorded too unequally to compare", () => {
    expect(
      zones(zoned(10, 10, MOSTLY_LOWER), zoned(12, 8, EVEN)).unavailableReason,
    ).toBe("coverage-mismatch");
  });

  it("disappears for a runner whose runs carry no zone data", () => {
    const signal = zones(
      { runCount: 10, options: { hrZoneSeconds: null } },
      { runCount: 10, options: { hrZoneSeconds: null } },
    );

    expect(signal.isPresentable).toBe(false);
    expect(signal.unavailableReason).toBe("metric-absent");
  });

  it("refuses a source whose zone list is too short to split", () => {
    const signal = zones(zoned(10, 10, [600, 900]), zoned(10, 10, [900, 600]));

    expect(signal.unavailableReason).toBe("metric-absent");
  });

  it("sums real zeroes and skips absent arrays", () => {
    const summed = aggregateZoneSeconds(
      unifiedRunnerHistory({
        activities: [
          historicalRun("z-1", "2026-08-01", { hrZoneSeconds: [100, 0, 50] }),
          historicalRun("z-2", "2026-08-02", { hrZoneSeconds: null }),
          historicalRun("z-3", "2026-08-03", { hrZoneSeconds: [100, 200] }),
        ],
      }),
    );

    // A zero inside a run's own array is the source saying "no time here"; a
    // run with no array at all says nothing and contributes nothing.
    expect(summed).toEqual([200, 200, 50]);
  });
});
