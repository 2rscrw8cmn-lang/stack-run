import { ArrowLeft, CalendarDays, CalendarPlus, History } from "lucide-react";
import { useState } from "react";
import {
  blockedDates,
  findAvailabilityConflicts,
  type AvailabilityCalendar,
} from "../../domain/availability";
import { earnedBlockPhrase } from "../../domain/build";
import {
  formatDateLabel,
  isBeforeLocalDate,
  todayLocalDate,
} from "../../domain/dates";
import {
  clampWeekNumber,
  currentWeekNumber,
  PLAN_DAY_STATUS_LABEL,
  selectPlanWeekViewModel,
} from "../../domain/plan";
import {
  addPlannedRun,
  changeToRest,
  editPlannedRun,
  findWorkout,
  isRaceWorkout,
  moveWorkout,
  PlanEditError,
  type PlannedRunValues,
} from "../../domain/planEdit";
import type { RacePlanSetup } from "../../domain/racePlan";
import type { Weekday } from "../../domain/runDays";
import type {
  ArchivedTrainingPlan,
  RunLog,
  TrainingPlan,
  Workout,
} from "../../domain/types";
import { Button } from "../../components/ui/Button";
import type { IntervalsConnection } from "../../connected/intervals";
import { unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun";
import { ConflictReviewSheet } from "../availability/ConflictReviewSheet";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { WorkoutDetailSheet } from "../workout-detail/WorkoutDetailSheet";
import { EditWorkoutSheet } from "./EditWorkoutSheet";
import { MoveWorkoutSheet } from "./MoveWorkoutSheet";
import { planLifecycle, planLifecycleNote } from "./planLifecycle";
import { PlanLifecycleNote } from "./PlanLifecycleNote";
import { RaceSetupSheet } from "./RaceSetupSheet";
import {
  planWeekActualContext,
  planWeekIntentContext,
} from "./planWeekContext";
import { WeekLead } from "./WeekLead";
import { WorkoutRow } from "./WorkoutRow";
import "./planNext.css";

interface PlanScreenProps {
  plan: TrainingPlan | null;
  planHistory?: readonly ArchivedTrainingPlan[];
  runLogs: RunLog[];
  /**
   * The runner's unified actual history. Plan reads it for viewed-week context
   * but never links or rewrites it. Falls back to accepted run logs only for a
   * manual-only/caller that has no historical layer.
   */
  runnerRuns?: readonly RunnerRun[];
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
  onSaveRun?: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  onDeleteRun?: (runLogId: string) => void;
  /** Persists an edited plan. The edit rules produce the whole plan. */
  onEditPlan?: (plan: TrainingPlan) => void;
  /**
   * The imported calendar of days the user cannot run. Read-only here: the
   * calendar itself is edited in Settings, and this screen only marks the days
   * it rules out and offers to move the runs that land on them.
   */
  availability?: AvailabilityCalendar | null;
  /**
   * The existing race/plan setup, and the one way to rebuild a plan. Plan owns
   * no plan generation of its own: when the race has passed it opens the same
   * `RaceSetupSheet` Settings opens, with the same inputs and the same result.
   */
  raceSetup?: RacePlanSetup | null;
  runDays?: Weekday[] | null;
  /** The days the runner cross-trains, so a rebuilt plan keeps them. */
  crossTrainingDays?: Weekday[] | null;
  onGeneratePlan?: (setup: RacePlanSetup, plan: TrainingPlan) => void;
  onFinishPlan?: () => void;
  syncToken?: IntervalsConnection | string | null;
}

/**
 * The sheet stacked over the detail sheet. Detail keeps its own state so it can
 * close through the dialog before this one opens, which is what returns focus
 * to the row the user came from.
 */
type Secondary =
  | { kind: "run-entry" | "edit-workout" | "move-workout"; workoutId: string }
  | { kind: "conflicts" }
  | { kind: "race-setup" };

/**
 * The complete editable schedule: one training week at a time, opening on the
 * week that contains today.
 *
 * NEXT-5 keeps Plan as intent. The week still owns editing/moving the schedule
 * and explicit run links, but the factual actual summary now comes from unified
 * runner history. A run may therefore count in `actual` without satisfying any
 * plan item, which is deliberate: actual history says what happened, while an
 * explicit link says how that activity relates to the plan.
 */
export function PlanScreen({
  plan,
  planHistory = [],
  runLogs,
  runnerRuns,
  today = todayLocalDate(),
  onSaveRun = () => undefined,
  onDeleteRun = () => undefined,
  onEditPlan = () => undefined,
  availability = null,
  raceSetup = null,
  runDays = null,
  crossTrainingDays = null,
  onGeneratePlan,
  onFinishPlan,
  syncToken,
}: PlanScreenProps) {
  const [weekNumber, setWeekNumber] = useState(() =>
    plan ? currentWeekNumber(plan, today) : 1,
  );
  const [detailWorkoutId, setDetailWorkoutId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [secondary, setSecondary] = useState<Secondary | null>(null);
  const [isSecondaryOpen, setSecondaryOpen] = useState(false);
  // Bumped whenever a form opens, so it starts from what is saved rather than
  // from whatever the previous visit left in it.
  const [secondaryVisit, setSecondaryVisit] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [historyPlanId, setHistoryPlanId] = useState<string | null>(null);
  const [isSetupOpen, setSetupOpen] = useState(false);

  const archivedPlan = planHistory.find((entry) => entry.id === historyPlanId) ?? null;
  const shownPlan = archivedPlan?.plan ?? plan;
  const isHistorical = archivedPlan !== null;

  if (!shownPlan) {
    return (
      <div className="plan-screen plan-screen--empty">
        <section className="plan-empty">
          <CalendarPlus size={26} strokeWidth={1.6} aria-hidden="true" />
          <h1>No active race plan</h1>
          <p>
            Keep running, logging and building. Set up a race when you want
            scheduled intent alongside your actual history.
          </p>
          {onGeneratePlan && (
            <Button onClick={() => setSetupOpen(true)}>Set Up Next Race</Button>
          )}
        </section>

        {planHistory.length > 0 && (
          <section className="plan-history" aria-labelledby="plan-history-title">
            <h2 id="plan-history-title">
              <History size={15} strokeWidth={1.8} aria-hidden="true" />
              Race plan history
            </h2>
            <ul>
              {planHistory.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setHistoryPlanId(entry.id);
                      setWeekNumber(currentWeekNumber(entry.plan, today));
                    }}
                  >
                    <span>{entry.plan.race.name}</span>
                    <small>
                      {formatDateLabel(entry.plan.race.date)} · {entry.plan.weeks.length} weeks
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {onGeneratePlan && (
          <RaceSetupSheet
            plan={null}
            setup={null}
            runDays={runDays}
            crossTrainingDays={crossTrainingDays}
            runLogs={runLogs}
            today={today}
            isOpen={isSetupOpen}
            onClose={() => setSetupOpen(false)}
            onGenerate={(setup, generated) => {
              onGeneratePlan(setup, generated);
              setSetupOpen(false);
              setHistoryPlanId(null);
            }}
          />
        )}
      </div>
    );
  }
  const viewPlan: TrainingPlan = shownPlan;
  const viewRunLogs = archivedPlan
    ? runLogs.map((run) => ({
        ...run,
        workoutId: archivedPlan.runLinks[run.id] ?? null,
      }))
    : runLogs;

  const week = selectPlanWeekViewModel(viewPlan, viewRunLogs, weekNumber, today);
  const lifecycle = planLifecycle(viewPlan, today);
  const lifecycleNote = planLifecycleNote(viewPlan, today);
  // The week Plan opens on: this week while training runs, otherwise the first
  // or last week of the plan. It is where the shortcut returns to.
  const anchorWeekNumber = currentWeekNumber(viewPlan, today);
  const actualRuns = runnerRuns ?? unifiedRunnerHistory({ runLogs });
  const actual = planWeekActualContext(actualRuns, week.startDate, week.endDate);
  const intent = planWeekIntentContext(week);
  // A future week has no actual story yet. Hide the technically correct zero
  // rather than presenting absence-of-future-data as a runner fact.
  const showActual = !isBeforeLocalDate(today, week.startDate);
  const blocked = blockedDates(availability);
  const conflicts = isHistorical
    ? []
    : findAvailabilityConflicts(viewPlan, availability, viewRunLogs, today);
  const satisfiedWorkoutIds = new Set(
    viewRunLogs.flatMap((runLog) => (runLog.workoutId ? [runLog.workoutId] : [])),
  );

  const detailDay =
    week.days.find((day) => day.workout.id === detailWorkoutId) ?? null;
  const secondaryDay =
    secondary && "workoutId" in secondary
      ? (week.days.find((day) => day.workout.id === secondary.workoutId) ?? null)
      : null;

  /**
   * Moves the screen to a week and closes whatever was open over it.
   *
   * `into` is the plan the week number belongs to, which is the plan on screen
   * except immediately after a rebuild: a week of the new plan has to be
   * clamped against the new plan's own bounds, or a longer plan lands on the
   * old one's last week.
   */
  function goToWeek(next: number, into: TrainingPlan = viewPlan) {
    setDetailOpen(false);
    setDetailWorkoutId(null);
    setSecondaryOpen(false);
    setSecondary(null);
    setWeekNumber(clampWeekNumber(into, next));
  }

  function openDetail(workoutId: string) {
    setDetailWorkoutId(workoutId);
    setDetailOpen(true);
  }

  /** Hands off from the detail sheet, so only one sheet is ever open. */
  function openSecondary(next: Secondary) {
    setDetailOpen(false);
    setSecondary(next);
    setSecondaryVisit((visit) => visit + 1);
    setSecondaryOpen(true);
  }

  function closeSecondary() {
    setSecondaryOpen(false);
    setSecondary(null);
  }

  /**
   * Applies a plan edit, or says why it was refused rather than failing
   * mutely. Reviewing blocked days keeps the sheet open, because the point of
   * that screen is working through several conflicts in one sitting.
   */
  function applyPlanEdit(
    edit: () => TrainingPlan,
    announce: string,
    { close = true }: { close?: boolean } = {},
  ) {
    try {
      onEditPlan(edit());
      setAnnouncement(announce);
      if (close) {
        closeSecondary();
      }
    } catch (error) {
      if (error instanceof PlanEditError) {
        setAnnouncement(error.message);
        return;
      }
      throw error;
    }
  }

  /**
   * A day with a run logged against it can still have its plan edited, but not
   * by accident: the recorded run stays attached to the workout, and moving it
   * moves what that run is counted against.
   */
  function confirmIfCompleted(workoutId: string): boolean {
    if (!satisfiedWorkoutIds.has(workoutId)) {
      return true;
    }
    return window.confirm(
      "You have already logged a run for this day. Changing the plan keeps that run attached to it. Continue?",
    );
  }

  function planActionsFor(workout: Workout, isCompleted: boolean) {
    if (isHistorical) return {};
    if (isRaceWorkout(workout)) {
      return {};
    }
    const guarded = (next: Secondary) => () => {
      if (confirmIfCompleted(workout.id)) {
        openSecondary(next);
      }
    };

    return {
      onEditWorkout: guarded({ kind: "edit-workout", workoutId: workout.id }),
      onMoveWorkout: guarded({ kind: "move-workout", workoutId: workout.id }),
      // A logged run cannot point at a rest day, so this is offered only while
      // the day is still just a plan.
      onChangeToRest: isCompleted
        ? undefined
        : () =>
            applyPlanEdit(
              () => changeToRest(viewPlan, workout.id, satisfiedWorkoutIds),
              `${formatDateLabel(workout.date)} is now a rest day.`,
            ),
    };
  }

  return (
    <div className="plan-screen">
      {isHistorical && (
        <button
          type="button"
          className="plan-history__back"
          onClick={() => setHistoryPlanId(null)}
        >
          <ArrowLeft size={16} strokeWidth={2} aria-hidden="true" />
          Race plan history
        </button>
      )}
      <WeekLead
        week={week}
        totalWeeks={viewPlan.weeks.length}
        lifecycle={lifecycle}
        actual={actual}
        intent={intent}
        showActual={showActual}
        isAnchorWeek={week.weekNumber === anchorWeekNumber}
        onStep={(direction) => goToWeek(week.weekNumber + direction)}
        onAnchorWeek={() => goToWeek(anchorWeekNumber)}
      />

      {lifecycleNote && (
        <PlanLifecycleNote
          note={lifecycleNote}
          onSetUpNextRace={
            !isHistorical && lifecycleNote.lifecycle === "after-race" && onGeneratePlan
              ? () => openSecondary({ kind: "race-setup" })
              : undefined
          }
          onFinishRacePlan={
            !isHistorical && lifecycleNote.lifecycle === "after-race" && onFinishPlan
              ? onFinishPlan
              : undefined
          }
        />
      )}

      {!isHistorical && planHistory.length > 0 && (
        <section className="plan-history" aria-labelledby="plan-history-title">
          <h2 id="plan-history-title">
            <History size={15} strokeWidth={1.8} aria-hidden="true" />
            Race plan history
          </h2>
          <ul>
            {planHistory.map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => {
                    setHistoryPlanId(entry.id);
                    setWeekNumber(currentWeekNumber(entry.plan, today));
                  }}
                >
                  <span>{entry.plan.race.name}</span>
                  <small>
                    {formatDateLabel(entry.plan.race.date)} · {entry.plan.weeks.length} weeks
                  </small>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {conflicts.length > 0 && (
        <button
          type="button"
          className="plan-screen__conflicts"
          onClick={() => openSecondary({ kind: "conflicts" })}
        >
          <CalendarDays size={18} strokeWidth={2} aria-hidden="true" />
          <span>
            {`${conflicts.length} ${conflicts.length === 1 ? "run lands" : "runs land"} on a blocked day`}
          </span>
        </button>
      )}

      <ul className="plan-week" aria-label={`Week ${week.weekNumber} workouts`}>
        {week.days.map((day) => (
          <WorkoutRow
            key={day.workout.id}
            day={day}
            // A rest day is not owed, so a work shift is not in its way.
            // Marking one blocked says a run is at risk when none is asked for.
            blocked={
              day.status === "rest" ? undefined : blocked.get(day.workout.date)
            }
            onSelect={(workoutId) => {
              // A rest day has nothing to read; the only thing to do with one
              // is plan a run on it.
              if (day.status === "rest") {
                openSecondary({ kind: "edit-workout", workoutId });
                return;
              }
              openDetail(workoutId);
            }}
          />
        ))}
      </ul>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {detailDay && detailDay.status !== "rest" && (
        <WorkoutDetailSheet
          workout={detailDay.workout}
          state={detailDay.status}
          statusLabel={PLAN_DAY_STATUS_LABEL[detailDay.status]}
          runLog={detailDay.runLog}
          syncToken={syncToken}
          isOpen={isDetailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailWorkoutId(null);
          }}
          onLogRun={
            !isHistorical && detailDay.canLogRun
              ? () =>
                  openSecondary({
                    kind: "run-entry",
                    workoutId: detailDay.workout.id,
                  })
              : undefined
          }
          onEditRun={
            !isHistorical && detailDay.runLog
              ? () =>
                  openSecondary({
                    kind: "run-entry",
                    workoutId: detailDay.workout.id,
                  })
              : undefined
          }
          {...planActionsFor(detailDay.workout, detailDay.runLog !== null)}
        />
      )}

      {secondary?.kind === "run-entry" && secondaryDay && (
        <CompleteRunSheet
          key={secondaryVisit}
          isOpen={isSecondaryOpen}
          workout={secondaryDay.workout}
          runLog={secondaryDay.runLog ?? undefined}
          today={today}
          onClose={closeSecondary}
          onDelete={
            secondaryDay.runLog
              ? () => {
                  onDeleteRun(secondaryDay.runLog!.id);
                  setAnnouncement("Run deleted.");
                  setSecondaryOpen(false);
                }
              : undefined
          }
          onSave={(workout, values) => {
            const wasLogged = secondaryDay.runLog !== null;
            onSaveRun(workout, values, secondaryDay.runLog?.id);
            const dateLabel = formatDateLabel(values.completedDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            setAnnouncement(
              wasLogged
                ? `Run updated for ${dateLabel}.`
                : `Run saved for ${dateLabel}. You earned ${earnedBlockPhrase(values.activityType)}.`,
            );
            setSecondaryOpen(false);
          }}
        />
      )}

      {secondary?.kind === "edit-workout" && secondaryDay && (
        <EditWorkoutSheet
          key={secondaryVisit}
          workout={secondaryDay.workout}
          isOpen={isSecondaryOpen}
          onClose={closeSecondary}
          onSave={(values: PlannedRunValues) => {
            const workout = secondaryDay.workout;
            const isRest = workout.type === "rest";
            applyPlanEdit(
              () =>
                isRest
                  ? addPlannedRun(viewPlan, workout.id, values)
                  : editPlannedRun(viewPlan, workout.id, values),
              isRest
                ? `${values.title} planned for ${formatDateLabel(workout.date)}.`
                : `${formatDateLabel(workout.date)} updated.`,
            );
          }}
        />
      )}

      {secondary?.kind === "move-workout" && secondaryDay && (
        <MoveWorkoutSheet
          key={secondaryVisit}
          plan={viewPlan}
          workout={secondaryDay.workout}
          isOpen={isSecondaryOpen}
          onClose={closeSecondary}
          onMove={(toDate) => {
            const workout = secondaryDay.workout;
            applyPlanEdit(
              () => moveWorkout(viewPlan, workout.id, toDate),
              `${workout.title} moved to ${formatDateLabel(toDate)}.`,
            );
          }}
        />
      )}

      {secondary?.kind === "race-setup" && onGeneratePlan && (
        <RaceSetupSheet
          key={secondaryVisit}
          plan={viewPlan}
          setup={raceSetup}
          runDays={runDays}
          crossTrainingDays={crossTrainingDays}
          runLogs={runLogs}
          today={today}
          isOpen={isSecondaryOpen}
          onClose={closeSecondary}
          onGenerate={(setup, generated) => {
            onGeneratePlan(setup, generated);
            // The plan under this screen has been replaced, so the viewed week
            // number no longer means what it did. Land on the new plan's own
            // opening week rather than whatever number was on screen.
            goToWeek(currentWeekNumber(generated, today), generated);
            setAnnouncement(
              `${generated.weeks.length}-week plan built for ${setup.name}.`,
            );
          }}
        />
      )}

      {secondary?.kind === "conflicts" && (
        <ConflictReviewSheet
          key={secondaryVisit}
          conflicts={conflicts}
          isOpen={isSecondaryOpen}
          onClose={closeSecondary}
          onMove={(workoutId, toDate) => {
            const workout = findWorkout(viewPlan, workoutId);
            applyPlanEdit(
              () => moveWorkout(viewPlan, workoutId, toDate),
              `${workout?.title ?? "Workout"} moved to ${formatDateLabel(toDate)}.`,
              { close: false },
            );
          }}
        />
      )}
    </div>
  );
}
