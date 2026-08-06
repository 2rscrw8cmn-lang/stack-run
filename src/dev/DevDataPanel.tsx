import { useState } from "react";
import { earnedBlocks, scheduledRuns, spanForWorkout } from "../domain/build";
import { autoPlaceOption, placementOptions } from "../domain/placement";
import type { AppState, Effort, Workout } from "../domain/types";
import {
  placeBlock,
  resetAppState,
  saveRunLog,
} from "../storage/appStateRepository";
import { FootprintPreview } from "./FootprintPreview";
import { targetMiles } from "./footprintPreview";

interface DevDataPanelProps {
  state: AppState;
  onChange: (next: AppState) => void;
}

/** Stable per-workout jitter in [0, 1), so the same plan always fakes alike. */
function seeded(id: string, salt: number): number {
  let hash = salt * 2654435761;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash ^ id.charCodeAt(index)) * 16777619;
    hash >>>= 0;
  }
  return (hash % 1000) / 1000;
}

/** Median minutes per mile by type, before jitter. */
const BASE_PACE: Record<string, number> = {
  easy: 10.5,
  long: 10,
  intervals: 8,
  simulation: 9,
  race: 8.5,
};

/**
 * A plausible run rather than a placeholder one. The old version logged the
 * low end of every target range at a flat 9 min/mi with effort "solid", which
 * made every generated run identical — no way to see distance, pace, or effort
 * do anything, which is precisely what needs looking at.
 */
function syntheticRun(workout: Workout): {
  workoutId: string;
  completedDate: string;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
} {
  const target = targetMiles(workout);
  // Most runs land near target; a few over- or undershoot.
  const distanceMiles =
    Math.round((target * (0.9 + seeded(workout.id, 1) * 0.3)) * 10) / 10;
  const pace = (BASE_PACE[workout.type] ?? 10) * (0.9 + seeded(workout.id, 2) * 0.2);
  const roll = seeded(workout.id, 3);
  const effort: Effort = roll < 0.2 ? "rough" : roll < 0.75 ? "solid" : "great";

  return {
    workoutId: workout.id,
    completedDate: workout.date,
    distanceMiles: Math.max(0.1, distanceMiles),
    durationSeconds: Math.round(distanceMiles * pace * 60),
    effort,
  };
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
  const [isPreviewing, setPreviewing] = useState(false);

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
      next = saveRunLog(next, { ...syntheticRun(workout), notes: "" });
    }
    onChange(next);
  }

  function placeAllPending() {
    let next = state;
    for (const block of pending) {
      const span = spanForWorkout(block.workout);
      const weekNumber = block.workout.weekNumber;
      const option = autoPlaceOption(
        placementOptions(span, weekNumber, next.blockPlacements),
      );
      if (!option) {
        continue;
      }
      next = placeBlock(next, {
        workoutId: block.workout.id,
        weekNumber,
        row: option.row,
        columnStart: option.columnStart,
        span,
      });
    }
    onChange(next);
  }

  if (isPreviewing) {
    return (
      <FootprintPreview state={state} onClose={() => setPreviewing(false)} />
    );
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
        <button type="button" onClick={() => setPreviewing(true)}>
          Footprint preview
        </button>
        <button type="button" onClick={() => onChange(resetAppState())}>
          Reset data
        </button>
      </div>
    </div>
  );
}
