import rawSeedPlan from "../../seed/stack-training-plan-2026.json";
import type { TrainingPlan } from "../domain/types";

/**
 * Loads the bundled 2026 training plan. This is the only source used to
 * populate a fresh AppState and to restore state after a plan reset.
 */
export function loadSeedPlan(): TrainingPlan {
  const plan = rawSeedPlan as TrainingPlan;
  if (plan.schemaVersion !== 1) {
    throw new Error(
      `Unsupported seed plan schemaVersion: ${String(plan.schemaVersion)}`,
    );
  }
  return plan;
}
