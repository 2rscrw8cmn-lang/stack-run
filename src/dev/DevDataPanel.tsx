import { useState } from "react";
import { earnedBlocks, scheduledRuns, spanForWorkout } from "../domain/build";
import {
  autoPlaceOption,
  placementOptions,
  placementsForWeek,
} from "../domain/placement";
import type { AppState } from "../domain/types";
import {
  placeBlock,
  resetAppState,
  saveRunLog,
} from "../storage/appStateRepository";

interface DevDataPanelProps {
  state: AppState;
  onChange: (next: AppState) => void;
}

/**
 * Temporary shortcuts for exercising the build by hand. Today can only log the
 * run scheduled for the current date, so on a rest day — or before the plan
 * starts — there is no way to put blocks on the screen at all. Logging past and
 * future runs is the Plan screen's job in UI-5; until then this panel stands in
 * for it, on a phone against a deployed build as much as on a dev server.
 *
 * Everything here goes through the normal repository functions, so it
 * exercises the same validation and persistence the real UI does.
 *
 * This is scaffolding, not product. It ships until the Plan screen makes it
 * unnecessary, and UI-7 removes it before release.
 */
export function DevDataPanel({ state, onChange }: DevDataPanelProps) {
  const [isOpen, setOpen] = useState(false);

  const loggedWorkoutIds = new Set(
    state.runLogs.map((runLog) => runLog.workoutId),
  );
  const nextUnlogged = scheduledRuns(state.plan).filter(
    (workout) => !loggedWorkoutIds.has(workout.id),
  );
  const placedWorkoutIds = new Set(
    state.blockPlacements.map((placement) => placement.workoutId),
  );
  const pending = earnedBlocks(state.plan, state.runLogs).filter(
    (block) => !placedWorkoutIds.has(block.workout.id),
  );

  function logRuns(count: number) {
    let next = state;
    for (const workout of nextUnlogged.slice(0, count)) {
      const target = Number.parseFloat(workout.targetDistanceMiles ?? "3");
      next = saveRunLog(next, {
        workoutId: workout.id,
        completedDate: workout.date,
        distanceMiles: Number.isFinite(target) ? target : 3,
        durationSeconds: Math.round((Number.isFinite(target) ? target : 3) * 9 * 60),
        effort: "solid",
        notes: "",
      });
    }
    onChange(next);
  }

  function placeAllPending() {
    let next = state;
    for (const block of pending) {
      const span = spanForWorkout(block.workout);
      const weekNumber = block.workout.weekNumber;
      const option = autoPlaceOption(
        placementOptions(
          span,
          placementsForWeek(next.blockPlacements, weekNumber),
          placementsForWeek(next.blockPlacements, weekNumber - 1),
          weekNumber === next.plan.weeks[0].weekNumber,
        ),
      );
      if (!option) {
        continue;
      }
      next = placeBlock(next, {
        workoutId: block.workout.id,
        weekNumber,
        columnStart: option.columnStart,
        span,
      });
    }
    onChange(next);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="dev-panel__toggle"
        onClick={() => setOpen(true)}
      >
        DEV
      </button>
    );
  }

  return (
    <div className="dev-panel">
      <div className="dev-panel__header">
        <span>Dev data</span>
        <button type="button" onClick={() => setOpen(false)}>
          close
        </button>
      </div>
      <p className="dev-panel__status">
        {state.runLogs.length} logged · {pending.length} pending ·{" "}
        {state.blockPlacements.length} placed
      </p>
      <div className="dev-panel__actions">
        <button type="button" onClick={() => logRuns(1)}>
          Log 1 run
        </button>
        <button type="button" onClick={() => logRuns(5)}>
          Log 5 runs
        </button>
        <button type="button" onClick={() => logRuns(20)}>
          Log 20 runs
        </button>
        <button type="button" onClick={placeAllPending}>
          Auto place all
        </button>
        <button type="button" onClick={() => onChange(resetAppState())}>
          Reset data
        </button>
      </div>
    </div>
  );
}
