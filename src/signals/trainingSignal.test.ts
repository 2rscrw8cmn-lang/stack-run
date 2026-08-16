import { describe, expect, it } from "vitest";
import { historicalRun, stackRun } from "../history/runnerFixtures";
import { unifiedRunnerHistory } from "../history/runnerRun";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import { presentableRunnerSignals, runnerSignals } from "./runnerSignals";
import {
  classifyAbsoluteChange,
  classifyChange,
  comparisonWindows,
  coverageIsComparable,
  historyCoversBaseline,
  orderTrainingSignals,
  SIGNAL_COVERAGE_PARITY_LIMIT,
  SIGNAL_WINDOW_DAYS,
  TRAINING_SIGNAL_PRIORITY,
  type TrainingSignal,
} from "./trainingSignal";

/**
 * The signal model itself: windows, ordering, availability and purity.
 *
 * The per-family arithmetic lives in the family's own test file. What is
 * asserted here is what every signal must obey regardless of what it measures.
 */

const TODAY = "2026-08-15";

function runsOverDays(dates: readonly string[]) {
  return unifiedRunnerHistory({
    runLogs: dates.map((date, index) => stackRun(`r-${index}`, date)),
  });
}

describe("comparison windows", () => {
  it("puts the baseline immediately before the current window, both inclusive", () => {
    const windows = comparisonWindows(TODAY);

    expect(windows.current).toEqual({
      startDate: "2026-07-19",
      endDate: "2026-08-15",
      days: 28,
    });
    expect(windows.baseline).toEqual({
      startDate: "2026-06-21",
      endDate: "2026-07-18",
      days: 28,
    });
  });

  it("makes both windows the same length on every day of the week", () => {
    for (const day of ["2026-08-10", "2026-08-13", "2026-08-15", "2026-08-16"]) {
      const windows = comparisonWindows(day);
      expect(windows.current.days).toBe(windows.baseline.days);
      expect(windows.current.days).toBe(SIGNAL_WINDOW_DAYS);
    }
  });
});

describe("change classification", () => {
  it("calls a change only when both the relative and absolute tests pass", () => {
    const band = { relativeBand: 0.1, absoluteFloor: 3 };

    // 50% but under three miles: a single short extra run.
    expect(
      classifyChange({ difference: 2, changeRatio: 0.5, ...band }),
    ).toBe("steady");
    // Six miles on a large baseline is under a tenth of it.
    expect(
      classifyChange({ difference: 6, changeRatio: 0.06, ...band }),
    ).toBe("steady");
    expect(
      classifyChange({ difference: 6, changeRatio: 0.25, ...band }),
    ).toBe("rising");
    expect(
      classifyChange({ difference: -6, changeRatio: -0.25, ...band }),
    ).toBe("falling");
  });

  it("treats a change exactly on both thresholds as a change", () => {
    expect(
      classifyChange({
        difference: 3,
        changeRatio: 0.1,
        relativeBand: 0.1,
        absoluteFloor: 3,
      }),
    ).toBe("rising");
  });

  it("classifies an absolute-only family on its band alone", () => {
    expect(classifyAbsoluteChange(0.5, 0.5)).toBe("rising");
    expect(classifyAbsoluteChange(-0.5, 0.5)).toBe("falling");
    expect(classifyAbsoluteChange(0.4, 0.5)).toBe("steady");
  });
});

describe("history coverage of the baseline", () => {
  it("is false when the runner's first ever run is inside the baseline window", () => {
    const runs = runsOverDays(["2026-07-01", "2026-08-01"]);
    expect(historyCoversBaseline(runs, "2026-06-21")).toBe(false);
  });

  it("is true when history reaches the first day of the baseline", () => {
    const runs = runsOverDays(["2026-06-21", "2026-08-01"]);
    expect(historyCoversBaseline(runs, "2026-06-21")).toBe(true);
  });

  it("is false for an empty history", () => {
    expect(historyCoversBaseline([], "2026-06-21")).toBe(false);
  });
});

describe("coverage parity", () => {
  it("accepts two windows covered within the parity limit", () => {
    expect(
      coverageIsComparable({
        currentPresent: 10,
        currentTotal: 10,
        currentRatio: 1,
        baselinePresent: 8,
        baselineTotal: 10,
        baselineRatio: 0.8,
      }),
    ).toBe(true);
  });

  it("rejects two windows whose coverage differs by more than the limit", () => {
    expect(
      coverageIsComparable({
        currentPresent: 10,
        currentTotal: 10,
        currentRatio: 1,
        baselinePresent: 7,
        baselineTotal: 10,
        baselineRatio: 0.7,
      }),
    ).toBe(false);
    expect(SIGNAL_COVERAGE_PARITY_LIMIT).toBe(0.25);
  });
});

describe("signal ordering", () => {
  function signal(
    family: TrainingSignal["family"],
    direction: TrainingSignal["direction"],
  ): TrainingSignal {
    return {
      id: "volume-trend",
      family: "volume",
      title: family,
      priority: TRAINING_SIGNAL_PRIORITY[family],
      isPresentable: true,
      unavailableReason: null,
      direction,
      headline: family,
      support: "",
      windowLabel: "",
      current: { startDate: "", endDate: "", days: 28, runCount: 0 },
      baseline: null,
      coverage: null,
      supportingRunIds: [],
      facts: null,
    };
  }

  it("puts what changed above what did not, then falls back to family priority", () => {
    const ordered = orderTrainingSignals([
      signal("plan-context", null),
      signal("volume", "steady"),
      signal("zone-distribution", "falling"),
      signal("frequency", "rising"),
    ]);

    expect(ordered.map((entry) => entry.title)).toEqual([
      "frequency",
      "zone-distribution",
      "volume",
      "plan-context",
    ]);
  });

  it("is deterministic and does not reorder its input", () => {
    const input = [
      signal("frequency", "rising"),
      signal("volume", "rising"),
    ];
    const first = orderTrainingSignals(input);
    const second = orderTrainingSignals(input);

    expect(first.map((entry) => entry.title)).toEqual(
      second.map((entry) => entry.title),
    );
    expect(input.map((entry) => entry.title)).toEqual(["frequency", "volume"]);
  });
});

describe("the signal set", () => {
  const plan = loadSeedPlan();

  it("returns one signal per family, with stable ids", () => {
    const signals = runnerSignals({ runs: [], today: TODAY });

    expect(signals.map((signal) => signal.id).sort()).toEqual([
      "long-run-progression",
      "plan-completion",
      "run-frequency",
      "volume-trend",
      "workload-trend",
      "zone-distribution",
    ]);
    expect(new Set(signals.map((signal) => signal.family)).size).toBe(6);
  });

  it("presents nothing at all for a runner with no history and no plan runs due", () => {
    const signals = runnerSignals({ runs: [], today: TODAY });

    expect(presentableRunnerSignals({ runs: [], today: TODAY })).toEqual([]);
    expect(
      signals.filter((signal) => signal.family !== "plan-context").map(
        (signal) => signal.unavailableReason,
      ),
    ).toEqual(["no-history", "no-history", "no-history", "no-history", "no-history"]);
  });

  it("still states its windows when it has nothing to say", () => {
    const [signal] = runnerSignals({ runs: [], today: TODAY });

    expect(signal.current.startDate).toBe("2026-07-19");
    expect(signal.current.endDate).toBe(TODAY);
    expect(signal.headline).toBeNull();
  });

  it("does not mutate the history it is given", () => {
    const runs = unifiedRunnerHistory({
      runLogs: [stackRun("a", "2026-08-01"), stackRun("b", "2026-07-01")],
      activities: [historicalRun("h-1", "2026-06-15")],
    });
    const before = JSON.stringify(runs);

    runnerSignals({ runs, today: TODAY, plan, runLogs: [] });

    expect(JSON.stringify(runs)).toBe(before);
  });

  it("gives a manual-only runner every signal their own runs can support", () => {
    // Eight weeks of twice-weekly manual runs, no connection anywhere.
    const dates = Array.from({ length: 16 }, (_, index) =>
      addDays("2026-06-13", index * 3.5),
    );
    const runs = unifiedRunnerHistory({
      runLogs: dates.map((date, index) => stackRun(`m-${index}`, date)),
    });
    const presentable = presentableRunnerSignals({ runs, today: TODAY });

    expect(presentable.map((signal) => signal.family)).toEqual(
      expect.arrayContaining(["volume", "frequency", "long-run"]),
    );
    // Nothing connected-only leaks into a manual-only runner's list.
    expect(presentable.map((signal) => signal.family)).not.toContain("workload");
    expect(presentable.map((signal) => signal.family)).not.toContain(
      "zone-distribution",
    );
  });
});

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T00:00:00`);
  parsed.setDate(parsed.getDate() + Math.round(days));
  return parsed.toISOString().slice(0, 10);
}
