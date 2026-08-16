import { describe, expect, it } from "vitest";
import { addDaysToLocalDate } from "../../domain/dates";
import { historicalRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { runnerSignals } from "../../signals/runnerSignals";
import {
  RUNS_OVERVIEW_SIGNAL_LIMIT,
  selectOverviewSignals,
  signalOverviewVisual,
} from "./signalOverview";

const TODAY = "2026-08-15";

function completeSignalSet() {
  const activities = [
    ...Array.from({ length: 10 }, (_, index) =>
      historicalRun(
        `current-${index}`,
        addDaysToLocalDate("2026-07-19", Math.round((index * 27) / 10)),
        {
          miles: 4,
          trainingLoad: 60,
          hrZoneSeconds: [600, 600, 600],
        },
      ),
    ),
    ...Array.from({ length: 10 }, (_, index) =>
      historicalRun(
        `baseline-${index}`,
        addDaysToLocalDate("2026-06-21", Math.round((index * 27) / 10)),
        {
          miles: 3,
          trainingLoad: 40,
          hrZoneSeconds: [200, 200, 1_600],
        },
      ),
    ),
    historicalRun("coverage-anchor", "2026-06-20", { miles: 2 }),
  ];
  const runs = unifiedRunnerHistory({ activities });
  const signals = runnerSignals({ runs, today: TODAY, plan: loadSeedPlan() });
  return { runs, signals };
}

describe("Runs Overview signal presentation", () => {
  it("keeps domain order, removes unavailable signals, and caps only the overview at four", () => {
    const { signals } = completeSignalSet();
    const presentable = signals.filter((signal) => signal.isPresentable);
    const overview = selectOverviewSignals(signals);

    expect(presentable.length).toBeGreaterThan(RUNS_OVERVIEW_SIGNAL_LIMIT);
    expect(overview).toHaveLength(RUNS_OVERVIEW_SIGNAL_LIMIT);
    expect(overview.map((signal) => signal.id)).toEqual(
      presentable.slice(0, RUNS_OVERVIEW_SIGNAL_LIMIT).map((signal) => signal.id),
    );
    expect(overview.every((signal) => signal.isPresentable && signal.facts !== null)).toBe(true);
  });

  it("maps every signal family to its documented visual grammar without changing its facts", () => {
    const { runs, signals } = completeSignalSet();
    const kinds = Object.fromEntries(
      signals
        .filter((signal) => signal.isPresentable)
        .map((signal) => [signal.family, signalOverviewVisual(signal, runs, TODAY)?.kind]),
    );

    expect(kinds).toMatchObject({
      volume: "comparison",
      frequency: "comparison",
      "long-run": "trend",
      workload: "comparison",
      "zone-distribution": "zones",
      "plan-context": "progress",
    });
  });
});
