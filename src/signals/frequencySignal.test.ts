import { describe, expect, it } from "vitest";
import { frequencySignal, FREQUENCY_STABLE_BAND_RUNS_PER_WEEK } from "./frequencySignal";
import { signalRuns } from "./signalTestRuns";

const TODAY = "2026-08-15";

function frequency(currentRuns: number, baselineRuns: number, today = TODAY) {
  return frequencySignal(
    signalRuns({
      today,
      current: { runCount: currentRuns },
      baseline: { runCount: baselineRuns },
    }),
    today,
  );
}

describe("frequency signal", () => {
  it("says a runner is running more often, in runs a week", () => {
    const signal = frequency(20, 12);

    expect(signal.isPresentable).toBe(true);
    expect(signal.direction).toBe("rising");
    expect(signal.headline).toBe("Running more often");
    expect(signal.support).toBe(
      "5.0 runs a week over the last 28 days, up from 3.0 in the 28 before.",
    );
    expect(signal.facts).toMatchObject({
      currentRunsPerWeek: 5,
      baselineRunsPerWeek: 3,
      currentRunCount: 20,
      baselineRunCount: 12,
    });
  });

  it("says a runner is running less often", () => {
    const signal = frequency(8, 16);

    expect(signal.direction).toBe("falling");
    expect(signal.headline).toBe("Running less often");
    expect(signal.support).toContain("down from 4.0");
  });

  it("calls a small difference about the same", () => {
    const signal = frequency(13, 12);

    expect(signal.direction).toBe("steady");
    expect(signal.headline).toBe("Running about as often");
    expect(signal.support).toContain("against 3.0");
  });

  it("moves exactly on the half-run-a-week band and not below it", () => {
    expect(FREQUENCY_STABLE_BAND_RUNS_PER_WEEK).toBe(0.5);
    // 3.5 vs 3.0 is exactly half a run a week.
    expect(frequency(14, 12).direction).toBe("rising");
    // 3.3 vs 3.0 is not.
    expect(frequency(13, 12).direction).toBe("steady");
  });

  it("never compares a part-week against a whole one, on any day of the week", () => {
    // The same shape of training read on four different weekdays. A calendar
    // week comparison would report a different rate on each; a fixed 28-day
    // window is 28 days whenever it is read.
    for (const today of ["2026-08-10", "2026-08-12", "2026-08-15", "2026-08-16"]) {
      const signal = frequency(16, 8, today);
      expect(signal.current.days).toBe(28);
      expect(signal.baseline?.days).toBe(28);
      expect(signal.facts?.currentRunsPerWeek).toBe(4);
      expect(signal.facts?.baselineRunsPerWeek).toBe(2);
    }
  });

  it("says nothing from a sparse history", () => {
    expect(frequency(3, 8).unavailableReason).toBe("insufficient-current-window");
    expect(frequency(8, 3).unavailableReason).toBe("insufficient-baseline-window");
    expect(frequencySignal([], TODAY).unavailableReason).toBe("no-history");
  });

  it("counts runs rather than miles", () => {
    const many = frequencySignal(
      signalRuns({
        today: TODAY,
        current: { runCount: 16, options: { miles: 2 } },
        baseline: { runCount: 8, options: { miles: 12 } },
      }),
      TODAY,
    );

    // Half the mileage, twice the runs: this signal reports the runs.
    expect(many.direction).toBe("rising");
  });
});
