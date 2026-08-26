import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlanAdjustmentOperation } from "../domain/planAdjustment.js";
import type { PlanAdjustmentRecord } from "../domain/planProvenance.js";
import type { Workout } from "../domain/types.js";

/**
 * The signed-in browser's own read of #180's audit ledger (`plan_adjustments`)
 * — a plain authenticated query, not the token-based RPC path #178/#181 use
 * for an external assistant. RLS already scopes this to the runner's own
 * rows (`user_id = auth.uid()`), so no security-definer function is needed
 * here at all. See #182, `docs/PLAN_ADJUSTMENTS.md`.
 */

type Row = Record<string, unknown>;

function rows(value: unknown): Row[] {
  return Array.isArray(value) ? (value.filter((item) => item && typeof item === "object") as Row[]) : [];
}

function record(value: unknown): Row | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Row) : null;
}

function isWorkout(value: unknown): value is Workout {
  const row = record(value);
  return Boolean(
    row &&
    typeof row.id === "string" &&
    typeof row.date === "string" &&
    typeof row.type === "string" &&
    typeof row.title === "string" &&
    (row.targetDistanceMiles === null || typeof row.targetDistanceMiles === "string") &&
    typeof row.details === "string",
  );
}

function isOperation(value: unknown): value is PlanAdjustmentOperation {
  const row = record(value);
  if (!row || typeof row.workoutId !== "string") return false;
  switch (row.op) {
    case "move":
      return typeof row.toDate === "string";
    case "editRun":
    case "addRun":
      return record(row.values) !== null;
    case "skip":
      return true;
    default:
      return false;
  }
}

/** Untrusted network JSON in, an explicit allowlist out — the same discipline every other cloud-row parser in this codebase uses. */
function parseAdjustmentRow(value: unknown): PlanAdjustmentRecord | null {
  const row = record(value);
  if (!row || typeof row.id !== "string") return null;
  const operations = Array.isArray(row.operations) ? row.operations : null;
  const beforeWorkouts = Array.isArray(row.before_workouts) ? row.before_workouts : null;
  if (
    !operations || !operations.every(isOperation) ||
    !beforeWorkouts || !beforeWorkouts.every(isWorkout) ||
    typeof row.resulting_plan_revision !== "number" ||
    typeof row.created_at !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    operations: operations as PlanAdjustmentOperation[],
    reason: typeof row.reason === "string" ? row.reason : null,
    beforeWorkouts: beforeWorkouts as Workout[],
    resultingPlanRevision: row.resulting_plan_revision,
    createdAt: row.created_at,
  };
}

/**
 * Recent unreverted adjustments the runner's own plan has received. Filtered
 * to `kind = 'apply'` and `reverted_at is null` at the query level — a scan-
 * size optimization, not a correctness dependency: an already-reverted row's
 * fields can never match `deriveWorkoutProvenance`'s check anyway.
 */
export async function listRecentPlanAdjustments(
  client: SupabaseClient,
): Promise<PlanAdjustmentRecord[]> {
  const result = await client
    .from("plan_adjustments")
    .select("id,operations,reason,before_workouts,resulting_plan_revision,created_at")
    .eq("kind", "apply")
    .is("reverted_at", null)
    .order("created_at", { ascending: false })
    .limit(50);
  if (result.error) throw new Error(result.error.message);
  return rows(result.data)
    .map(parseAdjustmentRow)
    .filter((record): record is PlanAdjustmentRecord => record !== null);
}
