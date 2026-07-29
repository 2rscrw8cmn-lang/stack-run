import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { daysBetweenLocalDates, formatDateLabel, todayLocalDate } from "../../domain/dates";
import type { RunLog, TrainingPlan, Workout } from "../../domain/types";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { selectTodayViewModel } from "../../domain/workout";
import { CompletedRunSummary } from "./CompletedRunSummary";
import { RaceSummaryCard } from "./RaceSummaryCard";
import { TodayWorkoutCard } from "./TodayWorkoutCard";

interface TodayScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  onViewPlan: () => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
  onSaveRun?: (workout: Workout, values: ValidRunEntry) => void;
}

export function TodayScreen({
  plan,
  runLogs,
  onViewPlan,
  today = todayLocalDate(),
  onSaveRun = () => undefined,
}: TodayScreenProps) {
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");

  const viewModel = selectTodayViewModel(plan, runLogs, today);
  const daysRemaining = daysBetweenLocalDates(today, plan.race.date);
  const firstRun = plan.weeks
    .flatMap((week) => week.workouts)
    .find((workout) => workout.type !== "rest");
  const firstRunLog = firstRun
    ? runLogs.find((runLog) => runLog.workoutId === firstRun.id)
    : undefined;
  const editable =
    viewModel.kind === "run" || viewModel.kind === "completed"
      ? { workout: viewModel.workout, runLog: viewModel.kind === "completed" ? viewModel.runLog : undefined }
      : viewModel.kind === "before-plan" && firstRun
        ? { workout: firstRun, runLog: firstRunLog }
        : null;

  return (
    <div className="today-screen">
      <RaceSummaryCard race={plan.race} daysRemaining={daysRemaining} />

      {viewModel.kind === "before-plan" && !firstRunLog && (
        <Card className="today-workout-card">
          <p className="today-workout-card__eyebrow">Plan starts soon</p>
          <p className="today-workout-card__title">
            {formatDateLabel(viewModel.planStartDate, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
          <Button onClick={() => setSheetOpen(true)}>
            Log First Run
          </Button>
          <Button variant="ghost" onClick={onViewPlan}>View Plan</Button>
        </Card>
      )}

      {viewModel.kind === "before-plan" && firstRun && firstRunLog && (
        <CompletedRunSummary workout={firstRun} runLog={firstRunLog} onEditRun={() => setSheetOpen(true)} />
      )}

      {viewModel.kind === "after-race" && (
        <Card className="today-workout-card">
          <p className="today-workout-card__eyebrow">Race complete</p>
          <p className="today-workout-card__details">
            You crossed the finish line. Your full build is ready to look
            back on.
          </p>
        </Card>
      )}

      {(viewModel.kind === "rest" || viewModel.kind === "run") && (
        <TodayWorkoutCard
          workout={viewModel.workout}
          onMarkComplete={() => setSheetOpen(true)}
          onViewPlan={onViewPlan}
        />
      )}

      {viewModel.kind === "completed" && (
        <CompletedRunSummary
          workout={viewModel.workout}
          runLog={viewModel.runLog}
          onEditRun={() => setSheetOpen(true)}
        />
      )}

      <p className="visually-hidden" aria-live="polite">{saveAnnouncement}</p>
      {editable && <CompleteRunSheet key={editable.runLog?.updatedAt ?? "new"} isOpen={isSheetOpen} workout={editable.workout} runLog={editable.runLog} onClose={() => setSheetOpen(false)} onSave={(_workout, values) => { onSaveRun(editable.workout, values); setSaveAnnouncement("Run saved successfully."); setSheetOpen(false); }} />}
    </div>
  );
}
