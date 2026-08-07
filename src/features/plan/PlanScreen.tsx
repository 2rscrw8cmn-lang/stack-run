import { useState } from "react";
import { earnedBlockPhrase } from "../../domain/build";
import { formatDateLabel, todayLocalDate } from "../../domain/dates";
import {
  clampWeekNumber,
  currentWeekNumber,
  selectPlanWeekViewModel,
} from "../../domain/plan";
import type { RunLog, TrainingPlan, Workout } from "../../domain/types";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { WorkoutDetailSheet } from "../workout-detail/WorkoutDetailSheet";
import { WeekHeader } from "./WeekHeader";
import { WeekNavigator } from "./WeekNavigator";
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
}

/**
 * The complete schedule tracker: one training week at a time, opening on the
 * week that contains today. Build shows what has been built; Plan shows what
 * the plan asks for and what has actually been done about it.
 */
export function PlanScreen({
  plan,
  runLogs,
  today = todayLocalDate(),
  onSaveRun = () => undefined,
}: PlanScreenProps) {
  const [weekNumber, setWeekNumber] = useState(() =>
    currentWeekNumber(plan, today),
  );
  // Each sheet keeps its workout and its open state apart, so closing can run
  // through the dialog itself. Clearing the workout alone would tear an open
  // dialog out of the DOM, and the browser would drop focus to the body
  // instead of returning it to the row the user came from.
  const [detailWorkoutId, setDetailWorkoutId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [entryWorkoutId, setEntryWorkoutId] = useState<string | null>(null);
  const [isEntryOpen, setEntryOpen] = useState(false);
  // Bumped every time run entry opens, so the form always starts from the
  // saved log rather than from whatever the previous visit left in it.
  const [entryVisit, setEntryVisit] = useState(0);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");

  const week = selectPlanWeekViewModel(plan, runLogs, weekNumber, today);
  const detailDay =
    week.days.find((day) => day.workout.id === detailWorkoutId) ?? null;
  const entryDay =
    week.days.find((day) => day.workout.id === entryWorkoutId) ?? null;

  function openDetail(workoutId: string) {
    setDetailWorkoutId(workoutId);
    setDetailOpen(true);
  }

  /** Hands off from the detail sheet, so only one sheet is ever open. */
  function openRunEntry(workoutId: string) {
    setDetailOpen(false);
    setEntryWorkoutId(workoutId);
    setEntryVisit((visit) => visit + 1);
    setEntryOpen(true);
  }

  function goToWeek(next: number) {
    setDetailOpen(false);
    setDetailWorkoutId(null);
    setEntryOpen(false);
    setEntryWorkoutId(null);
    setWeekNumber(clampWeekNumber(plan, next));
  }

  return (
    <div className="plan-screen">
      <h1 className="screen-title">Plan</h1>

      <WeekNavigator
        weekNumber={week.weekNumber}
        totalWeeks={plan.weeks.length}
        hasPreviousWeek={week.hasPreviousWeek}
        hasNextWeek={week.hasNextWeek}
        isCurrentWeek={week.isCurrentWeek}
        onStep={(direction) => goToWeek(week.weekNumber + direction)}
        onCurrentWeek={() => goToWeek(currentWeekNumber(plan, today))}
      />

      <WeekHeader week={week} />

      <ul
        className="plan-week"
        aria-label={`Week ${week.weekNumber} workouts`}
      >
        {week.days.map((day) => (
          <WorkoutRow
            key={day.workout.id}
            day={day}
            onSelect={openDetail}
          />
        ))}
      </ul>

      <p className="visually-hidden" aria-live="polite">
        {saveAnnouncement}
      </p>

      {detailDay && detailDay.status !== "rest" && (
        <WorkoutDetailSheet
          workout={detailDay.workout}
          state={detailDay.status}
          runLog={detailDay.runLog}
          isOpen={isDetailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailWorkoutId(null);
          }}
          onLogRun={
            detailDay.canLogRun
              ? () => openRunEntry(detailDay.workout.id)
              : undefined
          }
          onEditRun={
            detailDay.runLog
              ? () => openRunEntry(detailDay.workout.id)
              : undefined
          }
        />
      )}

      {entryDay && (
        <CompleteRunSheet
          key={`${entryDay.workout.id}-${entryVisit}`}
          isOpen={isEntryOpen}
          workout={entryDay.workout}
          runLog={entryDay.runLog ?? undefined}
          today={today}
          onClose={() => {
            setEntryOpen(false);
            setEntryWorkoutId(null);
          }}
          onSave={(workout, values) => {
            const wasLogged = entryDay.runLog !== null;
            onSaveRun(workout, values, entryDay.runLog?.id);
            const dateLabel = formatDateLabel(values.completedDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
            });
            setSaveAnnouncement(
              wasLogged
                ? `Run updated for ${dateLabel}.`
                : `Run saved for ${dateLabel}. You earned ${earnedBlockPhrase(values.activityType)}.`,
            );
            setEntryOpen(false);
          }}
        />
      )}
    </div>
  );
}
