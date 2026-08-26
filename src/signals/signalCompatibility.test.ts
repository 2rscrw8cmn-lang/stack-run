import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeIntervalsActivity, type fetchIntervals } from "../connected/intervals.js";
import { earnedBlocks } from "../domain/build.js";
import { footprintFor } from "../domain/footprint.js";
import { selectTrainingSignals } from "../domain/trends.js";
import type { AppState } from "../domain/types.js";
import { projectMemberSummary, projectSharedRuns } from "../crew/projection.js";
import { fixtureActivities } from "../history/historicalFixtures.js";
import { syncHistoricalActivities } from "../history/historicalSync.js";
import { unifiedRunnerHistory } from "../history/runnerRun.js";
import {
  acceptIntervalsRun,
  loadAppState,
  placeBlock,
  saveAppState,
  saveRunLog,
} from "../storage/appStateRepository.js";
import { createSeededAppState } from "../storage/migrations.js";
import {
  APP_STATE_STORAGE_KEY,
  HISTORY_SYNC_STATE_STORAGE_KEY,
} from "../storage/storageKeys.js";
import { runnerSignals } from "./runnerSignals.js";

/**
 * NEXT-3 reads. It does not write, and it does not change anything NEXT-2 built.
 *
 * The signal layer joins run logs, historical activities and the plan, and all
 * three belong to something else. These say they stay that way: computing every
 * signal leaves AppState byte-identical, earns no Build block, moves no
 * placement, edits no plan, adds nothing to the Crew projection, and leaves the
 * historical mirror and its sync bookkeeping exactly where NEXT-1 and NEXT-2 put
 * them.
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
function establishedDevice(): AppState {
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

  const candidate = normalizeIntervalsActivity({
    id: "fixture-2",
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

  return state;
}

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("Training Signals v2 beside the existing product", () => {
  it("leaves AppState byte-identical after computing every signal", async () => {
    const state = establishedDevice();
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
    const signals = runnerSignals({
      runs,
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });

    expect(signals).toHaveLength(6);
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe(before);
    expect(loadAppState()).toEqual(state);
  });

  it("earns no Build block and moves no placement", async () => {
    const state = establishedDevice();
    const blocksBefore = earnedBlocks(state.plan, state.runLogs);

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 5 })),
    });
    runnerSignals({
      runs: unifiedRunnerHistory({
        activities: result.activities,
        runLogs: state.runLogs,
        blockPlacements: state.blockPlacements,
      }),
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });

    const after = loadAppState();
    expect(earnedBlocks(after.plan, after.runLogs)).toHaveLength(blocksBefore.length);
    expect(after.blockPlacements).toEqual(state.blockPlacements);
  });

  it("leaves the plan, its links and the accepted run untouched", async () => {
    const state = establishedDevice();
    const linked = state.runLogs.find((run) => run.workoutId !== null)!;
    const accepted = state.runLogs.find((run) => run.externalSource !== null)!;

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 30, everyDays: 5 })),
    });
    runnerSignals({
      runs: unifiedRunnerHistory({
        activities: result.activities,
        runLogs: state.runLogs,
      }),
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });

    const after = loadAppState();
    expect(after.plan).toEqual(state.plan);
    expect(after.runLogs).toEqual(state.runLogs);
    expect(after.runLogs.find((run) => run.id === linked.id)?.workoutId).toBe(
      linked.workoutId,
    );
    expect(
      after.runLogs.find((run) => run.id === accepted.id)?.externalSource,
    ).toEqual(accepted.externalSource);
  });

  it("adds nothing to the Crew projection", async () => {
    const state = establishedDevice();
    const sharedBefore = projectSharedRuns(state.runLogs, state.blockPlacements);
    const summaryBefore = projectMemberSummary(state, today);

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(
        fixtureActivities({
          newest: today,
          runs: 60,
          everyDays: 5,
        }),
      ),
    });
    const runs = unifiedRunnerHistory({
      activities: result.activities,
      runLogs: state.runLogs,
    });
    runnerSignals({ runs, today, plan: state.plan, runLogs: state.runLogs });

    const after = loadAppState();
    const shared = projectSharedRuns(after.runLogs, after.blockPlacements);
    expect(shared).toEqual(sharedBefore);
    expect(projectMemberSummary(after, today)).toEqual(summaryBefore);
    // Sixty historical runs with heart rate behind the signals, and the crew
    // still sees two runs and no health metric of any kind.
    expect(shared).toHaveLength(2);
    const serialized = JSON.stringify([shared, projectMemberSummary(after, today)]);
    for (const field of ["heart", "hrZone", "trainingLoad", "zone", "activityId"]) {
      expect(serialized).not.toContain(field);
    }
  });

  it("leaves the plan-relative domain calculation itself unchanged", async () => {
    const state = establishedDevice();
    const planSignalsBefore = selectTrainingSignals(state.plan!, state.runLogs, today);

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 5 })),
    });
    runnerSignals({
      runs: unifiedRunnerHistory({
        activities: result.activities,
        runLogs: state.runLogs,
      }),
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });

    const after = loadAppState();
    expect(selectTrainingSignals(after.plan!, after.runLogs, today)).toEqual(
      planSignalsBefore,
    );
  });

  it("leaves the historical mirror and its sync bookkeeping alone", async () => {
    const state = establishedDevice();
    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 40, everyDays: 5 })),
    });
    const mirrorBefore = JSON.stringify(result.activities);
    const syncStateBefore = localStorage.getItem(HISTORY_SYNC_STATE_STORAGE_KEY);

    runnerSignals({
      runs: unifiedRunnerHistory({
        activities: result.activities,
        runLogs: state.runLogs,
      }),
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });

    expect(JSON.stringify(result.activities)).toBe(mirrorBefore);
    expect(localStorage.getItem(HISTORY_SYNC_STATE_STORAGE_KEY)).toBe(syncStateBefore);
  });

  it("persists no derived signal cache of its own", async () => {
    const state = establishedDevice();
    const keysBefore = Object.keys(localStorage).sort();

    runnerSignals({
      runs: unifiedRunnerHistory({ runLogs: state.runLogs }),
      today,
      plan: state.plan,
      runLogs: state.runLogs,
    });

    expect(Object.keys(localStorage).sort()).toEqual(keysBefore);
  });
});
