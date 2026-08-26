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
import { readyCrewBlockForLocalRun } from "../../crew/todayCrewBlock";
import { formatDateLabel, todayLocalDate } from "../../domain/dates";
import type {
  BlockPlacement,
  RunLog,
  TrainingPlan,
  Workout,
} from "../../domain/types";
import { unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun";
import { restoreWorkout } from "../../domain/planEdit";
import {
  canUndoProvenance,
  deriveWorkoutProvenance,
  type WorkoutProvenanceSlot,
} from "../../domain/planProvenance";
import { selectRunFound, type IntervalsCandidate } from "../../connected/intervals";
import { RunFoundCard } from "./RunFoundCard";
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
import {
  isTodayDemoEnabled,
  isTodayFoundDemoEnabled,
  todayDemoData,
  todayFoundDemoCandidate,
} from "./todayDemo";
import { selectTodayModel } from "./todayModel";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { TodayCrewActivity } from "./TodayCrewActivity";
import { TodayCrewRecap } from "./TodayCrewRecap";
import "./todayDecisionSurface.css";

interface TodayScreenProps {
  plan: TrainingPlan | null;
  runLogs: RunLog[];
  /** Unified actual history owned by the application. */
  runnerRuns?: RunnerRun[];
  blockPlacements?: BlockPlacement[];
  onViewPlan: () => void;
  onViewRuns?: () => void;
  onViewBuild?: () => void;
  onStartPlacing?: (runLogId: string) => void;
  /**
   * Hands one shared run to Crew, which opens straight into placement for it.
   * Crew placement is independent of Personal placement (D-066), so a run can
   * still owe a Crew block after its Personal block is standing.
   */
  onStartCrewPlacing?: (sharedRunId: string) => void;
  today?: string;
  onSaveRun?: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  /**
   * Plan editing (#182): only ever used to undo an assistant adjustment on
   * `NextWorkoutCard` — Today has no other plan-mutation surface. Absent
   * means no Undo is offered, the same as `planAdjustments` being absent.
   */
  onEditPlan?: (plan: TrainingPlan) => void;
  availability?: AvailabilityCalendar | null;
  candidates?: IntervalsCandidate[];
  /** Opens Run Data on this candidate's own review state. */
  onReviewCandidate?: (candidate: IntervalsCandidate) => void;
  syncError?: string | null;
  onRetrySync?: () => void;
  isSyncing?: boolean;
  raceCrew?: RaceCrewController | null;
  onViewCrew?: () => void;
}

/**
 * The run entry Today opens. It only ever logs a run that has not been
 * recorded yet — correcting or deleting one belongs to Runs/Run Detail
 * (issue #152), so no entry here carries an existing run log.
 */
type Entry = { kind: "scheduled"; workout: Workout };

/** Today — the decision surface. */
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
  onStartCrewPlacing = () => undefined,
  onSaveRun = () => undefined,
  onEditPlan,
  availability = null,
  candidates = [],
  onReviewCandidate = () => undefined,
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

  /**
   * Owner-review mode is an in-memory overlay only. It cannot be enabled on a
   * production/custom hostname and none of its fake state is handed to a write
   * callback. This keeps Vercel phone review useful without touching real data.
   */
  const isDemo = isTodayDemoEnabled();
  const isFoundDemo = isTodayFoundDemoEnabled();
  const demo = isDemo ? todayDemoData() : null;
  const effectivePlan = demo?.plan ?? plan;
  const effectiveRunLogs = demo?.runLogs ?? runLogs;
  const effectivePlacements = demo?.blockPlacements ?? blockPlacements;
  const effectiveToday = demo?.today ?? today;
  const runs =
    demo?.runnerRuns ??
    runnerRuns ??
    unifiedRunnerHistory({
      runLogs: effectiveRunLogs,
      blockPlacements: effectivePlacements,
    });

  const model = selectTodayModel({
    plan: effectivePlan,
    runLogs: effectiveRunLogs,
    runs,
    today: effectiveToday,
  });
  const { immediate } = model;
  const found = isDemo
    ? isFoundDemo
      ? selectRunFound(
        [todayFoundDemoCandidate(effectivePlan!)],
        effectivePlan,
        effectiveRunLogs,
        effectiveToday,
        immediate.kind === "run" ? immediate.workout.id : null,
      )
      : null
    : selectRunFound(
      candidates,
      effectivePlan,
      effectiveRunLogs,
      effectiveToday,
      immediate.kind === "run" ? immediate.workout.id : null,
    );
  const build = selectBuildViewModel(
    effectivePlan,
    effectiveRunLogs,
    effectivePlacements,
    effectiveToday,
  );

  const completed =
    immediate.kind === "completed"
      ? { workout: immediate.workout, runLog: immediate.runLog }
      : null;
  const completedPlacement = completed
    ? (findPlacementForRunLog(effectivePlacements, completed.runLog.id) ?? null)
    : null;
  // The same run's Crew Build contribution, only while it is still unplaced.
  // The demo runner has no crew, and must never reach a real one.
  const completedCrewBlockRunId = completed && !isDemo
    ? readyCrewBlockForLocalRun(
      raceCrew?.crewData?.runs,
      raceCrew?.account?.profile.id,
      completed.runLog.id,
    )
    : null;
  // A suggested match for the workout due now replaces its manual fallback.
  // An unrelated candidate must not displace that workout; Run Data keeps it.
  // With no scheduled/completed action, the recent candidate may lead Today.
  const actionFound = completed
    ? null
    : immediate.kind === "run"
      ? found?.workout?.id === immediate.workout.id ? found : null
      : found;

  function openEntry(next: Entry) {
    setEntry(next);
    setEntryVisit((visit) => visit + 1);
    setEntryOpen(true);
  }

  /**
   * #182: the sparkle's data for `NextWorkoutCard` — the one Today surface
   * that can ever be assistant-modified, since `nextScheduledWorkout` is
   * always strictly future. `TodayWorkoutCard` (today's own workout) never
   * gets one: nothing in the ledger can ever name it.
   */
  const nextProvenance: WorkoutProvenanceSlot | null = (() => {
    if (!model.next || !plan || !raceCrew?.planAdjustments) return null;
    const workout = model.next;
    const value = deriveWorkoutProvenance(workout, raceCrew.planAdjustments);
    if (!value) return null;
    return {
      value,
      // Undo needs somewhere to send the restored plan; without it, the
      // sparkle still describes the change, it just offers no action.
      canUndo: Boolean(onEditPlan) && canUndoProvenance(value, plan.revision),
      onUndo: () => onEditPlan?.(restoreWorkout(plan, value.before)),
    };
  })();

  return (
    <div className="today-screen">
      <TodayHeading
        today={effectiveToday}
        race={effectivePlan?.race ?? null}
        daysRemaining={model.raceDaysRemaining}
      />

      {isDemo && (
        <p className="today-screen__demo-banner machine-label">
          {isFoundDemo ? "TODAY FOUND DEMO" : "TODAY DEMO"} · FAKE PREVIEW DATA · REMOVE ?DEMO=TODAY TO RETURN
        </p>
      )}

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

      {immediate.kind === "run" && !actionFound && (
        <TodayWorkoutCard
          workout={immediate.workout}
          onMarkComplete={() =>
            openEntry({ kind: "scheduled", workout: immediate.workout })
          }
        />
      )}

      {actionFound && (
        <RunFoundCard
          found={actionFound}
          today={effectiveToday}
          onReview={() => {
            if (!isDemo) onReviewCandidate(actionFound.candidate);
          }}
        />
      )}

      {completed && (
        <CompletedRunSummary
          workout={completed.workout}
          runLog={completed.runLog}
          placement={completedPlacement}
          crewBlockRunId={completedCrewBlockRunId}
          onPlaceBlock={() => {
            if (!isDemo) onStartPlacing(completed.runLog.id);
          }}
          onPlaceCrewBlock={(sharedRunId) => {
            if (!isDemo) onStartCrewPlacing(sharedRunId);
          }}
        />
      )}

      <TodayContext readings={model.context} />

      {immediate.kind === "no-plan" && (
        <button
          type="button"
          className="today-plan-prompt"
          aria-label="Set up a race plan"
          onClick={onViewPlan}
        >
          <CalendarPlus size={16} strokeWidth={1.8} aria-hidden="true" />
          <span>
            <strong>Running without a race plan</strong>
            <small>Set up a race when you are ready.</small>
          </span>
        </button>
      )}

      {model.week && (
        <ThisWeekStrip
          week={model.week}
          blocked={blockedDates(isDemo ? null : availability)}
          onViewPlan={onViewPlan}
          onViewRuns={onViewRuns && runs.length > 0 ? onViewRuns : undefined}
        />
      )}

      {model.signal && onViewRuns && (
        <TodaySignalNote signal={model.signal} onViewSignals={onViewRuns} />
      )}

      {model.next && <NextWorkoutCard workout={model.next} provenance={nextProvenance} />}

      <BuildPreview
        blocks={build.blocks}
        pendingBlocks={build.pendingBlocks}
        onViewBuild={onViewBuild}
      />

      {/*
        Evolution 2.04. A closed Crew week's story leads the Crew part of
        Today, below the workout, the run just logged and the Build — the
        module is limited-time and ages out on its own, so it never becomes a
        seventh permanent section. The demo runner has no crew and must never
        reach a real one.
      */}
      <TodayCrewRecap crew={isDemo ? null : raceCrew} today={effectiveToday} />

      <TodayCrewActivity
        crew={isDemo ? null : raceCrew}
        today={effectiveToday}
        onViewCrew={onViewCrew}
      />

      {!isDemo && syncError && !found && (
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
          today={effectiveToday}
          onClose={() => {
            setEntryOpen(false);
            setEntry(null);
          }}
          onSave={(workout, values) => {
            if (isDemo) {
              setSaveAnnouncement("Demo data is read-only.");
              setEntryOpen(false);
              return;
            }
            onSaveRun(workout, values);
            setSaveAnnouncement(
              `Run saved. You earned ${earnedBlockPhrase(values.activityType)}.`,
            );
            setEntryOpen(false);
          }}
        />
      )}
    </div>
  );
}
