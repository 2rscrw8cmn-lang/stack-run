import { describe, expect, it } from "vitest";
import type { ImportedRunMetrics, RunLog } from "../domain/types.js";
import type { IntervalsCandidate } from "./intervals.js";
import { planSourceMetricRefresh, refreshChangesRun } from "./sourceRefresh.js";

function importedRun(overrides: Partial<RunLog> = {}, metrics: ImportedRunMetrics = {}): RunLog {
  return {
    id: "run-1",
    workoutId: "workout-002",
    completedDate: "2026-08-13",
    activityType: "easy",
    distanceMiles: 2.76,
    durationSeconds: 1818,
    effort: "great",
    notes: "Felt easy the whole way.",
    createdAt: "2026-08-13T13:00:00.000Z",
    updatedAt: "2026-08-13T13:00:00.000Z",
    source: "intervals",
    externalSource: {
      provider: "intervals",
      activityId: "i1",
      sourceUpdatedAt: "2026-08-13T12:00:00Z",
      importedAt: "2026-08-13T13:00:00Z",
    },
    importedMetrics: { elevationGainFeet: 115.6, averageHeartRate: 153, ...metrics },
    ...overrides,
  };
}

function candidate(overrides: Partial<IntervalsCandidate> = {}): IntervalsCandidate {
  return {
    externalId: "i1",
    sourceType: "Run",
    completedDate: "2026-08-13",
    distanceMiles: 2.76,
    durationSeconds: 1818,
    sourceUpdatedAt: "2026-08-14T09:00:00Z",
    metrics: { elevationGainFeet: 232.4, averageHeartRate: 153 },
    inferredActivityType: "easy",
    ...overrides,
  };
}

/**
 * Issue #214, part 10: an imported Intervals activity is *settled* and never
 * returns to the review queue, which is correct — and which used to mean the
 * aggregates imported with it could never be corrected. A source that later
 * restated an activity's climbing total had no way to reach STACK, and the
 * runner was left comparing a frozen number against a live one in Intervals.
 */
describe("source metric refresh", () => {
  it("refreshes an imported run when the source states a newer elevation gain", () => {
    const refreshes = planSourceMetricRefresh([candidate()], [importedRun()]);

    expect(refreshes).toEqual([
      {
        runLogId: "run-1",
        activityId: "i1",
        sourceUpdatedAt: "2026-08-14T09:00:00Z",
        metrics: { elevationGainFeet: 232.4, averageHeartRate: 153 },
      },
    ]);
  });

  it("leaves a run alone when the source is saying the same thing it said before", () => {
    expect(planSourceMetricRefresh(
      [candidate({ sourceUpdatedAt: "2026-08-13T12:00:00Z" })],
      [importedRun()],
    )).toEqual([]);
    // And when the source has gone backwards, which is not new information.
    expect(planSourceMetricRefresh(
      [candidate({ sourceUpdatedAt: "2026-08-01T09:00:00Z" })],
      [importedRun()],
    )).toEqual([]);
  });

  it("treats a first-ever source stamp as newer than none at all", () => {
    const run = importedRun({
      externalSource: {
        provider: "intervals",
        activityId: "i1",
        sourceUpdatedAt: null,
        importedAt: "2026-08-13T13:00:00Z",
      },
    });

    expect(planSourceMetricRefresh([candidate()], [run])).toHaveLength(1);
  });

  it("ignores a candidate with no usable stamp rather than guessing it is newer", () => {
    expect(planSourceMetricRefresh([candidate({ sourceUpdatedAt: null })], [importedRun()])).toEqual([]);
    expect(planSourceMetricRefresh([candidate({ sourceUpdatedAt: "whenever" })], [importedRun()])).toEqual([]);
  });

  it("never matches a manual run, or a run whose activity the read did not mention", () => {
    const manual = importedRun({ id: "manual", source: "manual", externalSource: null });
    expect(planSourceMetricRefresh([candidate()], [manual])).toEqual([]);
    expect(planSourceMetricRefresh([candidate({ externalId: "other" })], [importedRun()])).toEqual([]);
  });

  it("keeps a source-verified best 5K the activity list does not carry", () => {
    const run = importedRun({}, { best5kSeconds: 1_320 });
    const [refresh] = planSourceMetricRefresh([candidate()], [run]);

    expect(refresh.metrics.best5kSeconds).toBe(1_320);
    expect(refresh.metrics.elevationGainFeet).toBe(232.4);
  });

  it("drops a stored metric the source no longer states rather than merging it forward", () => {
    const run = importedRun({}, { trainingLoad: 42 });
    const [refresh] = planSourceMetricRefresh([candidate()], [run]);

    // The newer answer is the whole answer: a load the source has removed is
    // not still true because STACK once heard it.
    expect(refresh.metrics.trainingLoad).toBeUndefined();
  });

  it("knows when applying a refresh would change nothing at all", () => {
    const run = importedRun();
    const unchanged = {
      runLogId: run.id,
      activityId: "i1",
      sourceUpdatedAt: run.externalSource!.sourceUpdatedAt!,
      metrics: run.importedMetrics!,
    };
    expect(refreshChangesRun(unchanged, run)).toBe(false);
    expect(refreshChangesRun({ ...unchanged, sourceUpdatedAt: "2026-08-14T09:00:00Z" }, run)).toBe(true);
    expect(refreshChangesRun(
      { ...unchanged, metrics: { ...run.importedMetrics, elevationGainFeet: 232.4 } },
      run,
    )).toBe(true);
  });

  it("compares zone arrays by their contents, not by identity", () => {
    const run = importedRun({}, { hrZoneSeconds: [10, 20, 30] });
    const same = {
      runLogId: run.id,
      activityId: "i1",
      sourceUpdatedAt: run.externalSource!.sourceUpdatedAt!,
      metrics: { ...run.importedMetrics, hrZoneSeconds: [10, 20, 30] },
    };
    expect(refreshChangesRun(same, run)).toBe(false);
    expect(refreshChangesRun(
      { ...same, metrics: { ...same.metrics, hrZoneSeconds: [10, 20, 31] } },
      run,
    )).toBe(true);
  });
});
