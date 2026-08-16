import { describe, expect, it } from "vitest";
import { addDaysToLocalDate, mondayOfLocalDate } from "../../domain/dates";
import { selectPlanWeekViewModel } from "../../domain/plan";
import type { RunLog } from "../../domain/types";
import { historicalRun, stackRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { presentableRunnerSignals } from "../../signals/runnerSignals";
import { signalRuns } from "../../signals/signalTestRuns";
import {
  TRAINING_SIGNAL_PRIORITY,
  TRAINING_SIGNAL_TITLE,
  type SignalDirection,
  type SignalId,
  type TrainingSignal,
  type TrainingSignalFamily,
} from "../../signals/trainingSignal";
import {
  selectTodayModel,
  selectTodaySignal,
  todayContextReadings,
  todayWeek,
  TODAY_CONTEXT_READING_LIMIT,
} from "./todayModel";

const plan = loadSeedPlan();

const SIGNAL_ID: Record<TrainingSignalFamily, SignalId> = {
  volume: "volume-trend",
  frequency: "run-frequency",
  "long-run": "long-run-progression",
  workload: "workload-trend",
  "zone-distribution": "zone-distribution",
  "plan-context": "plan-completion",
};

/**
 * A signal with the shape the domain produces and none of the arithmetic.
 *
 * The Today selection rule is about family, availability and direction only, so
 * these tests state exactly those three things per signal rather than
 * constructing a history that happens to produce them. The rule's behaviour on
 * real histories is covered separately, at the bottom of this file.
 */
function fakeSignal(
  family: TrainingSignalFamily,
  direction: SignalDirection | null,
  isPresentable = true,
): TrainingSignal {
  const window = {
    startDate: "2026-07-20",
    endDate: "2026-08-16",
    days: 28,
    runCount: 8,
  };
  return {
    id: SIGNAL_ID[family],
    family,
    title: TRAINING_SIGNAL_TITLE[family],
    priority: TRAINING_SIGNAL_PRIORITY[family],
    isPresentable,
    unavailableReason: isPresentable ? null : "no-history",
    direction,
    headline: `${family} headline`,
    support: `${family} support`,
    windowLabel: "Last 28d vs prior 28d",
    current: window,
    baseline: window,
    coverage: null,
    supportingRunIds: [],
    facts: null,
  } as TrainingSignal;
}

describe("selectTodaySignal", () => {
  it("shows nothing when every signal is steady", () => {
    expect(
      selectTodaySignal([
        fakeSignal("volume", "steady"),
        fakeSignal("frequency", "steady"),
        fakeSignal("long-run", "steady"),
      ]),
    ).toBeNull();
  });

  it("shows nothing at all when there is no signal to show", () => {
    expect(selectTodaySignal([])).toBeNull();
  });

  it("takes the highest-ranked changed signal, following the NEXT-3 order", () => {
    const chosen = selectTodaySignal([
      fakeSignal("workload", "rising"),
      fakeSignal("frequency", "falling"),
      fakeSignal("volume", "rising"),
    ]);
    expect(chosen?.family).toBe("volume");
  });

  it("passes over a steady higher-ranked family for a changed lower-ranked one", () => {
    const chosen = selectTodaySignal([
      fakeSignal("volume", "steady"),
      fakeSignal("frequency", "steady"),
      fakeSignal("long-run", "rising"),
    ]);
    expect(chosen?.family).toBe("long-run");
  });

  it("never shows plan context, which Today already states directly", () => {
    expect(
      selectTodaySignal([
        fakeSignal("plan-context", "rising"),
        fakeSignal("volume", "steady"),
      ]),
    ).toBeNull();
  });

  it("never shows a signal the domain says is unavailable", () => {
    expect(
      selectTodaySignal([fakeSignal("volume", "rising", false)]),
    ).toBeNull();
  });

  it("is deterministic: the same input always chooses the same signal", () => {
    const signals = [
      fakeSignal("long-run", "falling"),
      fakeSignal("frequency", "rising"),
      fakeSignal("volume", "rising"),
    ];
    const first = selectTodaySignal(signals);
    expect(selectTodaySignal([...signals].reverse())?.id).toBe(first?.id);
  });

  it("takes a real rising-volume history the same way", () => {
    const today = "2026-08-16";
    const runs = signalRuns({
      today,
      current: { runCount: 8, options: { miles: 5 } },
      baseline: { runCount: 6, options: { miles: 4 } },
    });
    const chosen = selectTodaySignal(presentableRunnerSignals({ runs, today }));
    expect(chosen?.family).toBe("volume");
    expect(chosen?.headline).toBe("Volume is building");
  });
});

describe("todayContextReadings", () => {
  const today = "2026-08-16";
  const steadyRuns = signalRuns({
    today,
    current: { runCount: 8, options: { miles: 5 } },
    baseline: { runCount: 8, options: { miles: 5 } },
  });

  it("says nothing at all without history, rather than showing a needs-more card", () => {
    expect(todayContextReadings([], today)).toEqual([]);
  });

  it("orients the runner with recent volume, frequency and longest run", () => {
    expect(todayContextReadings(steadyRuns, today).map((r) => r.key)).toEqual([
      "last-28",
      "frequency",
      "longest",
    ]);
  });

  it("never shows more than three facts", () => {
    expect(todayContextReadings(steadyRuns, today).length).toBeLessThanOrEqual(
      TODAY_CONTEXT_READING_LIMIT,
    );
  });

  it("states each window beside its value", () => {
    const readings = todayContextReadings(steadyRuns, today);
    expect(readings.map((r) => r.label)).toEqual([
      "Last 28 days",
      "Last 8 wks",
      "Longest 28d",
    ]);
  });

  it("drops the reading the chosen observation already states", () => {
    const withVolume = todayContextReadings(
      steadyRuns,
      today,
      fakeSignal("volume", "rising"),
    );
    expect(withVolume.map((r) => r.key)).toEqual(["frequency", "longest"]);

    const withFrequency = todayContextReadings(
      steadyRuns,
      today,
      fakeSignal("frequency", "falling"),
    );
    expect(withFrequency.map((r) => r.key)).toEqual(["last-28", "longest"]);
  });

  it("keeps every reading when the observation is about something else", () => {
    expect(
      todayContextReadings(steadyRuns, today, fakeSignal("workload", "rising")).map(
        (r) => r.key,
      ),
    ).toEqual(["last-28", "frequency", "longest"]);
  });

  it("omits a reading it cannot state rather than showing it as zero", () => {
    // One run, fourteen months ago: the trailing windows are empty, but they
    // are empty because nothing was run, which is a different thing from
    // unknown. Volume is a measured zero; there is no recent longest run.
    const stale = unifiedRunnerHistory({
      activities: [historicalRun("old", "2025-06-01", { miles: 6 })],
    });
    const readings = todayContextReadings(stale, today);
    expect(readings.map((r) => r.key)).toEqual(["last-28"]);
    expect(readings[0].value).toBe(0);
  });

  it("counts a run STACK never accepted, exactly like Runs does", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("h1", "2026-08-14", { miles: 7.5 })],
    });
    const readings = todayContextReadings(runs, today);
    expect(readings.find((r) => r.key === "last-28")?.value).toBe(7.5);
    expect(readings.find((r) => r.key === "longest")?.value).toBe(7.5);
  });
});

describe("todayWeek", () => {
  const runs = unifiedRunnerHistory({
    activities: [
      historicalRun("mon", "2026-08-03", { miles: 4 }),
      historicalRun("wed", "2026-08-05", { miles: 6 }),
      // Last week: outside the window, and must not be counted.
      historicalRun("prev", "2026-07-30", { miles: 9 }),
    ],
  });

  it("uses the plan's own week boundaries so Today and Plan cannot disagree", () => {
    const planWeek = selectPlanWeekViewModel(plan, [], 1, "2026-08-06");
    const week = todayWeek(runs, "2026-08-06", planWeek);
    expect(week.startDate).toBe(planWeek.startDate);
    expect(week.endDate).toBe(planWeek.endDate);
    expect(week.plan).toBe(planWeek);
  });

  it("falls back to the calendar week when the plan does not cover today", () => {
    const week = todayWeek(runs, "2026-08-06", null);
    expect(week.startDate).toBe(mondayOfLocalDate("2026-08-06"));
    expect(week.endDate).toBe(addDaysToLocalDate(week.startDate, 6));
    expect(week.plan).toBeNull();
  });

  it("counts every run inside the week and none outside it", () => {
    const week = todayWeek(runs, "2026-08-06", null);
    expect(week.miles).toBe(10);
    expect(week.runCount).toBe(2);
  });
});

describe("selectTodayModel", () => {
  const runLogs: RunLog[] = [
    stackRun("r1", "2026-08-04", { distanceMiles: 4, durationSeconds: 2400 }),
  ];
  const runs = unifiedRunnerHistory({ runLogs });

  it("carries the plan week only while the plan is actually covering today", () => {
    const during = selectTodayModel({ plan, runLogs, runs, today: "2026-08-06" });
    expect(during.week?.plan?.weekNumber).toBe(1);

    const before = selectTodayModel({
      plan,
      runLogs,
      runs,
      today: "2026-07-15",
    });
    expect(before.week?.plan ?? null).toBeNull();
  });

  it("keeps a week worth reporting even with no plan week in force", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("pre", "2026-07-14", { miles: 5 })],
    });
    const model = selectTodayModel({ plan, runLogs: [], runs, today: "2026-07-15" });
    expect(model.week?.miles).toBe(5);
    expect(model.week?.plan ?? null).toBeNull();
  });

  it("omits the week entirely when nothing ran and nothing is scheduled", () => {
    const model = selectTodayModel({
      plan,
      runLogs: [],
      runs: [],
      today: "2026-12-31",
    });
    expect(model.week).toBeNull();
  });

  it("keeps the race countdown signed, so a finished race stops counting", () => {
    expect(
      selectTodayModel({ plan, runLogs, runs, today: "2026-12-05" })
        .raceDaysRemaining,
    ).toBe(0);
    expect(
      selectTodayModel({ plan, runLogs, runs, today: "2026-12-31" })
        .raceDaysRemaining,
    ).toBeLessThan(0);
  });

  it("shows no observation for a runner with too little history to compare", () => {
    const model = selectTodayModel({ plan, runLogs, runs, today: "2026-08-06" });
    expect(model.signal).toBeNull();
  });

  it("mutates neither the run logs nor the history it is given", () => {
    const logs = [...runLogs];
    const history = [...runs];
    selectTodayModel({ plan, runLogs: logs, runs: history, today: "2026-08-06" });
    expect(logs).toEqual(runLogs);
    expect(history).toEqual(runs);
  });

  it("never states one number twice: the observation replaces its own reading", () => {
    const today = "2026-08-16";
    const rising = signalRuns({
      today,
      current: { runCount: 8, options: { miles: 5 } },
      baseline: { runCount: 6, options: { miles: 4 } },
    });
    const model = selectTodayModel({ plan, runLogs: [], runs: rising, today });
    expect(model.signal?.family).toBe("volume");
    expect(model.context.map((r) => r.key)).not.toContain("last-28");
  });
});
