import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  earnedBlockPhrase,
  earnedBlocks,
  findPlacementForWorkout,
} from "../../domain/build";
import { daysBetweenLocalDates, formatDateLabel, todayLocalDate } from "../../domain/dates";
import type { BlockPlacement, RunLog, TrainingPlan, Workout } from "../../domain/types";
import { PlaceBlockSheet, type PlacementRequest } from "../build/PlaceBlockSheet";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { selectTodayViewModel } from "../../domain/workout";
import { CompletedRunSummary } from "./CompletedRunSummary";
import { RaceSummaryCard } from "./RaceSummaryCard";
import { TodayWorkoutCard } from "./TodayWorkoutCard";

interface TodayScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements?: BlockPlacement[];
  onViewPlan: () => void;
  onViewBuild?: () => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
  onSaveRun?: (workout: Workout, values: ValidRunEntry) => void;
  onPlaceBlock?: (request: PlacementRequest) => void;
}

export function TodayScreen({
  plan,
  runLogs,
  blockPlacements = [],
  onViewPlan,
  onViewBuild = () => undefined,
  today = todayLocalDate(),
  onSaveRun = () => undefined,
  onPlaceBlock = () => undefined,
}: TodayScreenProps) {
  const [isSheetOpen, setSheetOpen] = useState(false);
  const [isPlacingBlock, setPlacingBlock] = useState(false);
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

  // The completed run on screen, whichever state produced it.
  const completed =
    viewModel.kind === "completed"
      ? { workout: viewModel.workout, runLog: viewModel.runLog }
      : viewModel.kind === "before-plan" && firstRun && firstRunLog
        ? { workout: firstRun, runLog: firstRunLog }
        : null;
  const completedPlacement = completed
    ? (findPlacementForWorkout(blockPlacements, completed.workout.id) ?? null)
    : null;
  const earnedBlock = completed
    ? (earnedBlocks(plan, runLogs).find(
        (block) => block.workout.id === completed.workout.id,
      ) ?? null)
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
          <div className="today-workout-card__actions">
            <Button onClick={() => setSheetOpen(true)}>Log First Run</Button>
            <Button variant="secondary" onClick={onViewPlan}>
              View Plan
            </Button>
          </div>
        </Card>
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

      {completed && (
        <CompletedRunSummary
          workout={completed.workout}
          runLog={completed.runLog}
          placement={completedPlacement}
          onEditRun={() => setSheetOpen(true)}
          onPlaceBlock={() => setPlacingBlock(true)}
          onViewBuild={onViewBuild}
        />
      )}

      <p className="visually-hidden" aria-live="polite">
        {saveAnnouncement}
      </p>

      {editable && (
        <CompleteRunSheet
          key={editable.runLog?.updatedAt ?? "new"}
          isOpen={isSheetOpen}
          workout={editable.workout}
          runLog={editable.runLog}
          onClose={() => setSheetOpen(false)}
          onSave={(workout, values) => {
            onSaveRun(workout, values);
            setSaveAnnouncement(
              `Run saved. You earned ${earnedBlockPhrase(workout.type)}.`,
            );
            setSheetOpen(false);
          }}
        />
      )}

      {earnedBlock && isPlacingBlock && (
        <PlaceBlockSheet
          block={earnedBlock}
          plan={plan}
          placements={blockPlacements}
          isMove={completedPlacement !== null}
          isOpen
          onClose={() => setPlacingBlock(false)}
          onPlace={(request) => {
            onPlaceBlock(request);
            setPlacingBlock(false);
            setSaveAnnouncement(
              `Block placed in week ${request.weekNumber}, course ${request.row + 1}, column ${request.columnStart}.`,
            );
            onViewBuild();
          }}
        />
      )}
    </div>
  );
}
