import { WORKOUT_TYPE_LABEL } from "./build.js";
import { formatDateLabel } from "./dates.js";
import type { PlanAdjustmentOperation } from "./planAdjustment.js";
import type { Workout } from "./types.js";

/**
 * One row of #180's audit ledger (`plan_adjustments`), as the signed-in
 * browser reads it directly (RLS, no token) via
 * `src/crew/planAdjustmentService.ts`. Narrower than the raw table: only
 * unreverted `apply` rows are ever loaded, since only those can ever
 * describe the plan's current shape.
 */
export interface PlanAdjustmentRecord {
  id: string;
  operations: readonly PlanAdjustmentOperation[];
  reason: string | null;
  beforeWorkouts: readonly Workout[];
  resultingPlanRevision: number;
  createdAt: string;
}

/**
 * What #182's sparkle needs to know about one currently-assistant-set
 * workout: what it looked like before, which operation produced its current
 * value, and enough about the adjustment to show "changed at" / an optional
 * reason / offer Undo.
 */
export interface WorkoutProvenance {
  adjustmentId: string;
  before: Workout;
  operation: PlanAdjustmentOperation;
  reason: string | null;
  changedAt: string;
  resultingPlanRevision: number;
}

/** Whether `workout`'s current fields are exactly what `operation` implies. */
function operationMatchesCurrent(workout: Workout, operation: PlanAdjustmentOperation): boolean {
  switch (operation.op) {
    case "move":
      return workout.date === operation.toDate;
    case "editRun":
    case "addRun":
      return (
        workout.type === operation.values.type &&
        workout.title === operation.values.title &&
        workout.targetDistanceMiles === operation.values.targetDistanceMiles &&
        workout.details === operation.values.details
      );
    case "skip":
      return workout.type === "rest";
  }
}

/** The last operation in this record naming `workoutId` — later wins within one batch. */
function lastOperationFor(
  record: PlanAdjustmentRecord,
  workoutId: string,
): PlanAdjustmentOperation | null {
  for (let i = record.operations.length - 1; i >= 0; i--) {
    const operation = record.operations[i]!;
    if (operation.workoutId === workoutId) return operation;
  }
  return null;
}

/**
 * The provenance a workout should currently show, if any.
 *
 * "Currently" is the whole point: this never trusts the ledger's say-so on
 * its own. It only reports provenance for the most recent unreverted apply
 * whose implied result the workout's live fields still exactly match — a
 * manual edit, an in-app undo (`restoreWorkout` in `planEdit.ts`), or any
 * later change to this specific workout makes the comparison fail and the
 * sparkle disappears with it, with nothing tracked as a separate flag. This
 * is what the issue's "derive visible provenance from the latest effective
 * change" acceptance criterion asks for.
 */
export function deriveWorkoutProvenance(
  workout: Workout,
  adjustments: readonly PlanAdjustmentRecord[],
): WorkoutProvenance | null {
  const candidates = [...adjustments].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  for (const record of candidates) {
    const operation = lastOperationFor(record, workout.id);
    if (!operation) continue;
    if (!operationMatchesCurrent(workout, operation)) continue;
    const before = record.beforeWorkouts.find((candidate) => candidate.id === workout.id);
    if (!before) continue;
    return {
      adjustmentId: record.id,
      before,
      operation,
      reason: record.reason,
      changedAt: record.createdAt,
      resultingPlanRevision: record.resultingPlanRevision,
    };
  }
  return null;
}

/**
 * Whether Undo should be offered — the same precondition #180's SQL already
 * enforces for a token-based undo (`_plan_patch_swap`'s revision check),
 * applied locally: nothing else may have changed the plan since this
 * adjustment landed. "Manual/current state wins" falls out of this exactly
 * the way it does server-side — no separate conflict logic.
 */
/**
 * What a sparkle call site needs, bundled into one optional prop so a
 * workout with nothing to show passes `null` rather than three separate
 * optional props. Shared by `WorkoutRow` (Plan) and `NextWorkoutCard`
 * (Today) — the two places #182's badge can legitimately appear.
 */
export interface WorkoutProvenanceSlot {
  value: WorkoutProvenance;
  canUndo: boolean;
  onUndo: () => void;
}

export function canUndoProvenance(
  provenance: WorkoutProvenance,
  currentPlanRevision: number,
): boolean {
  return provenance.resultingPlanRevision === currentPlanRevision;
}

function shortDate(date: string): string {
  return formatDateLabel(date, { month: "short", day: "numeric" });
}

function distancePhrase(targetDistanceMiles: string | null): string {
  return targetDistanceMiles ? `${targetDistanceMiles} mi` : "No target";
}

/**
 * A compact, plain-language description of what changed — one to a few
 * short lines, never a full diff dump. Only the fields that actually
 * differ between `provenance.before` and `current` are mentioned.
 */
export function describeProvenanceChange(
  provenance: WorkoutProvenance,
  current: Workout,
): string[] {
  const { before, operation } = provenance;
  switch (operation.op) {
    case "move":
      return [`Moved from ${shortDate(before.date)} to ${shortDate(current.date)}`];
    case "skip":
      return [`Changed from ${WORKOUT_TYPE_LABEL[before.type]} to a rest day`];
    case "addRun":
      return [`Added as ${WORKOUT_TYPE_LABEL[current.type]} · ${distancePhrase(current.targetDistanceMiles)}`];
    case "editRun": {
      const lines: string[] = [];
      if (before.type !== current.type) {
        lines.push(`Type: ${WORKOUT_TYPE_LABEL[before.type]} → ${WORKOUT_TYPE_LABEL[current.type]}`);
      }
      if (before.targetDistanceMiles !== current.targetDistanceMiles) {
        lines.push(`Distance: ${distancePhrase(before.targetDistanceMiles)} → ${distancePhrase(current.targetDistanceMiles)}`);
      }
      if (before.title !== current.title) {
        lines.push(`Title: ${before.title} → ${current.title}`);
      }
      return lines.length > 0 ? lines : ["Workout details updated"];
    }
  }
}
