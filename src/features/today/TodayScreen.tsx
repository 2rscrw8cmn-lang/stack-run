import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import {
  earnedBlockPhrase,
  findPlacementForRunLog,
  selectBuildViewModel,
} from "../../domain/build";
import {
  daysBetweenLocalDates,
  formatDateLabel,
  todayLocalDate,
} from "../../domain/dates";
import {
  currentWeekNumber,
  nextScheduledWorkout,
  selectPlanWeekViewModel,
} from "../../domain/plan";
import type {
  BlockPlacement,
  RunLog,
  TrainingPlan,
  Workout,
} from "../../domain/types";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { selectTodayViewModel } from "../../domain/workout";
import { BuildPreview } from "./BuildPreview";
import { CompletedRunSummary } from "./CompletedRunSummary";
import { NextWorkoutCard } from "./NextWorkoutCard";
import { RaceContext } from "./RaceContext";
import { ThisWeekStrip } from "./ThisWeekStrip";
import { TodayWorkoutCard } from "./TodayWorkoutCard";

interface TodayScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements?: BlockPlacement[];
  onViewPlan: () => void;
  onViewBuild?: () => void;
  /** Hands the earned block to Build, which is where placing happens. */
  onStartPlacing?: (runLogId: string) => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
  onSaveRun?: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
}

/** Which run the entry sheet is open for, and what it is about to write. */
type Entry =
  | { kind: "scheduled"; workout: Workout; runLog?: RunLog }
  | { kind: "extra"; runLog?: RunLog };

/**
 * The daily dashboard. It answers, in order: what do I do today, how is the
 * week going, what is next, did I run something the plan never asked for, and
 * what have I built.
 */
export function TodayScreen({
  plan,
  runLogs,
  blockPlacements = [],
  onViewPlan,
  onViewBuild = () => undefined,
  today = todayLocalDate(),
  onStartPlacing = () => undefined,
  onSaveRun = () => undefined,
}: TodayScreenProps) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [isEntryOpen, setEntryOpen] = useState(false);
  const [entryVisit, setEntryVisit] = useState(0);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");

  const viewModel = selectTodayViewModel(plan, runLogs, today);
  const daysRemaining = daysBetweenLocalDates(today, plan.race.date);
  const week = selectPlanWeekViewModel(
    plan,
    runLogs,
    currentWeekNumber(plan, today),
    today,
  );
  const next = nextScheduledWorkout(plan, today);
  const build = selectBuildViewModel(plan, runLogs, blockPlacements, today);

  // The completed run on screen, if today's scheduled workout has been logged.
  const completed =
    viewModel.kind === "completed"
      ? { workout: viewModel.workout, runLog: viewModel.runLog }
      : null;
  const completedPlacement = completed
    ? (findPlacementForRunLog(blockPlacements, completed.runLog.id) ?? null)
    : null;

  function openEntry(next: Entry) {
    setEntry(next);
    setEntryVisit((visit) => visit + 1);
    setEntryOpen(true);
  }

  return (
    <div className="today-screen">
      <RaceContext race={plan.race} daysRemaining={daysRemaining} />

      {viewModel.kind === "before-plan" && (
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
          <p className="today-workout-card__details">
            Nothing is scheduled yet. Anything you run before then is an extra
            run, and it still earns a block.
          </p>
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
          onMarkComplete={() =>
            openEntry({ kind: "scheduled", workout: viewModel.workout })
          }
        />
      )}

      {completed && (
        <CompletedRunSummary
          workout={completed.workout}
          runLog={completed.runLog}
          placement={completedPlacement}
          onEditRun={() =>
            openEntry({
              kind: "scheduled",
              workout: completed.workout,
              runLog: completed.runLog,
            })
          }
          onPlaceBlock={() => onStartPlacing(completed.runLog.id)}
          onViewBuild={onViewBuild}
        />
      )}

      <ThisWeekStrip week={week} onViewPlan={onViewPlan} />

      {next && <NextWorkoutCard workout={next} />}

      <Button
        variant="secondary"
        className="today-screen__log-extra"
        icon={<Plus size={18} strokeWidth={2} />}
        onClick={() => openEntry({ kind: "extra" })}
      >
        Log Run
      </Button>

      <BuildPreview
        blocks={build.blocks}
        pendingBlocks={build.pendingBlocks}
        onViewBuild={onViewBuild}
      />

      <p className="visually-hidden" aria-live="polite">
        {saveAnnouncement}
      </p>

      {entry && (
        <CompleteRunSheet
          key={entryVisit}
          isOpen={isEntryOpen}
          workout={entry.kind === "scheduled" ? entry.workout : null}
          runLog={entry.runLog}
          today={today}
          onClose={() => {
            setEntryOpen(false);
            setEntry(null);
          }}
          onSave={(workout, values) => {
            const wasLogged = entry.runLog !== undefined;
            onSaveRun(workout, values, entry.runLog?.id);
            setSaveAnnouncement(
              wasLogged
                ? "Run updated."
                : `Run saved. You earned ${earnedBlockPhrase(values.activityType)}.`,
            );
            setEntryOpen(false);
          }}
        />
      )}
    </div>
  );
}
