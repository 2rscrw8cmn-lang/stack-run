import { useState } from "react";
import { earnedBlocks, scheduledRuns } from "../domain/build";
import { autoPlaceOption, placementOptions } from "../domain/placement";
import type { AppState, Effort, RunActivityType, Workout } from "../domain/types";
import {
  placeBlock,
  resetAppState,
  saveRunLog,
} from "../storage/appStateRepository";

/*
 * The panel's own styles travel inside it rather than in the design system.
 * A CSS import is an unconditional side effect, so stylesheet rules for a
 * dev-only component would ship in the production bundle even once the
 * component itself is gated out; carrying them here means D-025 removes the
 * panel and its styling together.
 */
const PANEL_STYLES = `
.dev-panel__toggle {
  position: fixed;
  bottom: calc(72px + env(safe-area-inset-bottom));
  left: var(--space-3);
  z-index: 10;
  min-width: 56px;
  min-height: 44px;
  padding: 0 var(--space-3);
  border: 1px solid var(--accent);
  border-radius: var(--radius-sm);
  background: color-mix(in srgb, var(--accent) 18%, var(--surface-strong));
  color: var(--accent);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  cursor: pointer;
}

.dev-panel {
  position: fixed;
  bottom: calc(72px + env(safe-area-inset-bottom));
  left: var(--space-2);
  z-index: 10;
  width: min(260px, calc(100vw - 2 * var(--space-2)));
  padding: var(--space-3);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  background: var(--bg-elevated);
  font-size: 12px;
}

.dev-panel__header {
  display: flex;
  justify-content: space-between;
  margin-bottom: var(--space-2);
  color: var(--text-subtle);
}

.dev-panel__header button {
  border: none;
  background: none;
  color: var(--text-subtle);
  cursor: pointer;
}

.dev-panel__status {
  margin: 0 0 var(--space-2);
  color: var(--text-muted);
}

.dev-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-1);
}

.dev-panel__actions button {
  min-height: 36px;
  padding: 0 var(--space-3);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  background: var(--surface);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}

.dev-panel__header button {
  min-height: 32px;
  padding: 0 var(--space-2);
}

/* Legend */
`;

interface DevDataPanelProps {
  state: AppState;
  onChange: (next: AppState) => void;
}

/** Midpoint of a target like "4-5". */
function targetMilesOf(workout: Workout): number {
  const parts = (workout.targetDistanceMiles ?? "")
    .split("-")
    .map((part) => Number.parseFloat(part))
    .filter((value) => Number.isFinite(value));
  return parts.length === 0
    ? 3
    : parts.reduce((sum, value) => sum + value, 0) / parts.length;
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
  activityType: RunActivityType;
  distanceMiles: number;
  durationSeconds: number;
  effort: Effort;
} {
  const target = targetMilesOf(workout);
  // Most runs land near target; a few over- or undershoot.
  const distanceMiles =
    Math.round((target * (0.9 + seeded(workout.id, 1) * 0.3)) * 10) / 10;
  const pace = (BASE_PACE[workout.type] ?? 10) * (0.9 + seeded(workout.id, 2) * 0.2);
  const roll = seeded(workout.id, 3);
  const effort: Effort = roll < 0.2 ? "rough" : roll < 0.75 ? "solid" : "great";

  return {
    workoutId: workout.id,
    completedDate: workout.date,
    activityType: workout.type === "rest" ? "easy" : workout.type,
    distanceMiles: Math.max(0.1, distanceMiles),
    durationSeconds: Math.round(distanceMiles * pace * 60),
    effort,
  };
}

/**
 * Bulk shortcuts for exercising the tower by hand: logging twenty runs one
 * form at a time to see how a tall tower behaves is not a good use of anyone's
 * afternoon.
 *
 * Everything here goes through the normal repository functions, so it
 * exercises the same validation and persistence the real UI does.
 *
 * This is scaffolding, not product, and per D-025 it never reaches a build
 * anyone reviews the product in: `App` renders it only under
 * `import.meta.env.DEV`, so it is absent from every production bundle.
 */
export function DevDataPanel({ state, onChange }: DevDataPanelProps) {
  const [isOpen, setOpen] = useState(false);

  const loggedWorkoutIds = new Set(
    state.runLogs.map((runLog) => runLog.workoutId),
  );
  const nextUnlogged = scheduledRuns(state.plan).filter(
    (workout) => !loggedWorkoutIds.has(workout.id),
  );
  const placedRunLogIds = new Set(
    state.blockPlacements.map((placement) => placement.runLogId),
  );
  const pending = earnedBlocks(state.plan, state.runLogs).filter(
    (block) => !placedRunLogIds.has(block.runLog.id),
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
      const { width, height } = block.footprint;
      const option = autoPlaceOption(
        placementOptions(width, height, next.blockPlacements),
      );
      if (!option) {
        continue;
      }
      next = placeBlock(next, {
        runLogId: block.runLog.id,
        row: option.row,
        columnStart: option.columnStart,
        width,
        height,
      });
    }
    onChange(next);
  }

  if (!isOpen) {
    return (
      <>
        <style>{PANEL_STYLES}</style>
        <button
          type="button"
          className="dev-panel__toggle"
          onClick={() => setOpen(true)}
        >
          DEV
        </button>
      </>
    );
  }

  return (
    <div className="dev-panel">
      <style>{PANEL_STYLES}</style>
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
