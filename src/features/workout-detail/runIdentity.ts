import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import type { RunActivityType, Workout } from "../../domain/types.js";
import type { RunLog } from "../../domain/types.js";
import { runnerRunActivityKind, type RunnerRun } from "../../history/runnerRun.js";

/**
 * Where a run's title came from. Kept on the identity rather than inferred from
 * the string, because the three cases are genuinely different claims:
 *
 * - `source-activity` — the source's own name for the activity. The strongest
 *   identity STACK can state, and the only one that is the run's actual *name*.
 * - `planned-workout` — the title of the scheduled workout this run is linked
 *   to. A real STACK fact about intent, stated as identity because a runner who
 *   linked a run to `Easy 3 mi` thinks of it as that run.
 * - `classification` — what STACK holds this activity *was*: its activity type.
 *   Not a name, and never presented as one.
 *
 * There is no fourth case. A run with no source name, no plan link and no
 * classification does not get an invented one.
 */
export type RunIdentityTitleSource = "source-activity" | "planned-workout" | "classification";

export interface RunIdentityChip {
  id: string;
  label: string;
  /** Activity type for a type chip, or the run's status. Drives the chip colour. */
  tone: string;
}

export interface RunIdentity {
  title: string;
  titleSource: RunIdentityTitleSource;
  /** Local calendar date, `YYYY-MM-DD`. */
  date: string;
  /** `7:12 AM` when the source stated a local start, else null. */
  startTimeLabel: string | null;
  /** `Week 3 · Easy 3 mi`, only when this run really is linked to that workout. */
  planLine: string | null;
  chips: RunIdentityChip[];
}

/**
 * What STACK calls each kind of activity when it is standing in for a name.
 *
 * Deliberately not `WORKOUT_TYPE_LABEL` verbatim: "Easy" and "Long Run" are
 * fine as chips beside a heading but read as fragments when they *are* the
 * heading. These say the same thing in the voice of a title, and say nothing
 * the classification does not already claim.
 */
const CLASSIFICATION_TITLE: Record<RunActivityType, string> = {
  easy: "Easy Run",
  long: "Long Run",
  intervals: "Intervals",
  simulation: "Simulation",
  race: "Race",
  cross: "Cross Training",
};

function trimmed(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/**
 * `7:12 AM` from a local `YYYY-MM-DDTHH:MM:SS` start.
 *
 * Formatted here rather than through `toLocaleTimeString` because the stored
 * value is already local wall-clock: handing it to a Date would re-interpret it
 * in the device's own zone and move a 6am run in another timezone by hours.
 */
export function formatStartTime(startTimeLocal: string | null): string | null {
  const match = /T(\d{2}):(\d{2})/.exec(startTimeLocal ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = match[2];
  if (!Number.isFinite(hours) || hours > 23) return null;
  const suffix = hours < 12 ? "AM" : "PM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;
  return `${twelve}:${minutes} ${suffix}`;
}

function typeChip(activityType: RunActivityType, titleSource: RunIdentityTitleSource): RunIdentityChip[] {
  // A title that already *is* the classification should not be echoed by a chip
  // saying the same word again.
  return titleSource === "classification"
    ? []
    : [{ id: "type", label: WORKOUT_TYPE_LABEL[activityType], tone: activityType }];
}

/**
 * The identity of a run STACK owns.
 *
 * `mirror` is the same physical run as seen in the connected history, when
 * STACK holds one. It is where a truthful activity name and start time live: a
 * `RunLog` has no field for either, and rather than adding one — which would
 * mean a stored copy that can go stale against the source — Run Detail reads
 * them from the reconciled history row the product already builds. When there
 * is no mirror, the two facts are simply absent.
 */
export function runIdentityFromRunLog(
  runLog: RunLog,
  workout: Workout | null,
  mirror: RunnerRun | null,
): RunIdentity {
  const sourceName = trimmed(mirror?.sourceName);
  const workoutTitle = trimmed(workout?.title);
  const titleSource: RunIdentityTitleSource = sourceName
    ? "source-activity"
    : workoutTitle
      ? "planned-workout"
      : "classification";
  const title = sourceName ?? workoutTitle ?? CLASSIFICATION_TITLE[runLog.activityType];

  return {
    title,
    titleSource,
    date: runLog.completedDate,
    startTimeLabel: formatStartTime(mirror?.startTimeLocal ?? null),
    /**
     * The plan context, minus whatever the heading already said. A run titled
     * with its workout does not need `Week 1 · 2 Miles` under a heading reading
     * `2 Miles`; it needs to know which week that was.
     */
    planLine: workout
      ? titleSource === "planned-workout"
        ? `Week ${workout.weekNumber}`
        : `Week ${workout.weekNumber} · ${workout.title}`
      : null,
    chips: [
      ...typeChip(runLog.activityType, titleSource),
      {
        id: "status",
        label: workout ? "Plan" : "Extra",
        tone: workout ? "plan" : "extra",
      },
    ],
  };
}

/**
 * The identity of a run STACK does not own.
 *
 * The rule that makes this safe is subtraction: a historical-only run gets its
 * source's name and start time and nothing else. No plan line, because it is
 * linked to nothing; no activity-type chip, because nobody has classified it;
 * and where the source stated no name, the title falls back to what the source
 * type verifiably is — a run, or a cross-training session — rather than to a
 * workout title STACK would have had to invent.
 */
export function runIdentityFromRunnerRun(run: RunnerRun): RunIdentity {
  const sourceName = trimmed(run.sourceName);
  const kind = runnerRunActivityKind(run);
  return {
    title: sourceName ?? (kind === "cross-training" ? "Cross Training" : "Run"),
    titleSource: sourceName ? "source-activity" : "classification",
    date: run.date,
    startTimeLabel: formatStartTime(run.startTimeLocal),
    planLine: null,
    chips: [{ id: "status", label: "History", tone: "history" }],
  };
}
