import { afterEach, describe, expect, it, vi } from "vitest";
import { addDaysToLocalDate } from "../domain/dates";
import { unifiedRunnerHistory } from "../history/runnerRun";
import { createQaRunnerAppState, qaRunnerHistoricalActivities } from "./qaRunner";
import {
  QA_AGGREGATE_ONLY_ACTIVITY_ID,
  QA_HISTORICAL_AGGREGATE_ACTIVITY_ID,
  QA_HISTORICAL_RICH_ACTIVITY_ID,
  QA_RICH_PROFILE_ACTIVITY_ID,
  qaSourceDetailReaderFor,
} from "./qaSourceDetail";

const TODAY = "2026-08-16";
const reader = qaSourceDetailReaderFor(null)!;

afterEach(() => vi.restoreAllMocks());

describe("QA source-detail reader", () => {
  it("answers without a credential, a connection or a single network request", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");

    await reader.readProfile(QA_RICH_PROFILE_ACTIVITY_ID);
    await reader.readDetail(QA_RICH_PROFILE_ACTIVITY_ID);
    await reader.readProfile(QA_HISTORICAL_RICH_ACTIVITY_ID);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(qaSourceDetailReaderFor("some-token")).toBe(qaSourceDetailReaderFor(null));
  });

  it("writes nothing anywhere: the synthetic profile lives only as long as the read", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    await reader.readProfile(QA_RICH_PROFILE_ACTIVITY_ID);
    await reader.readDetail(QA_RICH_PROFILE_ACTIVITY_ID);

    expect(setItem).not.toHaveBeenCalled();
  });

  it("is deterministic, so every review starts from the same run", async () => {
    const first = await reader.readProfile(QA_RICH_PROFILE_ACTIVITY_ID);
    const second = await reader.readProfile(QA_RICH_PROFILE_ACTIVITY_ID);
    expect(second).toEqual(first);
  });

  it("produces a rich profile the production normalizer recognizes", async () => {
    const profile = await reader.readProfile(QA_RICH_PROFILE_ACTIVITY_ID);
    expect(profile).not.toBeNull();

    const samples = profile!.samples;
    // 150 samples every 20 seconds is 49:40, which is the run's own duration.
    expect(samples).toHaveLength(150);
    expect(samples[samples.length - 1].timeSeconds).toBe(2_980);
    for (const metric of ["paceSecondsPerMile", "heartRate", "elevationFeet", "cadence"] as const) {
      expect(samples.filter((sample) => sample[metric] !== undefined).length).toBeGreaterThan(100);
    }
  });

  it("leaves real gaps in the samples so a broken line is reviewable", async () => {
    const samples = (await reader.readProfile(QA_RICH_PROFILE_ACTIVITY_ID))!.samples;

    // A strap dropout, a position dropout and one standing-still sample: each
    // keeps its time position and carries no value, which is what breaks the
    // line rather than joining across data that was never recorded.
    expect(samples.some((sample) => sample.heartRate === undefined)).toBe(true);
    expect(samples.some((sample) => sample.paceSecondsPerMile === undefined)).toBe(true);
    expect(samples.some((sample) => sample.cadence === undefined)).toBe(true);
    expect(samples.every((sample) => Number.isFinite(sample.timeSeconds))).toBe(true);
  });

  it("keeps synthetic cadence at the source's own convention rather than doubling it", async () => {
    const samples = (await reader.readProfile(QA_RICH_PROFILE_ACTIVITY_ID))!.samples;
    const cadence = samples.flatMap((sample) => sample.cadence ?? []);

    // Around 79, never around 158. A fixture that quietly doubled cadence would
    // teach a review to accept the one thing this repository has verified is
    // not true of the source.
    expect(Math.min(...cadence)).toBeGreaterThanOrEqual(70);
    expect(Math.max(...cadence)).toBeLessThanOrEqual(90);
  });

  it("answers the aggregate-only runs with no profile and no structured groups", async () => {
    for (const id of [QA_AGGREGATE_ONLY_ACTIVITY_ID, QA_HISTORICAL_AGGREGATE_ACTIVITY_ID]) {
      expect(await reader.readProfile(id)).toBeNull();
      expect(await reader.readDetail(id)).toEqual({ intervals: [] });
    }
  });

  it("answers every other synthetic run the way an ordinary run with no streams does", async () => {
    expect(await reader.readProfile("qa-history-3-1")).toBeNull();
    expect(await reader.readDetail("qa-history-3-1")).toEqual({ intervals: [] });
  });

  it("gives the accepted rich run structured groups and the historical one none", async () => {
    expect((await reader.readDetail(QA_RICH_PROFILE_ACTIVITY_ID)).intervals.length)
      .toBeGreaterThan(1);
    expect(await reader.readDetail(QA_HISTORICAL_RICH_ACTIVITY_ID)).toEqual({ intervals: [] });
  });
});

describe("QA review runs", () => {
  const runs = () => {
    const state = createQaRunnerAppState(TODAY);
    return unifiedRunnerHistory({
      activities: qaRunnerHistoricalActivities(TODAY),
      runLogs: state.runLogs,
      blockPlacements: state.blockPlacements,
    });
  };

  it("offers one run for each corner of the review: owned or not, rich or aggregate-only", () => {
    const byActivity = new Map(
      runs().flatMap((run) => (run.externalActivityId ? [[run.externalActivityId, run]] : [])),
    );

    expect(byActivity.get(QA_RICH_PROFILE_ACTIVITY_ID)?.stack).not.toBeNull();
    expect(byActivity.get(QA_AGGREGATE_ONLY_ACTIVITY_ID)?.stack).not.toBeNull();
    expect(byActivity.get(QA_HISTORICAL_RICH_ACTIVITY_ID)?.stack).toBeNull();
    expect(byActivity.get(QA_HISTORICAL_AGGREGATE_ACTIVITY_ID)?.stack).toBeNull();
  });

  it("appears once each, reconciled rather than duplicated", () => {
    const ids = runs().flatMap((run) => run.externalActivityId ?? []);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps the aggregate-only historical run genuinely data-poor", () => {
    const run = runs().find(
      (candidate) => candidate.externalActivityId === QA_HISTORICAL_AGGREGATE_ACTIVITY_ID,
    )!;

    expect(run.distanceMiles).toBeGreaterThan(0);
    expect(run.durationSeconds).not.toBeNull();
    expect(run.paceSecondsPerMile).not.toBeNull();
    expect(run.averageHeartRate).toBeNull();
    expect(run.maxHeartRate).toBeNull();
    expect(run.hrZoneSeconds).toBeNull();
    expect(run.elevationGainFeet).toBeNull();
    expect(run.averageCadence).toBeNull();
    expect(run.trainingLoad).toBeNull();
  });

  it("gives the rich runs the aggregates their profiles must not replace", () => {
    const accepted = runs().find(
      (candidate) => candidate.externalActivityId === QA_RICH_PROFILE_ACTIVITY_ID,
    )!;

    expect(accepted.date).toBe(addDaysToLocalDate(TODAY, -2));
    expect(accepted.averageHeartRate).toBe(147);
    expect(accepted.maxHeartRate).toBe(171);
    expect(accepted.elevationGainFeet).toBe(214);
    expect(accepted.averageCadence).toBe(79);
    expect(accepted.hrZoneSeconds).not.toBeNull();
  });

  it("leaves the review runs as extra runs rather than rewriting the plan", () => {
    const state = createQaRunnerAppState(TODAY);
    const review = state.runLogs.filter((run) => run.id.startsWith("qa-run-detail-"));

    expect(review).toHaveLength(2);
    expect(review.every((run) => run.workoutId === null)).toBe(true);
  });
});
