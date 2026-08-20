import { describe, expect, it } from "vitest";
import {
  APP_STATE_STORAGE_KEY,
  HISTORICAL_ACTIVITIES_STORAGE_KEY,
} from "../storage/storageKeys";
import {
  clearHistoricalActivities,
  loadHistoricalActivities,
  saveHistoricalActivities,
} from "../storage/historicalActivityRepository";
import { createInitialAppState } from "../storage/migrations";
import { earnedBlocks, selectBuildViewModel } from "../domain/build";
import { autoPlaceOption, placementOptions } from "../domain/placement";
import { footprintFor } from "../domain/footprint";
import type { AppState, BlockPlacement } from "../domain/types";
import {
  projectMemberSummary,
  projectSharedRuns,
  projectionFingerprint,
} from "../crew/projection";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import { acceptedRun, historicalRun, stackRun } from "./runnerFixtures";
import { unifiedRunnerHistory } from "./runnerRun";

/**
 * NEXT-6 — where the runner-history model stops.
 *
 * Two boundaries were true before this phase and defended by nothing: Build
 * counts only runs the runner brought into STACK, and Crew never sees the
 * source mirror at all. Both were accidents of where a value happens to be
 * stored, and an accident is not a rule. These are the rules.
 *
 * The owner decision behind them (August 19, 2026): historical activity never
 * earns a Build block, and there is no backfill — see
 * `docs/NEXT6_BUILD_CREW_COMPATIBILITY.md`.
 */
const plan = loadSeedPlan();
const today = "2026-08-16";

/** A year of connected history the runner never accepted into STACK. */
function yearOfHistory() {
  return Array.from({ length: 120 }, (_, index) =>
    historicalRun(`history-${index}`, `2026-0${(index % 8) + 1}-${String((index % 27) + 1).padStart(2, "0")}`, {
      miles: 4 + (index % 9),
    }),
  );
}

/** The runs the runner did bring in: two logged, one accepted from the source. */
function stackRunLogs() {
  return [
    stackRun("run-manual", "2026-08-11", { workoutId: "workout-002", distanceMiles: 2.4 }),
    stackRun("run-extra", "2026-08-13", { distanceMiles: 5 }),
    acceptedRun("run-accepted", "2026-08-15", "history-3", { distanceMiles: 6.2 }),
  ];
}

describe("Build counts what the runner built", () => {
  it("earns no block for a run STACK was never given", () => {
    const runLogs = stackRunLogs();
    const runs = unifiedRunnerHistory({
      activities: yearOfHistory(),
      runLogs,
    });

    // The unified history is much bigger than the tower, and that is the point:
    // a real run with no STACK overlay is real running and no block.
    expect(runs.length).toBeGreaterThan(runLogs.length);
    const withoutStack = runs.filter((run) => run.stack === null);
    expect(withoutStack.length).toBe(runs.length - runLogs.length);
    expect(withoutStack.every((run) => run.stack?.hasPlacedBlock !== true)).toBe(true);

    expect(earnedBlocks(plan, runLogs)).toHaveLength(runLogs.length);
  });

  it("earns one block, not two, when an accepted run has a source mirror", () => {
    // The ownership case NEXT-6 exists to check: `run-accepted` was imported
    // from `history-3`, so the same physical run is in both records. It is one
    // run, one row and one block — reconciled on external identity, never on
    // date and distance.
    const runLogs = stackRunLogs();
    const runs = unifiedRunnerHistory({ activities: yearOfHistory(), runLogs });
    const accepted = runs.filter((run) => run.stack?.runLogId === "run-accepted");

    expect(accepted).toHaveLength(1);
    expect(accepted[0].isReconciled).toBe(true);
    expect(accepted[0].externalActivityId).toBe("history-3");
    expect(
      earnedBlocks(plan, runLogs).filter(
        (block) => block.runLog.id === "run-accepted",
      ),
    ).toHaveLength(1);
  });

  it("builds the same tower whether or not a year of history exists", () => {
    const runLogs = stackRunLogs();
    // Two of the three runs placed, so the third proves a pending block is
    // pending because nobody placed it, not because history moved it.
    const placements: BlockPlacement[] = [];
    for (const run of runLogs.slice(0, 2)) {
      const footprint = footprintFor(run);
      const option = autoPlaceOption(
        placementOptions(footprint.width, footprint.height, placements),
      );
      if (!option) continue;
      placements.push({
        runLogId: run.id,
        row: option.row,
        columnStart: option.columnStart,
        width: footprint.width,
        height: footprint.height,
        placedAt: `${run.completedDate}T12:00:00.000Z`,
      });
    }
    expect(placements).toHaveLength(2);

    const tower = selectBuildViewModel(plan, runLogs, placements, today);

    // Build takes the plan, the run logs and the placements. History is not one
    // of its inputs, so importing a year of it cannot move a brick — and the
    // history that does exist reports exactly the placements Build knows about.
    const runs = unifiedRunnerHistory({
      activities: yearOfHistory(),
      runLogs,
      blockPlacements: placements,
    });
    expect(tower.blocks).toHaveLength(placements.length);
    expect(tower.pendingBlocks).toHaveLength(runLogs.length - placements.length);
    expect(runs.filter((run) => run.stack?.hasPlacedBlock).length).toBe(
      placements.length,
    );
    expect(selectBuildViewModel(plan, runLogs, placements, today)).toEqual(tower);
  });
});

describe("Crew never sees the source mirror", () => {
  function stateWith(runLogs: AppState["runLogs"]): AppState {
    return { ...createInitialAppState(), plan, runLogs };
  }

  it("keeps historical activity outside the value Crew projects from", () => {
    // The structural half of the boundary: Crew projects an AppState, and the
    // source mirror is stored under its own key instead. If a later phase moves
    // history into AppState, this is the test that says why it must not.
    expect(HISTORICAL_ACTIVITIES_STORAGE_KEY).not.toBe(APP_STATE_STORAGE_KEY);
    expect(Object.keys(createInitialAppState()).sort()).not.toContain("activities");

    clearHistoricalActivities();
    saveHistoricalActivities(yearOfHistory());
    expect(loadHistoricalActivities().length).toBeGreaterThan(100);
    // The stored history is real and reachable, and none of it is in the value
    // every projection path takes.
    expect(JSON.stringify(createInitialAppState())).not.toContain("history-1");
    clearHistoricalActivities();
  });

  it("projects one shared run per accepted run and nothing else", () => {
    const runLogs = stackRunLogs();
    const state = stateWith(runLogs);
    const projected = projectSharedRuns(state.runLogs, state.blockPlacements);

    expect(projected.map((run) => run.localRunId)).toEqual(
      runLogs.map((run) => run.id),
    );
    // The safe projection's whole field list, restated here so widening it is a
    // deliberate act rather than a diff nobody reads.
    //
    // It has widened once, deliberately: D-079 sends Crew a heart rate and
    // D-080 four derived award scores, both computed on this device from
    // accepted runs. Every field below still comes from a `RunLog` — no
    // historical-only activity reaches this payload, which is what the rest of
    // this file exists to hold.
    for (const run of projected) {
      expect(Object.keys(run).sort()).toEqual(
        [
          "activityType",
          "averageHeartRate",
          "awardLevelUpPercent",
          "awardSteadySeconds",
          "awardTargetPercent",
          "awardZone2Percent",
          "buildColumnStart",
          "buildHeight",
          "buildRow",
          "buildWidth",
          "distanceMiles",
          "durationSeconds",
          "localDate",
          "localRunId",
          "manualHeartRate",
          "maxHeartRate",
        ].sort(),
      );
    }
  });

  it("uploads nothing extra once a year of connected history is synced", () => {
    const runLogs = stackRunLogs();
    const state = stateWith(runLogs);

    clearHistoricalActivities();
    const beforeSync = projectionFingerprint(state, today);

    saveHistoricalActivities(yearOfHistory());
    // The runner's own screens can now see all of this running...
    const withHistory = unifiedRunnerHistory({
      activities: loadHistoricalActivities(),
      runLogs,
    });
    expect(withHistory.length).toBeGreaterThan(100);

    // ...and what their crew receives is byte-identical to before the sync.
    // This is the assertion that fails the day a projection path starts
    // reading the source mirror.
    expect(projectionFingerprint(state, today)).toBe(beforeSync);
    expect(projectMemberSummary(state, today).milesBuilt).toBe(
      Number(
        runLogs.reduce((total, run) => total + run.distanceMiles, 0).toFixed(2),
      ),
    );
    clearHistoricalActivities();
  });
});
