import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import type { Workout } from "../../domain/types";

/**
 * What the Today Action Card says about a workout, once the repetition is out.
 *
 * The plan states the same fact up to three times: `long` / `Long Run: 4-5
 * Miles` / `4-5`. The card names the type once in its eyebrow and the target
 * once as its value, so the title only earns a line when it carries something
 * neither of those already said — a race's name, a simulation's shape.
 */
export interface TodayActionReading {
  /** The card's headline value: the target distance, or the title behind it. */
  value: string;
  /** Whatever the title says that the type and the target do not. */
  caption: string | null;
}

/** `4-5 Miles`, `4-5 mi` and `4-5` are the same claim about the same run. */
function distanceKey(text: string): string {
  return text
    .replace(/\b(miles|mile|mi)\b/gi, "")
    .replace(/[\s.]/g, "")
    .toLowerCase();
}

function escapeForRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Drops the type label from either end of the title: the eyebrow has it. */
function withoutTypeLabel(title: string, typeLabel: string): string {
  const label = escapeForRegExp(typeLabel);
  return title
    .replace(new RegExp(`^${label}\\b[\\s:\u2013\u2014-]*`, "i"), "")
    .replace(new RegExp(`[\\s:\u2013\u2014-]*\\b${label}$`, "i"), "")
    .trim();
}

export function todayActionReading(workout: Workout): TodayActionReading {
  const title = workout.title.trim();
  const rest = withoutTypeLabel(title, WORKOUT_TYPE_LABEL[workout.type]);
  const target = workout.targetDistanceMiles;

  // A workout with no target distance has nothing else to lead with.
  if (!target) return { value: rest || title, caption: null };
  if (!rest || distanceKey(rest) === distanceKey(target)) {
    return { value: `${target} mi`, caption: null };
  }
  return { value: `${target} mi`, caption: rest };
}
