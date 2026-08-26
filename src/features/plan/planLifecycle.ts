import { formatDateLabel, isAfterLocalDate, isBeforeLocalDate } from "../../domain/dates.js";
import type { TrainingPlan } from "../../domain/types.js";

/**
 * Where the runner is relative to the plan's own window.
 *
 * The plan is a fixed race-specific structure, so it has a beginning and an
 * end that the runner passes through. Plan should say which of those it is
 * showing rather than presenting every week as if training were underway.
 */
export type PlanLifecycle = "before-plan" | "active" | "after-race";

export interface PlanLifecycleNote {
  lifecycle: "before-plan" | "after-race";
  /** The lifecycle fact, stated once and without judgment. */
  headline: string;
  /** What that fact means for the weeks below it. */
  detail: string;
}

export function planLifecycle(
  plan: TrainingPlan,
  today: string,
): PlanLifecycle {
  if (isBeforeLocalDate(today, plan.startDate)) return "before-plan";
  if (isAfterLocalDate(today, plan.race.date)) return "after-race";
  return "active";
}

/**
 * The one quiet line Plan says about its own lifecycle, or nothing at all
 * while training is underway.
 *
 * Neither state is a verdict on the runner. Before the start date the weeks
 * are a preview of what the plan will ask for; after race day they are the
 * record of what it asked for. A week that was never trained is not late, and
 * a finished plan is not a failure — so this copy says only where the plan is
 * and never how the runner did.
 */
export function planLifecycleNote(
  plan: TrainingPlan,
  today: string,
): PlanLifecycleNote | null {
  const lifecycle = planLifecycle(plan, today);
  const compact = { month: "short", day: "numeric" } as const;

  if (lifecycle === "before-plan") {
    return {
      lifecycle,
      headline: `Plan starts ${formatDateLabel(plan.startDate, compact)}`,
      detail:
        "Training has not started yet. These weeks are a preview of what the plan will ask for.",
    };
  }

  if (lifecycle === "after-race") {
    return {
      lifecycle,
      headline: "Plan complete",
      detail: `${plan.race.name} · ${formatDateLabel(plan.race.date, compact)}. These weeks stay as the structure this race was built on.`,
    };
  }

  return null;
}

/**
 * What the week shortcut means in each lifecycle. Outside the training window
 * there is no current week, so the shortcut returns to the week Plan opens on
 * rather than claiming one of them is happening now.
 */
export const ANCHOR_WEEK_LABEL: Record<PlanLifecycle, string> = {
  "before-plan": "First Week",
  active: "Current Week",
  "after-race": "Final Week",
};
