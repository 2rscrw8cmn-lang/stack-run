import { describe, expect, it } from "vitest";
import { acceptedRun, historicalRun, stackRun } from "./runnerFixtures";
import {
  runnerHistoryRange,
  runnerRunsBetween,
  unifiedRunnerHistory,
} from "./runnerRun";

/**
 * The reconciliation rules, stated as tests.
 *
 * Everything here is about one question: when the source mirror and the run log
 * both describe running, how many runs actually happened? Getting this wrong in
 * either direction is a visible product failure — double-counting an accepted
 * run inflates every mileage figure in the phase, and dropping a historical run
 * because nobody reviewed it is precisely the plan-first behaviour STACK Next
 * exists to stop.
 */

/** A source mirror carrying every optional metric, for the gap-filling tests. */
function fullyMeasured(sourceId: string, date: string) {
  return historicalRun(sourceId, date, {
    name: `Source run ${sourceId}`,
    averageHeartRate: 148,
    maxHeartRate: 170,
    hrZoneSeconds: [300, 900, 600, 0, 0],
    elevationGainMeters: 30,
    averageCadence: 79,
    trainingLoad: 55,
  });
}

describe("unified runner history", () => {
  it("includes a historical Intervals run the runner never reviewed", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-03-04")],
      runLogs: [],
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].origin).toBe("historical-activity");
    expect(runs[0].date).toBe("2026-03-04");
    expect(runs[0].distanceMiles).toBeCloseTo(5, 5);
    // No STACK overlay, because nobody has said anything about this run.
    expect(runs[0].stack).toBeNull();
  });

  it("shows an accepted Intervals run once, not twice", () => {
    const runs = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-08-09")],
      runLogs: [acceptedRun("log-1", "2026-08-09", "a-1", { distanceMiles: 5, durationSeconds: 3_000 })],
    });

    expect(runs).toHaveLength(1);
    expect(runs[0].isReconciled).toBe(true);
    expect(runs[0].origin).toBe("stack-run-log");
    expect(runs[0].externalActivityId).toBe("a-1");
  });

  it("shows a manual run once, and an extra run at all", () => {
    const runs = unifiedRunnerHistory({
      activities: [],
      runLogs: [
        stackRun("manual-1", "2026-08-08", { workoutId: "workout-002" }),
        stackRun("extra-1", "2026-08-09"),
      ],
    });

    expect(runs.map((run) => run.id)).toEqual(["run-log:extra-1", "run-log:manual-1"]);
    expect(runs[0].stack?.isExtra).toBe(true);
    expect(runs[1].stack?.isExtra).toBe(false);
    expect(runs[1].stack?.workoutId).toBe("workout-002");
  });

  it("keeps two real runs on one day as two runs", () => {
    // The identity is the source id, never the date and distance. Matching on
    // those would silently merge a double day into one run.
    const runs = unifiedRunnerHistory({
      activities: [
        historicalRun("a-1", "2026-08-09", { startTimeLocal: "2026-08-09T06:00:00" }),
        historicalRun("a-2", "2026-08-09", { startTimeLocal: "2026-08-09T18:00:00" }),
      ],
      runLogs: [],
    });

    expect(runs).toHaveLength(2);
    // Newest first also means later-in-the-day first.
    expect(runs.map((run) => run.externalActivityId)).toEqual(["a-2", "a-1"]);
  });

  it("overlays STACK-owned facts without writing them into the source mirror", () => {
    const mirror = fullyMeasured("a-1", "2026-08-09");
    const before = structuredClone(mirror);
    const theAcceptedRun = acceptedRun("log-1", "2026-08-09", "a-1", {
      activityType: "long",
      effort: "great",
      notes: "Negative split.",
      workoutId: "workout-007",
    });

    const [run] = unifiedRunnerHistory({
      activities: [mirror],
      runLogs: [theAcceptedRun],
      blockPlacements: [
        { runLogId: "log-1", row: 0, columnStart: 1, width: 2, height: 1, placedAt: "now" },
      ],
    });

    expect(run.stack).toEqual({
      runLogId: "log-1",
      activityType: "long",
      effort: "great",
      notes: "Negative split.",
      workoutId: "workout-007",
      isExtra: false,
      source: "intervals",
      hasPlacedBlock: true,
    });
    // The mirror is untouched, and carries none of it.
    expect(mirror).toEqual(before);
    expect(JSON.stringify(mirror)).not.toContain("Negative split");
    expect(JSON.stringify(mirror)).not.toContain("workout-007");
  });

  it("prefers the run log's own distance and duration when the runner has corrected them", () => {
    // Every other STACK surface counts the run log's number. A history row that
    // disagreed with Build and the plan about how far a run was would be worse
    // than no history row at all.
    const [run] = unifiedRunnerHistory({
      activities: [historicalRun("a-1", "2026-08-09", { miles: 5, durationSeconds: 3_000 })],
      runLogs: [acceptedRun("log-1", "2026-08-09", "a-1", { distanceMiles: 5.2, durationSeconds: 3_120 })],
    });

    expect(run.distanceMiles).toBe(5.2);
    expect(run.durationSeconds).toBe(3_120);
    expect(run.paceSecondsPerMile).toBeCloseTo(3_120 / 5.2, 5);
  });

  it("fills a run log's gaps from the mirror without inventing anything", () => {
    const [run] = unifiedRunnerHistory({
      activities: [fullyMeasured("a-1", "2026-08-09")],
      // Accepted before STACK imported zones or cadence, so the run log has none.
      runLogs: [acceptedRun("log-1", "2026-08-09", "a-1", { importedMetrics: { averageHeartRate: 151 } })],
    });

    // The run log's own reading wins where it has one.
    expect(run.averageHeartRate).toBe(151);
    // The mirror supplies the rest.
    expect(run.maxHeartRate).toBe(170);
    expect(run.hrZoneSeconds).toEqual([300, 900, 600, 0, 0]);
    expect(run.averageCadence).toBe(79);
    expect(run.startTimeLocal).toBe("2026-08-09T06:00:00");
    expect(run.sourceName).toBe("Source run a-1");
  });

  it("leaves a metric neither record has as null, never zero", () => {
    const [run] = unifiedRunnerHistory({
      activities: [
        historicalRun("a-1", "2026-08-09"),
      ],
      runLogs: [],
    });

    expect(run.averageHeartRate).toBeNull();
    expect(run.maxHeartRate).toBeNull();
    expect(run.hrZoneSeconds).toBeNull();
    expect(run.elevationGainFeet).toBeNull();
    expect(run.averageCadence).toBeNull();
    expect(run.trainingLoad).toBeNull();
  });

  it("handles a run carrying only distance and duration", () => {
    const [run] = unifiedRunnerHistory({
      activities: [
        {
          ...historicalRun("a-1", "2026-08-09", { startTimeLocal: null }),
          movingTimeSeconds: null,
          elapsedTimeSeconds: 2_400,
        },
      ],
      runLogs: [],
    });

    expect(run.durationSeconds).toBe(2_400);
    expect(run.paceSecondsPerMile).toBeCloseTo(2_400 / (8_046.72 / 1_609.344), 5);
    expect(run.sourceName).toBeNull();
  });

  it("mixes historical, accepted, manual and extra runs into one chronology", () => {
    const runs = unifiedRunnerHistory({
      activities: [
        historicalRun("a-old", "2026-01-15"),
        historicalRun("a-accepted", "2026-08-09"),
        historicalRun("a-unreviewed", "2026-08-11"),
      ],
      runLogs: [
        acceptedRun("log-accepted", "2026-08-09", "a-accepted"),
        stackRun("log-manual", "2026-08-10", { workoutId: "workout-002" }),
        stackRun("log-extra", "2026-08-12"),
      ],
    });

    expect(runs.map((run) => run.date)).toEqual([
      "2026-08-12",
      "2026-08-11",
      "2026-08-10",
      "2026-08-09",
      "2026-01-15",
    ]);
    expect(runnerHistoryRange(runs)).toEqual({
      totalRuns: 5,
      earliestDate: "2026-01-15",
      latestDate: "2026-08-12",
      historicalOnlyRuns: 2,
      reconciledRuns: 1,
    });
  });

  it("is a pure read: calling it does not touch its inputs", () => {
    const activities = [historicalRun("a-1", "2026-08-09")];
    const runLogs = [acceptedRun("log-1", "2026-08-09", "a-1")];
    const activitiesBefore = structuredClone(activities);
    const runLogsBefore = structuredClone(runLogs);

    unifiedRunnerHistory({ activities, runLogs });
    unifiedRunnerHistory({ activities, runLogs });

    expect(activities).toEqual(activitiesBefore);
    expect(runLogs).toEqual(runLogsBefore);
  });

  it("filters to an inclusive date range", () => {
    const runs = unifiedRunnerHistory({
      activities: [
        historicalRun("a-1", "2026-08-01"),
        historicalRun("a-2", "2026-08-08"),
        historicalRun("a-3", "2026-08-15"),
      ],
      runLogs: [],
    });

    expect(runnerRunsBetween(runs, "2026-08-01", "2026-08-15")).toHaveLength(3);
    expect(runnerRunsBetween(runs, "2026-08-02", "2026-08-14").map((run) => run.date)).toEqual([
      "2026-08-08",
    ]);
  });
});
