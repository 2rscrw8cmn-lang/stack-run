import { afterEach, describe, expect, it, vi } from "vitest";
import type { fetchIntervals } from "../connected/intervals.js";
import { normalizeIntervalsActivity } from "../connected/intervals.js";
import { earnedBlocks } from "../domain/build.js";
import {
  acceptIntervalsRun,
  loadAppState,
  placeBlock,
  saveAppState,
  saveRunLog,
} from "../storage/appStateRepository.js";
import {
  loadPendingIntervalsCandidates,
  savePendingIntervalsCandidates,
} from "../storage/intervalsPendingRepository.js";
import { createInitialAppState, createSeededAppState } from "../storage/migrations.js";
import { APP_STATE_STORAGE_KEY, INTERVALS_PENDING_STORAGE_KEY } from "../storage/storageKeys.js";
import { footprintFor } from "../domain/footprint.js";
import type { AppState } from "../domain/types.js";
import { fixtureActivities } from "./historicalFixtures.js";
import { historicalAcceptanceCounts, runLogForHistoricalActivity, unacceptedHistoricalActivities } from "./historicalLinks.js";
import { syncHistoricalActivities } from "./historicalSync.js";

/**
 * NEXT-1 adds a history layer beside the existing application, not underneath
 * it. These are the tests that say so: everything the runner already had —
 * manual runs, accepted connected runs, plan links, placed Build blocks, the
 * Run Data review queue — must come out of a historical sync exactly as it
 * went in, and a year of newly discovered history must earn no Build blocks.
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

/**
 * A device that already has a life: a manual run linked to a scheduled
 * workout, an accepted connected run, and a Build block placed for each.
 */
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

  // The same activity the fixture generator produces as `fixture-2`, so the
  // history layer and the accepted run are talking about one run.
  const acceptedActivityId = "fixture-2";
  const candidate = normalizeIntervalsActivity({
    id: acceptedActivityId,
    type: "Run",
    start_date_local: "2026-08-11T06:01:00",
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

describe("historical sync beside the existing application", () => {
  it("leaves manual runs, accepted connected runs, plan links and Build placements byte-identical", async () => {
    const { state } = establishedDevice();
    const before = localStorage.getItem(APP_STATE_STORAGE_KEY);
    const manualRun = state.runLogs.find((run) => run.source === "manual")!;

    await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 4 })),
    });

    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe(before);
    const after = loadAppState();
    expect(after.runLogs).toEqual(state.runLogs);
    expect(after.blockPlacements).toEqual(state.blockPlacements);
    expect(after.plan).toEqual(state.plan);
    expect(after.intervalsSync).toEqual(state.intervalsSync);
    // The manual run still satisfies its scheduled workout, with its own words.
    const stillManual = after.runLogs.find((run) => run.id === manualRun.id)!;
    expect(stillManual.workoutId).toBe(manualRun.workoutId);
    expect(stillManual.notes).toBe("Felt good, humid.");
    expect(stillManual.source).toBe("manual");
  });

  it("generates no Build block for a newly discovered historical activity", async () => {
    const { state } = establishedDevice();
    const blocksBefore = earnedBlocks(state.plan, state.runLogs);

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 60, everyDays: 4 })),
    });

    expect(result.activities.length).toBeGreaterThan(50);
    const after = loadAppState();
    expect(after.runLogs).toHaveLength(state.runLogs.length);
    expect(after.blockPlacements).toHaveLength(state.blockPlacements.length);
    expect(earnedBlocks(after.plan, after.runLogs)).toHaveLength(blocksBefore.length);
  });

  it("does not put a year of history into the Run Data review queue", async () => {
    // The review queue is what the runner is *asked* about. History is context.
    const { state } = establishedDevice();
    const pending = normalizeIntervalsActivity({
      id: "pending-1", type: "Run", start_date_local: `${today}T18:00:00`,
      distance: 5_000, moving_time: 1_800,
    })!;
    savePendingIntervalsCandidates([pending]);

    await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 40, everyDays: 4 })),
    });

    expect(loadPendingIntervalsCandidates()).toEqual([pending]);
    expect(localStorage.getItem(INTERVALS_PENDING_STORAGE_KEY)).not.toContain("fixture-1");
    expect(state.intervalsSync.ignoredActivityIds).toEqual([]);
  });

  it("mirrors an already accepted connected run without duplicating or altering it", async () => {
    const { state, acceptedActivityId } = establishedDevice();
    const acceptedRun = state.runLogs.find(
      (run) => run.externalSource?.activityId === acceptedActivityId,
    )!;

    const result = await syncHistoricalActivities({
      connection,
      lookbackDays: 365,
      today,
      read: reader(fixtureActivities({ newest: today, runs: 10, everyDays: 4 })),
    });

    // One historical record for the activity, and it is linkable to the run
    // the runner accepted — a derivation, not a stored field.
    const mirrored = result.activities.filter((activity) => activity.sourceId === acceptedActivityId);
    expect(mirrored).toHaveLength(1);
    expect(JSON.stringify(mirrored[0])).not.toContain("runLog");
    expect(runLogForHistoricalActivity(mirrored[0], state.runLogs)?.id).toBe(acceptedRun.id);
    expect(loadAppState().runLogs.find((run) => run.id === acceptedRun.id)).toEqual(acceptedRun);

    const counts = historicalAcceptanceCounts(result.activities, state.runLogs);
    expect(counts).toEqual({ total: 10, accepted: 1, unaccepted: 9 });
    expect(unacceptedHistoricalActivities(result.activities, state.runLogs)).toHaveLength(9);
  });

  it("works on a device that has only ever logged runs by hand", async () => {
    const state = createInitialAppState();
    saveAppState(state);
    saveRunLog(state, {
      workoutId: null,
      completedDate: today,
      activityType: "easy",
      distanceMiles: 3.1,
      durationSeconds: 1_800,
      effort: "solid",
      notes: "",
    });
    const before = loadAppState();

    const result = await syncHistoricalActivities({
      connection, lookbackDays: 90, today, read: reader([]),
    });

    expect(result.activities).toEqual([]);
    expect(result.failure).toBeNull();
    expect(loadAppState()).toEqual(before);
  });
});
