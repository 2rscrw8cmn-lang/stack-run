import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeIntervalsActivity, type fetchIntervals } from "../connected/intervals";
import { earnedBlocks } from "../domain/build";
import { footprintFor } from "../domain/footprint";
import { selectTrainingSignals } from "../domain/trends";
import type { AppState } from "../domain/types";
import { projectMemberSummary, projectSharedRuns } from "../crew/projection";
import {
  acceptIntervalsRun,
  loadAppState,
  placeBlock,
  saveAppState,
  saveRunLog,
} from "../storage/appStateRepository";
import { createSeededAppState } from "../storage/migrations";
import { APP_STATE_STORAGE_KEY } from "../storage/storageKeys";
import { fixtureActivities } from "./historicalFixtures";
import { syncHistoricalActivities } from "./historicalSync";
import { runnerSnapshot } from "./runnerSnapshot";
import { unifiedRunnerHistory } from "./runnerRun";

/**
 * NEXT-2 reads. It does not write.
 *
 * NEXT-1 proved that syncing history changes nothing the runner already had.
 * The new risk this phase introduces is the read layer on top of it: the
 * unified history joins run logs, historical activities and Build placements,
 * and every one of those is somebody else's state. These are the tests that say
 * it stays somebody else's state — that Build still earns the same blocks, the
 * plan is untouched, Crew still projects run logs and nothing else, and a
 * device that has never connected anything is unaffected by all of it.
 */

const today = "2026-08-15";
const connection = { mode: "local-api-key" as const, credential: "fake-personal-key" };

function reader(activities: readonly Record<string, unknown>[]) {
  return (async (_resource, _connection, range) => {
    if (!range) throw new Error("historical reads must always be ranged");
    return activities.filter((activity) => {
      const date = String(activity.start_date_local).slice(0, 10);
      return date >= range.oldest && date <= range.newest;
    });
  }) as typeof fetchIntervals;
}

/** A device with a linked manual run, an accepted connected run, and blocks placed. */
function establishedDevice(): { state: AppState; acceptedActivityId: string } {
  let state: AppState = createSeededAppState();
  saveAppState(state);

  const workout = state.plan!.weeks
    .flatMap((week) => week.workouts)
    .find((item) => item.type !== "rest")!;

  state = saveRunLog(state, {
    workoutId: workout.id,
    completedDate: workout.date,
    activityType: "easy",
    distanceMiles: 4.2,
    durationSeconds: 2_400,
    effort: "solid",
    notes: "Felt good, humid.",
  });

  const acceptedActivityId = "fixture-2";
  const candidate = normalizeIntervalsActivity({
    id: acceptedActivityId,
    type: "Run",
    start_date_local: "2026-08-10T06:01:00",
    distance: 8_047,
    moving_time: 2_980,
    elapsed_time: 3_025,
    average_heartrate: 148,
  })!;
  state = acceptIntervalsRun(state, candidate, null, "easy", "great", "Imported, extra.");

  state.runLogs.forEach((runLog, index) => {
    const footprint = footprintFor(runLog);
    state = placeBlock(state, {
      runLogId: runLog.id,
      row: 0,
      columnStart: index === 0 ? 1 : 5,
      width: footprint.width,
      height: footprint.height,
    });
  });

  return { state, acceptedActivityId };
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("the runner history read layer beside the existing product", () => {
  it("leaves AppState byte-identical after a sync and a full read", async () => {
    const { state } = establishedDevice();
    const before = localStorage.getItem(APP_STATE_STORAGE_KEY);

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 5 })),
    });
    const runs = unifiedRunnerHistory({
      activities: result.activities,
      runLogs: state.runLogs,
      blockPlacements: state.blockPlacements,
    });
    runnerSnapshot(runs, today);

    expect(runs.length).toBeGreaterThan(50);
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe(before);
    expect(loadAppState()).toEqual(state);
  });

  it("earns no Build block for a run that only history knows about", async () => {
    const { state } = establishedDevice();
    const blocksBefore = earnedBlocks(state.plan, state.runLogs);

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 5 })),
    });
    const runs = unifiedRunnerHistory({
      activities: result.activities,
      runLogs: state.runLogs,
      blockPlacements: state.blockPlacements,
    });

    const after = loadAppState();
    expect(earnedBlocks(after.plan, after.runLogs)).toHaveLength(blocksBefore.length);
    expect(after.blockPlacements).toEqual(state.blockPlacements);
    // A run nobody logged carries no Build state at all — not a placed block,
    // not an unplaced one. Historical Build backfill remains NEXT-6's decision.
    const historyOnly = runs.filter((run) => run.origin === "historical-activity");
    expect(historyOnly.length).toBeGreaterThan(0);
    expect(historyOnly.every((run) => run.stack === null)).toBe(true);
  });

  it("leaves the plan and its links exactly as they were", async () => {
    const { state } = establishedDevice();
    const linked = state.runLogs.find((run) => run.workoutId !== null)!;

    const result = await syncHistoricalActivities({
      connection, lookbackDays: 365, today,
      read: reader(fixtureActivities({ newest: today, runs: 30, everyDays: 5 })),
    });
    unifiedRunnerHistory({ activities: result.activities, runLogs: state.runLogs });

    const after = loadAppState();
    expect(after.plan).toEqual(state.plan);
    expect(after.runLogs.find((run) => run.id === linked.id)?.workoutId).toBe(linked.workoutId);
  });

  it("keeps the Crew projection a projection of run logs and nothing else", async () => {
    const { state } = establishedDevice();
    const sharedBefore = projectSharedRuns(state.runLogs, state.blockPlacements);
    const summaryBefore = projectMemberSummary(state, today);

    const result = await syncHistoricalActivities({
      connection, lookbackDays: 365, today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 5 })),
    });
    unifiedRunnerHistory({ activities: result.activities, runLogs: state.runLogs });

    const after = loadAppState();
    expect(projectSharedRuns(after.runLogs, after.blockPlacements)).toEqual(sharedBefore);
    expect(projectMemberSummary(after, today)).toEqual(summaryBefore);
    // Sixty historical runs, and the crew still sees two: the ones the runner
    // actually logged. A year of private history never leaves the device.
    expect(sharedBefore).toHaveLength(2);
  });

  it("leaves the existing plan-relative Training Signals unchanged", async () => {
    const { state } = establishedDevice();
    const signalsBefore = selectTrainingSignals(state.plan!, state.runLogs, today);

    const result = await syncHistoricalActivities({
      connection, lookbackDays: 365, today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 5 })),
    });
    unifiedRunnerHistory({ activities: result.activities, runLogs: state.runLogs });

    const after = loadAppState();
    expect(selectTrainingSignals(after.plan!, after.runLogs, today)).toEqual(signalsBefore);
  });

  it("gives a manual-only device a full snapshot from its own runs", () => {
    let state: AppState = createSeededAppState();
    saveAppState(state);
    state = saveRunLog(state, {
      workoutId: null,
      completedDate: today,
      activityType: "easy",
      distanceMiles: 3.1,
      durationSeconds: 1_800,
      effort: "solid",
      notes: "",
    });
    const before = loadAppState();

    const runs = unifiedRunnerHistory({ runLogs: state.runLogs });
    const snapshot = runnerSnapshot(runs, today);

    expect(runs).toHaveLength(1);
    expect(snapshot.lastWeek.miles).toBe(3.1);
    expect(snapshot.lastFourWeeks.miles).toBe(3.1);
    expect(snapshot.frequency.runsPerWeek).not.toBeNull();
    expect(snapshot.range.historicalOnlyRuns).toBe(0);
    // Reading it changed nothing.
    expect(loadAppState()).toEqual(before);
  });

  it("agrees with Training Signals about this week's actual mileage", () => {
    // Both count the same runs over the same Monday-start week. If they ever
    // disagree, one of the two screens is lying to the runner.
    const { state } = establishedDevice();
    const signals = selectTrainingSignals(state.plan!, state.runLogs, today);
    const currentWeek = signals.weeklyMileage.find((week) => week.isCurrentWeek)!;
    const snapshot = runnerSnapshot(unifiedRunnerHistory({ runLogs: state.runLogs }), today);
    const snapshotWeek = snapshot.weeks.find((week) => week.isCurrentWeek)!;

    expect(snapshotWeek.startDate).toBe(currentWeek.startDate);
    expect(snapshotWeek.miles).toBe(currentWeek.actualMiles);
  });
});
