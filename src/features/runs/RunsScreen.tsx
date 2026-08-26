import { BarChart3, ChevronRight, History, Plus } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { Section } from "../../components/ui/Section.js";
import { earnedBlockPhrase } from "../../domain/build.js";
import { formatDateLabel, todayLocalDate } from "../../domain/dates.js";
import { runHistory, type RunHistoryEntry } from "../../domain/runs.js";
import type { ArchivedTrainingPlan, RunLog, TrainingPlan, Workout } from "../../domain/types.js";
import type { IntervalsConnection } from "../../connected/intervals.js";
import type { HistorySyncPhase } from "../../history/historySyncPolicy.js";
import { runningRunnerRuns, unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun.js";
import { runnerSnapshot } from "../../history/runnerSnapshot.js";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet.js";
import type { ValidRunEntry } from "../run-entry/runValidation.js";
import { ConnectToPlanSheet } from "./ConnectToPlanSheet.js";
import { HistoricalRunSheet } from "./HistoricalRunSheet.js";
import { HistoryExplorer } from "./HistoryExplorer.js";
import { RunDetailSheet } from "./RunDetailSheet.js";
import { RunnerProfileSheet } from "./RunnerProfileSheet.js";
import { RunnerRunRow } from "./RunnerRunRow.js";
import { RunnerSnapshot } from "./RunnerSnapshot.js";
import { RunnerVolumeStrip } from "./RunnerVolumeStrip.js";
import { SignalCards } from "../signals/SignalCards.js";
import { SignalDetailSheet } from "../signals/SignalDetailSheet.js";
import { isSignalDemoEnabled, signalDemoRuns } from "../signals/signalDemo.js";
import {
  RUNS_OVERVIEW_SIGNAL_LIMIT,
  selectOverviewSignals,
} from "../signals/signalOverview.js";
import { presentableRunnerSignals } from "../../signals/runnerSignals.js";
import type { SignalId } from "../../signals/trainingSignal.js";
import "./runsOverview.css";

/** Runs Overview is orientation, not the archive. */
export const RECENT_RUN_COUNT = 3;
/** Inline continuation stays useful without turning Overview into the archive. */
export const RECENT_EXPANDED_RUN_COUNT = 10;

interface RunsScreenProps {
  plan: TrainingPlan | null;
  planHistory?: readonly ArchivedTrainingPlan[];
  runLogs: RunLog[];
  /**
   * The unified actual history: STACK runs and connected history reconciled
   * into one row per physical run. Defaults to the run logs alone, which is
   * exactly what a manual-only runner has and all this screen needs.
   */
  runnerRuns?: RunnerRun[];
  historyPhase?: HistorySyncPhase;
  historyCompleteAt?: string | null;
  onSaveRun?: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  onDeleteRun?: (runLogId: string) => void;
  /** Connects an extra run to a scheduled workout after the fact. */
  onLinkRun?: (runLogId: string, workoutId: string) => void;
  /** Undoes a manual link, turning the run back into an extra run. */
  onUnlinkRun?: (runLogId: string) => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
  syncToken?: IntervalsConnection | string | null;
}

/**
 * What this runner has actually done.
 *
 * UI-13 made Runs the chronological record of `RunLog[]`. NEXT-2 keeps that and
 * widens what "the record" means: the list is now the **unified actual history**
 * — every run the runner did, whether they logged it, imported it, or simply ran
 * it while Intervals was watching and never thought about STACK at all. A run
 * does not have to be accepted into STACK to be a fact about the runner.
 *
 * R1 turns the destination into a progressive-disclosure overview:
 *
 * 1. current running snapshot;
 * 2. recent-training shape;
 * 3. up to three visual Training Signal summaries;
 * 4. three recent runs;
 * 5. a dedicated History Explorer boundary.
 *
 * What NEXT-3 changed is the signals themselves rather than where they sit.
 * They are no longer seven plan-relative statistics; they are a short ordered
 * list of observations about the runner's actual history, each one a sentence
 * with its evidence and its two windows underneath — see `src/signals/`. This
 * screen computes none of them. It asks the domain which signals are
 * presentable, caps only the overview presentation in that same order, and
 * opens the existing detail behind whichever one is tapped.
 */
export function RunsScreen({
  plan,
  planHistory = [],
  runLogs,
  runnerRuns,
  historyPhase = "no-connection",
  historyCompleteAt = null,
  onSaveRun = () => undefined,
  onDeleteRun = () => undefined,
  onLinkRun,
  onUnlinkRun,
  today = todayLocalDate(),
  syncToken,
}: RunsScreenProps) {
  const [runsView, setRunsView] = useState<"overview" | "history">("overview");
  const [detailRunLogId, setDetailRunLogId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [historicalRunId, setHistoricalRunId] = useState<string | null>(null);
  const [isHistoricalOpen, setHistoricalOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isConnectOpen, setConnectOpen] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState<SignalId | null>(null);
  const [isSignalOpen, setSignalOpen] = useState(false);
  const [areSignalsExpanded, setSignalsExpanded] = useState(false);
  const [areRecentRunsExpanded, setRecentRunsExpanded] = useState(false);
  const returnToSignal = useRef(false);
  /**
   * The run the entry sheet is open for, held rather than looked up.
   *
   * Deleting takes the run out of the log, so a derived lookup would go null
   * and tear the open dialog out of the document mid-close — no close event,
   * no focus restoration, and a sheet that believes it is still open. A
   * snapshot lets the sheet close the ordinary way and then unmount.
   */
  /**
   * Where Runs Overview was left when History was opened.
   *
   * History is a child screen rather than a route, so nothing but this screen
   * restores the scroll position — and without it, opening History inherited
   * the Overview's offset and put the History title off the top of the phone.
   * Navigation behaviour: the child opens at its own top, and coming back
   * returns the runner to the row they left.
   */
  const overviewScroll = useRef(0);
  const [editing, setEditing] = useState<RunHistoryEntry | null>(null);
  const [isEditOpen, setEditOpen] = useState(false);
  // Bumped whenever the entry sheet opens, so it starts from what is saved
  // rather than from whatever the previous visit left in it.
  const [editVisit, setEditVisit] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const headingRef = useRef<HTMLHeadingElement>(null);
  /** Set when a delete has taken the focused row out of the document. */
  const pendingFocus = useRef(false);
  /**
   * Dismissing the entry sheet comes back to the run it was opened from;
   * saving or deleting takes you out to the list to see what changed. Both
   * paths end in the dialog's own close event, so which happened is remembered.
   */
  const returnToDetail = useRef(false);

  const history = runHistory(plan, runLogs, planHistory);
  const isSignalDemo = isSignalDemoEnabled();
  const actualRuns = runnerRuns ?? fallbackRunnerRuns(runLogs);
  const runs = isSignalDemo ? signalDemoRuns(today) : actualRuns;
  const runningRuns = runningRunnerRuns(runs);
  const snapshot = runnerSnapshot(runningRuns, today);
  const signals = presentableRunnerSignals({ runs: runningRuns, today, plan, runLogs });
  const overviewSignals = selectOverviewSignals(signals);
  const selectedSignal =
    signals.find((signal) => signal.id === selectedSignalId) ?? null;
  const selected =
    history.find((entry) => entry.runLog.id === detailRunLogId) ?? null;
  const historicalRun = runs.find((run) => run.id === historicalRunId) ?? null;

  /**
   * A deleted run takes its own row — the thing the browser would have
   * returned focus to — out of the document with it, which drops focus to the
   * body and loses a keyboard user's place entirely. Once every sheet has
   * closed, put them back at the top of the list they are looking at.
   */
  /**
   * Runs the same frame the view swaps, so neither screen is ever painted at
   * the other one's scroll position. Only a navigation moves the page: arriving
   * on the Runs tab is left exactly as the app shell already had it.
   */
  const paintedView = useRef(runsView);
  useLayoutEffect(() => {
    if (paintedView.current === runsView) return;
    paintedView.current = runsView;
    if (typeof window.scrollTo !== "function") return;
    window.scrollTo(0, runsView === "history" ? 0 : overviewScroll.current);
  }, [runsView]);

  useEffect(() => {
    if (pendingFocus.current && !isEditOpen && !isDetailOpen) {
      pendingFocus.current = false;
      (headingRef.current ?? document.querySelector<HTMLHeadingElement>(".history-explorer h1"))
        ?.focus();
    }
  }, [isEditOpen, isDetailOpen, history.length]);

  /** Remember where Overview was, then hand off to the History child screen. */
  function openHistory() {
    overviewScroll.current = typeof window.scrollY === "number" ? window.scrollY : 0;
    setRunsView("history");
  }

  function openEntry(entry: RunHistoryEntry | null, fromDetail: boolean) {
    returnToDetail.current = fromDetail;
    setEditing(entry);
    setDetailOpen(false);
    setEditVisit((visit) => visit + 1);
    setEditOpen(true);
  }

  /** Opens whichever detail this run has: a STACK run's, or a source record's. */
  function openRun(run: RunnerRun) {
    returnToSignal.current = false;
    if (run.stack) {
      setDetailRunLogId(run.stack.runLogId);
      setDetailOpen(true);
    } else {
      setHistoricalRunId(run.id);
      setHistoricalOpen(true);
    }
  }

  function openRunById(runId: string) {
    const run = runs.find((candidate) => candidate.id === runId);
    if (!run) return;
    setProfileOpen(false);
    openRun(run);
  }

  function closeDetail() {
    setDetailOpen(false);
    if (returnToSignal.current && selectedSignalId) {
      returnToSignal.current = false;
      setSignalOpen(true);
    }
  }

  /** Hands off from Run Detail to its compact plan-linking picker. */
  function openConnectToPlan() {
    setDetailOpen(false);
    setConnectOpen(true);
  }

  /** Back to the run's own detail either way — cancelling or linking. */
  function closeConnectToPlan() {
    setConnectOpen(false);
    setDetailOpen(true);
  }

  /** The change was made: leave the sheets behind and show the result. */
  function commit(announce: string) {
    returnToDetail.current = false;
    returnToSignal.current = false;
    setAnnouncement(announce);
    setEditOpen(false);
  }

  function entryClosed() {
    setEditOpen(false);
    setEditing(null);
    // Only back to a run that is still there to go back to.
    if (returnToDetail.current && selected) {
      setDetailOpen(true);
    }
    returnToDetail.current = false;
  }

  const visibleSignals = areSignalsExpanded ? signals : overviewSignals;
  const recentRuns = runs.slice(
    0,
    areRecentRunsExpanded ? RECENT_EXPANDED_RUN_COUNT : RECENT_RUN_COUNT,
  );

  return (
    <div className="runs-screen">
      {runsView === "history" ? (
        <HistoryExplorer
          runs={runs}
          today={today}
          onBack={() => {
            setRunsView("overview");
            window.requestAnimationFrame(() =>
              headingRef.current?.focus({ preventScroll: true }),
            );
          }}
          onOpenRun={openRun}
        />
      ) : (
        <>
      <div className="runs-screen__lead">
        <h1 className="visually-hidden" ref={headingRef} tabIndex={-1}>Runs</h1>
        <div className="runs-screen__title-row">
          <p className="runs-screen__count machine-label">
            {runningRuns.length === 0
              ? "No runs yet"
              : `${runningRuns.length} ${runningRuns.length === 1 ? "run" : "runs"}`}
          </p>
          {!isSignalDemo && (
            <Button
              variant="ghost"
              className="runs-screen__log"
              icon={<Plus size={18} strokeWidth={2} />}
              onClick={() => openEntry(null, false)}
            >
              Log Run
            </Button>
          )}
        </div>
        {isSignalDemo && (
          <p className="machine-label" role="status">
            SIGNAL DEMO · FAKE PREVIEW DATA · REMOVE ?demo=signals TO RETURN
          </p>
        )}
        {runningRuns.length > 0 && (
          <RunnerSnapshot
            snapshot={snapshot}
            phase={historyPhase}
            lastCompleteAt={historyCompleteAt}
            onOpenProfile={() => setProfileOpen(true)}
          />
        )}
      </div>

      {runs.length === 0 ? (
        <EmptyState
          icon={<History size={24} strokeWidth={1.6} />}
          title="Nothing recorded yet"
        >
          Log a run here or connect Run Data in Settings. The first run you
          record earns a block.
        </EmptyState>
      ) : (
        <>
          <Section
            className="runner-volume-section"
            icon={<BarChart3 size={15} strokeWidth={2} />}
            title="Recent Training"
          >
            <RunnerVolumeStrip weeks={snapshot.weeks} />
          </Section>

          <SignalCards
            signals={visibleSignals}
            runs={runs}
            today={today}
            hasHistory={runningRuns.length > 0}
            hiddenSignalCount={Math.max(0, signals.length - RUNS_OVERVIEW_SIGNAL_LIMIT)}
            isExpanded={areSignalsExpanded}
            onToggleExpanded={() => setSignalsExpanded((expanded) => !expanded)}
            onOpenSignal={(signal) => {
              setSelectedSignalId(signal.id);
              setSignalOpen(true);
            }}
          />

          <Section
            className="runs-recent"
            icon={<History size={15} strokeWidth={2} />}
            title="Recent Activity"
            meta={
              <span className="machine-label">
                {recentRuns.length} OF {runs.length}
              </span>
            }
          >
            <ul className="runs-screen__list">
              {recentRuns.map((run) => (
                <RunnerRunRow key={run.id} run={run} onOpen={() => openRun(run)} />
              ))}
            </ul>
            {runs.length > RECENT_RUN_COUNT && (
              <div className="runs-screen__more">
                <Button
                  variant="ghost"
                  aria-expanded={areRecentRunsExpanded}
                  aria-label={
                    areRecentRunsExpanded ? "Show fewer recent runs" : "Show more recent runs"
                  }
                  onClick={() => setRecentRunsExpanded((expanded) => !expanded)}
                >
                  {areRecentRunsExpanded ? "Show fewer" : "Show more"}
                </Button>
              </div>
            )}
            {/*
              Two different intents, so two different affordances: `Show more`
              extends what is already here, and this is a destination. It says
              where it goes and how much is there rather than being a second
              utility label beside the first.
            */}
            <button
              type="button"
              className="runs-screen__history"
              aria-label={`History. ${historySummary(runs)}.`}
              onClick={openHistory}
            >
              <span className="runs-screen__history-text">
                <span className="runs-screen__history-title">History</span>
                <span className="runs-screen__history-meta machine-label">
                  {historySummary(runs)}
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={2} aria-hidden="true" />
            </button>
          </Section>
        </>
      )}
        </>
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <RunnerProfileSheet
        runs={runs}
        snapshot={snapshot}
        today={today}
        isOpen={isProfileOpen}
        onClose={() => setProfileOpen(false)}
        onOpenRun={openRunById}
      />

      <HistoricalRunSheet
        run={historicalRun}
        connection={syncToken}
        isOpen={isHistoricalOpen}
        onClose={() => {
          setHistoricalOpen(false);
          setHistoricalRunId(null);
          // A run reached from a signal goes back to the signal, the same way a
          // STACK run does — a historical row is not a dead end.
          if (returnToSignal.current && selectedSignalId) {
            returnToSignal.current = false;
            setSignalOpen(true);
          }
        }}
      />

      {selected && (
        <RunDetailSheet
          entry={selected}
          plan={plan ?? undefined}
          runLogs={runLogs}
          syncToken={syncToken}
          isOpen={isDetailOpen}
          onEditRun={() => openEntry(selected, true)}
          onOpenConnectToPlan={plan && onLinkRun ? openConnectToPlan : undefined}
          onUnlinkRun={
            onUnlinkRun &&
            ((runLogId) => {
              onUnlinkRun(runLogId);
              setAnnouncement("Run unlinked from the plan.");
            })
          }
          onClose={closeDetail}
        />
      )}

      {selected && plan && onLinkRun && (
        <ConnectToPlanSheet
          runLog={selected.runLog}
          plan={plan}
          runLogs={runLogs}
          isOpen={isConnectOpen}
          onLink={(runLogId, workoutId) => {
            onLinkRun(runLogId, workoutId);
            setAnnouncement("Run connected to the plan.");
            closeConnectToPlan();
          }}
          onClose={closeConnectToPlan}
        />
      )}

      <SignalDetailSheet
        signal={selectedSignal}
        runs={runs}
        plan={plan}
        runLogs={runLogs}
        today={today}
        isOpen={isSignalOpen}
        onClose={() => {
          setSignalOpen(false);
          if (!returnToSignal.current) {
            setSelectedSignalId(null);
          }
        }}
        onOpenRun={(runId) => {
          const run = runs.find((candidate) => candidate.id === runId);
          if (!run) return;
          setSignalOpen(false);
          openRun(run);
          // After `openRun`, which clears the flag for the ordinary list path.
          returnToSignal.current = true;
        }}
        onOpenRunLog={(runLogId) => {
          returnToSignal.current = true;
          setSignalOpen(false);
          setDetailRunLogId(runLogId);
          setDetailOpen(true);
        }}
      />

      {(isEditOpen || editing) && (
        <CompleteRunSheet
          key={editVisit}
          isOpen={isEditOpen}
          workout={editing?.workout ?? null}
          runLog={editing?.runLog}
          today={today}
          onClose={entryClosed}
          onDelete={
            editing
              ? () => {
                  onDeleteRun(editing.runLog.id);
                  pendingFocus.current = true;
                  commit("Run deleted. Its block came out of the tower.");
                }
              : undefined
          }
          onSave={(workout, values) => {
            onSaveRun(workout, values, editing?.runLog.id);
            commit(
              editing
                ? "Run updated."
                : `Run saved. You earned ${earnedBlockPhrase(values.activityType)}.`,
            );
          }}
        />
      )}
    </div>
  );
}

/**
 * The unified history a screen with no connected history still has: its own runs.
 *
 * A manual-only runner reaches exactly this path, and everything above it —
 * snapshot, volume, frequency, long runs — works on it unchanged, which is the
 * compatibility requirement the phase is held to. It is also what every existing
 * test that renders this screen with run logs alone gets.
 */
function fallbackRunnerRuns(runLogs: readonly RunLog[]): RunnerRun[] {
  return unifiedRunnerHistory({ runLogs });
}

/** How much history the destination leads to, stated from the history itself. */
function historySummary(runs: readonly RunnerRun[]): string {
  const count = `${runs.length} ${runs.length === 1 ? "run" : "runs"}`;
  const earliest = runs.map((run) => run.date).sort()[0];
  if (!earliest) return count;
  return `${count} since ${formatDateLabel(earliest, { month: "short", year: "numeric" })}`;
}
