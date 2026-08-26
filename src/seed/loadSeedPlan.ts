import rawSeedPlan from "../../seed/stack-training-plan-2026.json";
import { backfillPlan } from "../domain/racePlan.js";
import type { TrainingPlan } from "../domain/types.js";

/**
 * Loads the bundled 2026 training plan. This is the only source used to
 * populate a fresh AppState and to restore state after a plan reset.
 *
 * The bundled JSON predates #179's `revision`/`originalPlan`/`race.goal`, so
 * it is backfilled exactly like any other pre-#179 stored plan rather than
 * hand-maintaining those fields (`originalPlan` in particular would mean
 * duplicating this whole file inside itself) in the seed data.
 */
export function loadSeedPlan(): TrainingPlan {
  const plan = rawSeedPlan as TrainingPlan;
  if (plan.schemaVersion !== 1) {
    throw new Error(
      `Unsupported seed plan schemaVersion: ${String(plan.schemaVersion)}`,
    );
  }
  return backfillPlan(plan);
}
