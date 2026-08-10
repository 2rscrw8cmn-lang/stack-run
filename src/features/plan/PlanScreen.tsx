import { CalendarDays } from "lucide-react";
import { useState } from "react";
import {
  blockedDates,
  findAvailabilityConflicts,
  type AvailabilityCalendar,
} from "../../domain/availability";
import { earnedBlockPhrase } from "../../domain/build";
import { formatDateLabel, todayLocalDate } from "../../domain/dates";
import {
  clampWeekNumber,
  currentWeekNumber,
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
import type {
  RunLog,
  TrainingPlan,
  Workout,
} from "../../domain/types";
import { ConflictReviewSheet } from "../availability/ConflictReviewSheet";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { WorkoutDetailSheet } from "../workout-detail/WorkoutDetailSheet";
import { EditWorkoutSheet } from "./EditWorkoutSheet";
import { MoveWorkoutSheet } from "./MoveWorkoutSheet";
import { WeekLead } from "./WeekLead";
import { WorkoutRow } from "./WorkoutRow";

interface PlanScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
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
  syncToken?: string | null;
}

/**
 * The sheet stacked over the detail sheet. Detail keeps its own state so it can
 * close through the dialog before this one opens, which is what returns focus
 * to the row the user came from.
 */
type Secondary =
  | { kind: "run-entry" | "edit-workout" | "move-workout"; workoutId: string }
  | { kind: "conflicts" };

/**
 * The complete editable schedule: one training week at a time, opening on the
 * week that contains today.
 *
 * Two kinds of change live here and stay separate. Logging or editing a run
 * records what happened. Editing, moving, or clearing a workout changes what
 * the plan asks for. Nothing does both at once, and nothing here recommends a
 * change — the plan only moves when the user moves it.
 */
export function PlanScreen({
  plan,
  runLogs,
  today = todayLocalDate(),
  onSaveRun = () => undefined,
  onDeleteRun = () => undefined,
  onEditPlan = () => undefined,
  availability = null,
  syncToken,
}: PlanScreenProps) {
  const [weekNumber, setWeekNumber] = useState(() =>
    currentWeekNumber(plan, today),
  );
  const [detailWorkoutId, setDetailWorkoutId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [secondary, setSecondary] = useState<Secondary | null>(null);
  const [isSecondaryOpen, setSecondaryOpen] = useState(false);
  // Bumped whenever a form opens, so it starts from what is saved rather than
  // from whatever the previous visit left in it.
  const [secondaryVisit, setSecondaryVisit] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const week = selectPlanWeekViewModel(plan, runLogs, weekNumber, today);
  const blocked = blockedDates(availability);
  const conflicts = findAvailabilityConflicts(plan, availability, runLogs, today);
  const satisfiedWorkoutIds = new Set(
    runLogs.flatMap((runLog) => (runLog.workoutId ? [runLog.workoutId] : [])),
  );

  const detailDay =
    week.days.find((day) => day.workout.id === detailWorkoutId) ?? null;
  const secondaryDay =
    secondary && "workoutId" in secondary
      ? (week.days.find((day) => day.workout.id === secondary.workoutId) ?? null)
      : null;

  function goToWeek(next: number) {
    setDetailOpen(false);
    setDetailWorkoutId(null);
    setSecondaryOpen(false);
    setSecondary(null);
    setWeekNumber(clampWeekNumber(plan, next));
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
              () => changeToRest(plan, workout.id, satisfiedWorkoutIds),
              `${formatDateLabel(workout.date)} is now a rest day.`,
            ),
    };
  }

  return (
    <div className="plan-screen">
      <WeekLead
        week={week}
        totalWeeks={plan.weeks.length}
        onStep={(direction) => goToWeek(week.weekNumber + direction)}
        onCurrentWeek={() => goToWeek(currentWeekNumber(plan, today))}
      />

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

      {/* Nothing hangs off the foot of the schedule now: the plan's settings
          are in the header gear, and Training Trends is on Runs, next to the
          actual runs it is a reading of. */}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {detailDay && detailDay.status !== "rest" && (
        <WorkoutDetailSheet
          workout={detailDay.workout}
          state={detailDay.status}
          runLog={detailDay.runLog}
          syncToken={syncToken}
          isOpen={isDetailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailWorkoutId(null);
          }}
          onLogRun={
            detailDay.canLogRun
              ? () =>
                  openSecondary({
                    kind: "run-entry",
                    workoutId: detailDay.workout.id,
                  })
              : undefined
          }
          onEditRun={
            detailDay.runLog
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
                  ? addPlannedRun(plan, workout.id, values)
                  : editPlannedRun(plan, workout.id, values),
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
          plan={plan}
          workout={secondaryDay.workout}
          isOpen={isSecondaryOpen}
          onClose={closeSecondary}
          onMove={(toDate) => {
            const workout = secondaryDay.workout;
            applyPlanEdit(
              () => moveWorkout(plan, workout.id, toDate),
              `${workout.title} moved to ${formatDateLabel(toDate)}.`,
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
            const workout = findWorkout(plan, workoutId);
            applyPlanEdit(
              () => moveWorkout(plan, workoutId, toDate),
              `${workout?.title ?? "Workout"} moved to ${formatDateLabel(toDate)}.`,
              { close: false },
            );
          }}
        />
      )}
    </div>
  );
}
