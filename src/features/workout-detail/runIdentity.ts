import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import type { RunActivityType, Workout } from "../../domain/types.js";
import type { RunLog } from "../../domain/types.js";
import { runnerRunActivityKind, type RunnerRun } from "../../history/runnerRun.js";

/**
 * Where a run's title came from. Kept on the identity rather than inferred from
 * the string, because the three cases are genuinely different claims:
 *
 * - `planned-workout` — the title of the scheduled workout this run is linked
 *   to, when that title is a name rather than a restatement of the type and
 *   distance. `Yasso 800s` identifies a run; `Easy 3 mi` does not say anything
 *   the classification and the plan line below it do not.
 * - `classification` — what STACK holds this activity *was*: its activity type,
 *   in the voice of a title. The normal case for a run STACK owns.
 * - `source-activity` — the source's own name for the activity. Used only where
 *   STACK owns no description of its own, which in practice means a historical
 *   run nobody has ever classified.
 *
 * The order matters, and it is deliberately not "the longest string wins". A
 * name like `Winter Park - W1 Run 1 — Easy 3mi` is how a *watch* files a run;
 * making it the heading of a STACK run buries what the run was under how it was
 * recorded. For an owned run that name belongs with the rest of the source's
 * bookkeeping, behind the run-options control.
 *
 * There is no fourth case. A run with no plan link, no classification and no
 * source name does not get an invented one.
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
  /**
   * The source's own name for the activity, whether or not it is the title.
   * Run Detail states it under source information behind `…`, so it is never
   * lost — only demoted.
   */
  sourceName: string | null;
  /**
   * The activity type to draw the run's mark from, or null for a run nobody has
   * classified. A historical-only row has no STACK classification, so it gets
   * no mark rather than a guessed one.
   */
  activityType: RunActivityType | null;
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
 * Whether a workout's title names the run, or merely restates its type and
 * distance.
 *
 * `Easy 3 mi`, `2 Miles`, `Long 8` and `Intervals` all describe a workout in
 * the same terms the classification and the plan line already use, so promoting
 * them to the heading says nothing twice. `Yasso 800s`, `Boston Tune-Up` and
 * `Hill Repeats — Summit Ave` are names, and a runner who linked a run to one
 * of them thinks of the run as that.
 *
 * The test is subtraction: strip the activity-type words, the numbers, the
 * distance units and the punctuation, and see whether anything is left.
 */
export function isDistinctWorkoutName(title: string, activityType: RunActivityType): boolean {
  const typeWords = new Set([
    ...WORKOUT_TYPE_LABEL[activityType].toLowerCase().split(/\s+/),
    "run",
    "runs",
    "workout",
    "session",
  ]);
  const remaining = title
    .toLowerCase()
    .replace(/[\d.]+/g, " ")
    .replace(/\b(mi|mile|miles|k|km|kms|m|min|mins|minutes|x)\b/g, " ")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 0 && !typeWords.has(word));
  return remaining.length > 0;
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

/**
 * The activity-type chip.
 *
 * Always present on an owned run, even when the title is the classification
 * itself. The chip is not a repetition of the heading: it is the colour that
 * identifies the kind of running at a glance, in the same place on every run,
 * and it sits beside the Plan/Extra chip that answers the other question.
 */
function typeChip(activityType: RunActivityType): RunIdentityChip[] {
  return [{ id: "type", label: WORKOUT_TYPE_LABEL[activityType], tone: activityType }];
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
  const namedWorkout = workoutTitle && isDistinctWorkoutName(workoutTitle, runLog.activityType)
    ? workoutTitle
    : null;
  const titleSource: RunIdentityTitleSource = namedWorkout ? "planned-workout" : "classification";
  const title = namedWorkout ?? CLASSIFICATION_TITLE[runLog.activityType];

  return {
    title,
    titleSource,
    sourceName,
    activityType: runLog.activityType,
    date: runLog.completedDate,
    startTimeLabel: formatStartTime(mirror?.startTimeLocal ?? null),
    /**
     * The plan context, minus whatever the heading already said. A run titled
     * with its workout does not need `Week 3 · Yasso 800s` under a heading
     * reading `Yasso 800s`; it needs to know which week that was.
     */
    planLine: workout
      ? titleSource === "planned-workout"
        ? `Week ${workout.weekNumber}`
        : `Week ${workout.weekNumber} · ${workout.title}`
      : null,
    chips: [
      ...typeChip(runLog.activityType),
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
 * This is where a source activity name legitimately leads: nobody has
 * classified this run, so the source's own name for it is the best identity
 * that exists. The rule that makes it safe is subtraction: a historical-only
 * run gets its source's name and start time and nothing else. No plan line, because it is
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
    sourceName,
    activityType: null,
    date: run.date,
    startTimeLabel: formatStartTime(run.startTimeLocal),
    planLine: null,
    chips: [{ id: "status", label: "History", tone: "history" }],
  };
}
