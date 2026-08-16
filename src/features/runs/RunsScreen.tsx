import { BarChart3, History, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Section } from "../../components/ui/Section";
import { earnedBlockPhrase } from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import { runHistory, type RunHistoryEntry } from "../../domain/runs";
import type { RunLog, TrainingPlan, Workout } from "../../domain/types";
import type { IntervalsConnection } from "../../connected/intervals";
import type { HistorySyncPhase } from "../../history/historySyncPolicy";
import { unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun";
import { runnerSnapshot } from "../../history/runnerSnapshot";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { ConnectToPlanSheet } from "./ConnectToPlanSheet";
import { HistoricalRunSheet } from "./HistoricalRunSheet";
import { RunDetailSheet } from "./RunDetailSheet";
import { RunnerProfileSheet } from "./RunnerProfileSheet";
import { RunnerRunRow } from "./RunnerRunRow";
import { RunnerSnapshot } from "./RunnerSnapshot";
import { RunnerVolumeStrip } from "./RunnerVolumeStrip";
import { SignalCards } from "../signals/SignalCards";
import { SignalDetailSheet } from "../signals/SignalDetailSheet";
import { isSignalDemoEnabled, signalDemoRuns } from "../signals/signalDemo";
import { presentableRunnerSignals } from "../../signals/runnerSignals";
import type { SignalId } from "../../signals/trainingSignal";

/** How many history rows are rendered before the runner asks for more. */
export const HISTORY_PAGE_SIZE = 25;

interface RunsScreenProps {
  plan: TrainingPlan;
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
 * The hierarchy is deliberately shallow, and evolves the existing screen rather
 * than adding a destination (NEXT-2 adds no navigation):
 *
 * 1. a compact **runner snapshot** — four readings, each with its window;
 * 2. a small **recent-volume strip** — twelve weeks of actual mileage;
 * 3. the **run history** itself, which is what the screen is for;
 * 4. **Training Signals**, below the history.
 *
 * Signals moved *under* the history in NEXT-2 and stay there. STACK Next's
 * ordering rule is actuals before intentions, and the first thing a runner
 * should meet on their own history screen is their history.
 *
 * What NEXT-3 changed is the signals themselves rather than where they sit.
 * They are no longer seven plan-relative statistics; they are a short ordered
 * list of observations about the runner's actual history, each one a sentence
 * with its evidence and its two windows underneath — see `src/signals/`. This
 * screen computes none of them. It asks the domain which signals are
 * presentable, renders them in the order it is given, and opens the detail
 * behind whichever one is tapped.
 */
export function RunsScreen({
  plan,
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
  const [detailRunLogId, setDetailRunLogId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [historicalRunId, setHistoricalRunId] = useState<string | null>(null);
  const [isHistoricalOpen, setHistoricalOpen] = useState(false);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isConnectOpen, setConnectOpen] = useState(false);
  const [selectedSignalId, setSelectedSignalId] = useState<SignalId | null>(null);
  const [isSignalOpen, setSignalOpen] = useState(false);
  const [visibleRuns, setVisibleRuns] = useState(HISTORY_PAGE_SIZE);
  const returnToSignal = useRef(false);
  /**
   * The run the entry sheet is open for, held rather than looked up.
   *
   * Deleting takes the run out of the log, so a derived lookup would go null
   * and tear the open dialog out of the document mid-close — no close event,
   * no focus restoration, and a sheet that believes it is still open. A
   * snapshot lets the sheet close the ordinary way and then unmount.
   */
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

  const history = runHistory(plan, runLogs);
  const isSignalDemo = isSignalDemoEnabled();
  const actualRuns = runnerRuns ?? fallbackRunnerRuns(runLogs);
  const runs = isSignalDemo ? signalDemoRuns(today) : actualRuns;
  const snapshot = runnerSnapshot(runs, today);
  const signals = presentableRunnerSignals({ runs, today, plan, runLogs });
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
  useEffect(() => {
    if (pendingFocus.current && !isEditOpen && !isDetailOpen) {
      pendingFocus.current = false;
      headingRef.current?.focus();
    }
  }, [isEditOpen, isDetailOpen, history.length]);

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

  const shown = runs.slice(0, visibleRuns);
  const remaining = runs.length - shown.length;

  return (
    <div className="runs-screen">
      <div className="runs-screen__lead">
        <h1 className="visually-hidden" ref={headingRef} tabIndex={-1}>Runs</h1>
        <div className="runs-screen__title-row">
          <p className="runs-screen__count data-value">
            {runs.length === 0
              ? "No runs yet"
              : `${runs.length} ${runs.length === 1 ? "run" : "runs"}`}
          </p>
          {!isSignalDemo && (
            <Button
              variant="secondary"
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
        {runs.length > 0 && (
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
          Log a run here or connect Run Data in Settings. Your first completed
          run earns a block.
        </EmptyState>
      ) : (
        <>
          <Section
            className="runner-volume-section"
            icon={<BarChart3 size={15} strokeWidth={2} />}
            title="Recent Volume"
          >
            <RunnerVolumeStrip weeks={snapshot.weeks} />
          </Section>

          <Section
            className="runs-recent"
            icon={<History size={15} strokeWidth={2} />}
            title="Run History"
            meta={<span className="machine-label">{runs.length}</span>}
          >
            <ul className="runs-screen__list">
              {shown.map((run) => (
                <RunnerRunRow key={run.id} run={run} onOpen={() => openRun(run)} />
              ))}
            </ul>
            {remaining > 0 && (
              <div className="runs-screen__more">
                <Button
                  variant="ghost"
                  onClick={() => setVisibleRuns((count) => count + HISTORY_PAGE_SIZE)}
                >
                  {`Show ${Math.min(remaining, HISTORY_PAGE_SIZE)} more`}
                </Button>
              </div>
            )}
          </Section>

          <SignalCards
            signals={signals}
            hasHistory={runs.length > 0}
            onOpenSignal={(signal) => {
              setSelectedSignalId(signal.id);
              setSignalOpen(true);
            }}
          />
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
          plan={plan}
          runLogs={runLogs}
          syncToken={syncToken}
          isOpen={isDetailOpen}
          onEditRun={() => openEntry(selected, true)}
          onOpenConnectToPlan={onLinkRun ? openConnectToPlan : undefined}
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

      {selected && onLinkRun && (
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
          if (!returnToSignal.current) setSelectedSignalId(null);
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
