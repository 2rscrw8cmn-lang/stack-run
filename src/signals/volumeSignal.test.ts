import { describe, expect, it } from "vitest";
import { stackRun } from "../history/runnerFixtures.js";
import { unifiedRunnerHistory } from "../history/runnerRun.js";
import { signalRuns } from "./signalTestRuns.js";
import {
  volumeSignal,
  VOLUME_MINIMUM_MEANINGFUL_MILES,
  VOLUME_STABLE_BAND,
} from "./volumeSignal.js";

const TODAY = "2026-08-15";

/** Miles over 28 days, split across `runCount` equal runs. */
function window(miles: number, runCount: number) {
  return { runCount, options: { miles: miles / runCount } };
}

describe("volume signal", () => {
  it("calls a clear increase building, and states both windows", () => {
    const signal = volumeSignal(
      signalRuns({ today: TODAY, current: window(24.8, 8), baseline: window(19.6, 8) }),
      TODAY,
    );

    expect(signal.isPresentable).toBe(true);
    expect(signal.direction).toBe("rising");
    expect(signal.headline).toBe("Volume is building");
    expect(signal.support).toBe(
      "24.8 mi in the last 28 days, up from 19.6 mi in the 28 before.",
    );
    expect(signal.windowLabel).toBe("Last 28d vs prior 28d");
    expect(signal.current).toMatchObject({
      startDate: "2026-07-19",
      endDate: TODAY,
      days: 28,
      runCount: 8,
    });
    expect(signal.baseline).toMatchObject({
      startDate: "2026-06-21",
      endDate: "2026-07-18",
      days: 28,
    });
  });

  it("calls a clear decrease easing", () => {
    const signal = volumeSignal(
      signalRuns({ today: TODAY, current: window(18, 6), baseline: window(30, 6) }),
      TODAY,
    );

    expect(signal.direction).toBe("falling");
    expect(signal.headline).toBe("Volume is easing");
    expect(signal.support).toContain("down from 30 mi");
  });

  it("calls a small difference steady rather than dressing it up", () => {
    const signal = volumeSignal(
      signalRuns({ today: TODAY, current: window(30, 6), baseline: window(29, 6) }),
      TODAY,
    );

    expect(signal.direction).toBe("steady");
    expect(signal.headline).toBe("Volume is steady");
    expect(signal.support).toBe(
      "30 mi in the last 28 days, against 29 mi in the 28 before.",
    );
  });

  it("holds steady just under both thresholds and moves just over them", () => {
    const under = volumeSignal(
      // +2.9 mi on 30: over the 10% band, under the three-mile floor.
      signalRuns({ today: TODAY, current: window(32.9, 6), baseline: window(30, 6) }),
      TODAY,
    );
    const over = volumeSignal(
      // +3.0 mi on 30: exactly 10% and exactly three miles.
      signalRuns({ today: TODAY, current: window(33, 6), baseline: window(30, 6) }),
      TODAY,
    );

    expect(VOLUME_STABLE_BAND).toBe(0.1);
    expect(VOLUME_MINIMUM_MEANINGFUL_MILES).toBe(3);
    expect(under.direction).toBe("steady");
    expect(over.direction).toBe("rising");
  });

  it("stays steady when a large percentage is a tiny number of miles", () => {
    // 4 mi against 2.5 mi is +60%, and it is a mile and a half.
    const signal = volumeSignal(
      signalRuns({ today: TODAY, current: window(4, 4), baseline: window(2.5, 4) }),
      TODAY,
    );

    expect(signal.direction).toBe("steady");
  });

  it("stays steady when a large mileage difference is a small share", () => {
    // +6 mi on 100 clears the absolute floor and is 6%.
    const signal = volumeSignal(
      signalRuns({ today: TODAY, current: window(106, 12), baseline: window(100, 12) }),
      TODAY,
    );

    expect(signal.direction).toBe("steady");
  });

  it("says nothing at all with no history", () => {
    const signal = volumeSignal([], TODAY);

    expect(signal.isPresentable).toBe(false);
    expect(signal.unavailableReason).toBe("no-history");
    expect(signal.headline).toBeNull();
    expect(signal.facts).toBeNull();
  });

  it("refuses to compare against a baseline window the history never covered", () => {
    // A runner who started five weeks ago: the baseline is empty because STACK
    // has no records, not because they rested.
    const runs = unifiedRunnerHistory({
      runLogs: Array.from({ length: 10 }, (_, index) =>
        stackRun(`r-${index}`, `2026-07-${String(20 + (index % 12)).padStart(2, "0")}`),
      ),
    });
    const signal = volumeSignal(runs, TODAY);

    expect(signal.isPresentable).toBe(false);
    expect(signal.unavailableReason).toBe("history-too-short");
  });

  it("refuses when only one of the two windows has enough running", () => {
    expect(
      volumeSignal(
        signalRuns({ today: TODAY, current: window(20, 6), baseline: window(6, 2) }),
        TODAY,
      ).unavailableReason,
    ).toBe("insufficient-baseline-window");
    expect(
      volumeSignal(
        signalRuns({ today: TODAY, current: window(6, 2), baseline: window(20, 6) }),
        TODAY,
      ).unavailableReason,
    ).toBe("insufficient-current-window");
  });

  it("counts a run recorded today", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [
        ...Array.from({ length: 5 }, (_, index) =>
          stackRun(`c-${index}`, `2026-08-0${index + 1}`, { distanceMiles: 5 }),
        ),
        ...Array.from({ length: 5 }, (_, index) =>
          stackRun(`b-${index}`, `2026-07-0${index + 1}`, { distanceMiles: 5 }),
        ),
        stackRun("today", TODAY, { distanceMiles: 8 }),
        stackRun("anchor", "2026-06-20", { distanceMiles: 3 }),
      ],
    });
    const signal = volumeSignal(runs, TODAY);

    expect(signal.facts?.currentMiles).toBe(33);
  });
});
