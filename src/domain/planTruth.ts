import type {
  AppState,
  PlanBaselineOrigin,
  RaceGoal,
  TrainingPlan,
} from "./types";

export const NO_RACE_GOAL: RaceGoal = { type: "none" };

export function isRaceGoal(value: unknown): value is RaceGoal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const keys = Object.keys(candidate);
  if (candidate.type === "none" || candidate.type === "finish") {
    return keys.length === 1;
  }
  if (candidate.type === "target-finish-time") {
    return keys.length === 2 && positiveInteger(candidate.targetSeconds);
  }
  if (candidate.type === "target-pace") {
    return keys.length === 2 && positiveInteger(candidate.secondsPerMile);
  }
  return false;
}

export function isPlanBaselineOrigin(value: unknown): value is PlanBaselineOrigin {
  return value === "created" || value === "adopted-current";
}

export function isPlanRevision(value: unknown): value is number {
  return positiveInteger(value);
}

export function currentPlanWithRevision(
  state: AppState,
  plan: TrainingPlan,
): AppState {
  if (!state.plan || !state.planBaseline || !isPlanRevision(state.planRevision)) {
    throw new Error("An active plan must have baseline and revision truth.");
  }
  if (state.plan.id !== plan.id || state.planBaseline.id !== plan.id) {
    throw new Error("A plan edit cannot replace the active plan identity.");
  }
  return { ...state, plan, planRevision: state.planRevision + 1 };
}

function positiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
