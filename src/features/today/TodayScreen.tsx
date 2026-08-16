import { CalendarPlus, Moon, PartyPopper } from "lucide-react";
import { useState } from "react";
import {
  blockedDates,
  type AvailabilityCalendar,
} from "../../domain/availability";
import {
  earnedBlockPhrase,
  findPlacementForRunLog,
  selectBuildViewModel,
} from "../../domain/build";
import { formatDateLabel, todayLocalDate } from "../../domain/dates";
import type {
  BlockPlacement,
  RunLog,
  TrainingPlan,
  Workout,
} from "../../domain/types";
import { unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun";
import { selectRunFound, type IntervalsCandidate } from "../../connected/intervals";
import { RunFoundCard } from "../connected/RunFoundCard";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { BuildPreview } from "./BuildPreview";
import { CompletedRunSummary } from "./CompletedRunSummary";
import { NextWorkoutCard } from "./NextWorkoutCard";
import { ThisWeekStrip } from "./ThisWeekStrip";
import { TodayContext } from "./TodayContext";
import { TodayHeading } from "./TodayHeading";
import { TodayNote } from "./TodayNote";
import { TodaySignalNote } from "./TodaySignalNote";
import { TodayWorkoutCard } from "./TodayWorkoutCard";
import { selectTodayModel } from "./todayModel";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { TodayCrewActivity } from "./TodayCrewActivity";
import "./todayDecisionSurface.css";

interface TodayScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  /**
   * The runner's unified actual history, owned by the application and passed
   * down through `AppShell`. Today opens no history hook, sync or store of its
   * own; it defaults to the run logs alone, which is exactly what a manual-only
   * runner has.
   */
  runnerRuns?: RunnerRun[];
  blockPlacements?: BlockPlacement[];
  onViewPlan: () => void;
  /** Opens Runs — the full record, and where Training Signals live. */
  onViewRuns?: () => void;
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
  onDeleteRun?: (runLogId: string) => void;
  availability?: AvailabilityCalendar | null;
  /** Unimported synced runs, newest first once Run Data is connected. */
  candidates?: IntervalsCandidate[];
  /** Opens the existing import review, optionally forced to an extra run. */
  onReviewCandidate?: (candidate: IntervalsCandidate, asExtra: boolean) => void;
  onDismissCandidate?: (externalId: string) => void;
  onIgnoreCandidate?: (externalId: string) => void;
  /** The last quiet sync failure, if there is one worth offering a retry for. */
  syncError?: string | null;
  onRetrySync?: () => void;
  isSyncing?: boolean;
  raceCrew?: RaceCrewController | null;
  onViewCrew?: () => void;
}

/** Which run the entry sheet is open for, and what it is about to write. */
type Entry =
  { kind: "scheduled"; workout: Workout; runLog?: RunLog };

/**
 * Today — the decision surface.
 *
 * This screen used to answer *what does my plan say today?*, and on a rest day,
 * before a plan started or after a race it had almost nothing to say. NEXT-4
 * changes the question to **what matters now?** without hiding the plan: a
 * scheduled run today is still very likely the most important immediate action,
 * so it still leads. What changed is that the rest of the screen now understands
 * the runner beyond that one workout.
 *
 * The hierarchy, in order:
 *
 * 1. **the date**, and the race as quiet goal context;
 * 2. **the immediate action** — today's workout, the run already completed, or a
 *    one-line note for a day that asks nothing;
 * 3. **a connected run waiting for review**, which is a real action and so sits
 *    beside the others rather than under analytics;
 * 4. **recent training** — two or three facts from the NEXT-2 history layer;
 * 5. **this week**, actuals first and the plan's intent beside them;
 * 6. **one observation**, at most, from the NEXT-3 signal domain;
 * 7. **up next**, when the plan has something to say;
 * 8. **Build**, because the work accumulating is the point;
 * 9. **Crew**, optional and downstream of the runner's own experience.
 *
 * Every decision above is made in `todayModel.ts` and every calculation behind
 * it already existed. This component composes and handles run entry; it computes
 * no mileage, defines no window and grades no adherence.
 */
export function TodayScreen({
  plan,
  runLogs,
  runnerRuns,
  blockPlacements = [],
  onViewPlan,
  onViewRuns,
  onViewBuild = () => undefined,
  today = todayLocalDate(),
  onStartPlacing = () => undefined,
  onSaveRun = () => undefined,
  onDeleteRun = () => undefined,
  availability = null,
  candidates = [],
  onReviewCandidate = () => undefined,
  onDismissCandidate = () => undefined,
  onIgnoreCandidate = () => undefined,
  syncError = null,
  onRetrySync = () => undefined,
  isSyncing = false,
  raceCrew = null,
  onViewCrew = () => undefined,
}: TodayScreenProps) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const [isEntryOpen, setEntryOpen] = useState(false);
  const [entryVisit, setEntryVisit] = useState(0);
  const [saveAnnouncement, setSaveAnnouncement] = useState("");

  const runs = runnerRuns ?? unifiedRunnerHistory({ runLogs, blockPlacements });
  const model = selectTodayModel({ plan, runLogs, runs, today });
  const { immediate } = model;
  const found = selectRunFound(candidates, plan, runLogs, today);
  const build = selectBuildViewModel(plan, runLogs, blockPlacements, today);

  // The completed run on screen, if today's scheduled workout has been logged.
  const completed =
    immediate.kind === "completed"
      ? { workout: immediate.workout, runLog: immediate.runLog }
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
      <TodayHeading
        today={today}
        race={plan.race}
        daysRemaining={model.raceDaysRemaining}
      />

      {immediate.kind === "before-plan" && (
        <TodayNote
          icon={<CalendarPlus size={15} strokeWidth={1.8} />}
          eyebrow="Plan starts soon"
        >
          Training begins{" "}
          {formatDateLabel(immediate.planStartDate, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
          . Anything you run before then is an extra run, and it still earns a
          block.
        </TodayNote>
      )}

      {immediate.kind === "after-race" && (
        <TodayNote
          icon={<PartyPopper size={15} strokeWidth={1.8} />}
          eyebrow="Race complete"
        >
          You crossed the finish line. Every block below is a run you actually
          did.
        </TodayNote>
      )}

      {immediate.kind === "rest" && (
        <TodayNote icon={<Moon size={15} strokeWidth={1.8} />} eyebrow="Rest Day">
          {immediate.workout.details}
        </TodayNote>
      )}

      {immediate.kind === "run" && (
        <TodayWorkoutCard
          workout={immediate.workout}
          onMarkComplete={() =>
            openEntry({ kind: "scheduled", workout: immediate.workout })
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

      {/*
        A run waiting to be told what it was is an action, so it stays up here
        with the other actions rather than sinking below the training context.
        It never displaces today's scheduled workout — both can be true at once.
      */}
      {found && (
        <RunFoundCard
          found={found}
          today={today}
          onConfirmMatch={() => onReviewCandidate(found.candidate, false)}
          onAddAsExtra={() => onReviewCandidate(found.candidate, true)}
          onDismiss={() => onDismissCandidate(found.candidate.externalId)}
          onIgnore={() => onIgnoreCandidate(found.candidate.externalId)}
        />
      )}

      <TodayContext readings={model.context} />

      {model.week && (
        <ThisWeekStrip
          week={model.week}
          blocked={blockedDates(availability)}
          onViewPlan={onViewPlan}
          // Nothing to look at before the first run, and an empty list invites
          // a tap that answers nothing.
          onViewRuns={onViewRuns && runs.length > 0 ? onViewRuns : undefined}
        />
      )}

      {model.signal && onViewRuns && (
        <TodaySignalNote signal={model.signal} onViewSignals={onViewRuns} />
      )}

      {model.next && <NextWorkoutCard workout={model.next} />}

      <BuildPreview
        blocks={build.blocks}
        pendingBlocks={build.pendingBlocks}
        onViewBuild={onViewBuild}
      />

      <TodayCrewActivity crew={raceCrew} today={today} onViewCrew={onViewCrew} />

      {/*
        A failed sync is worth saying and not worth interrupting for: the plan,
        the log and the Build are all still true without it. So it sits down
        here, below everything the runner came for, with the retry they would
        otherwise have to go into Run Data to find.
      */}
      {syncError && !found && (
        <p className="today-screen__sync-error">
          <span>{syncError}</span>
          <button type="button" onClick={onRetrySync} disabled={isSyncing}>
            {isSyncing ? "Syncing…" : "Retry"}
          </button>
        </p>
      )}

      <p className="visually-hidden" aria-live="polite">
        {saveAnnouncement}
      </p>

      {entry && (
        <CompleteRunSheet
          key={entryVisit}
          isOpen={isEntryOpen}
          workout={entry.workout}
          runLog={entry.runLog}
          today={today}
          onClose={() => {
            setEntryOpen(false);
            setEntry(null);
          }}
          onDelete={
            entry.runLog
              ? () => {
                  onDeleteRun(entry.runLog!.id);
                  setSaveAnnouncement("Run deleted.");
                  setEntryOpen(false);
                }
              : undefined
          }
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
