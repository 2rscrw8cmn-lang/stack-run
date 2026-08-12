import { History, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Section } from "../../components/ui/Section";
import { earnedBlockPhrase, totalActualMiles } from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { runHistory, type RunHistoryEntry } from "../../domain/runs";
import { selectTrainingSignals } from "../../domain/trends";
import type { RunLog, TrainingPlan, Workout } from "../../domain/types";
import type { IntervalsConnection } from "../../connected/intervals";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { RunDetailSheet } from "./RunDetailSheet";
import { RunRow } from "./RunRow";
import { TrendCards } from "./TrendCards";
import { TrainingSignalDetailSheet } from "../trends/TrainingSignalDetailSheet";
import type { TrainingSignalId } from "../../domain/trends";

interface RunsScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
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
 * What actually happened: every recorded run, newest first.
 *
 * The factual record, and deliberately not a second Plan — nothing here is
 * scheduled, and nothing here changes what is. It reads from `RunLog[]`, which
 * has always been the whole actual history; the pillar is a way in, not a new
 * store, so there is no migration behind this screen and nothing derived on it
 * is written back.
 *
 * The screen leads with the count rather than the word "Runs", per the UI-7
 * content-first rule: the tab already said what this is.
 *
 * Runs is personal again, and only personal. UI-19 borrowed this screen for a
 * local `YOU | CREW` switch while Race Crew had no destination of its own.
 * UI-21 gave the crew its own tower and its own tab, so the social surface
 * moved there rather than existing in two places at once.
 */
export function RunsScreen({
  plan,
  runLogs,
  onSaveRun = () => undefined,
  onDeleteRun = () => undefined,
  onLinkRun,
  onUnlinkRun,
  today = todayLocalDate(),
  syncToken,
}: RunsScreenProps) {
  const [detailRunLogId, setDetailRunLogId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [selectedSignal, setSelectedSignal] = useState<TrainingSignalId | null>(null);
  const [isSignalOpen, setSignalOpen] = useState(false);
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
  const selected =
    history.find((entry) => entry.runLog.id === detailRunLogId) ?? null;
  const miles = totalActualMiles(runLogs);
  const activeWeeks = selectTrainingSignals(plan, runLogs, today).weeklyMileage
    .filter((week) => week.actualMiles > 0).length;

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

  function closeDetail() {
    setDetailOpen(false);
    if (returnToSignal.current && selectedSignal) {
      returnToSignal.current = false;
      setSignalOpen(true);
    }
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

  return (
    <div className="runs-screen">
      <div className="runs-screen__lead">
        <h1 className="visually-hidden" ref={headingRef} tabIndex={-1}>Runs</h1>
        <div className="runs-screen__title-row">
          {history.length === 0 ? (
            <p className="runs-screen__count data-value">No runs yet</p>
          ) : (
            <dl className="runs-screen__quick-stats" aria-label="Running history summary">
              <div>
                <dd className="data-value">{history.length}</dd>
                <dt className="machine-label">{history.length === 1 ? "run" : "runs"}</dt>
              </div>
              <div>
                <dd className="data-value">{formatMiles(miles)}</dd>
                <dt className="machine-label">Total mi</dt>
              </div>
              <div>
                <dd className="data-value">{activeWeeks}</dd>
                <dt className="machine-label">Weeks</dt>
              </div>
            </dl>
          )}
          <Button
            variant="secondary"
            className="runs-screen__log"
            icon={<Plus size={18} strokeWidth={2} />}
            onClick={() => openEntry(null, false)}
          >
            Log Run
          </Button>
        </div>
        {history.length > 0 && <p className="visually-hidden">{formatMiles(miles)} miles run</p>}
      </div>

      <TrendCards
        plan={plan}
        runLogs={runLogs}
        today={today}
        onOpenSignal={(signal) => {
          setSelectedSignal(signal);
          setSignalOpen(true);
        }}
      />

      {history.length === 0 ? (
        <EmptyState
          icon={<History size={24} strokeWidth={1.6} />}
          title="Nothing recorded yet"
        >
          Log a run here or connect Run Data in Settings. Your first completed
          run earns a block.
        </EmptyState>
      ) : (
        <Section
          className="runs-recent"
          icon={<History size={15} strokeWidth={2} />}
          title="Recent Runs"
        >
          <ul className="runs-screen__list">
            {history.map((entry) => (
              <RunRow
                key={entry.runLog.id}
                entry={entry}
                onOpen={() => {
                  returnToSignal.current = false;
                  setDetailRunLogId(entry.runLog.id);
                  setDetailOpen(true);
                }}
              />
            ))}
          </ul>
        </Section>
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {selected && (
        <RunDetailSheet
          entry={selected}
          plan={plan}
          runLogs={runLogs}
          syncToken={syncToken}
          isOpen={isDetailOpen}
          onEditRun={() => openEntry(selected, true)}
          onLinkRun={
            onLinkRun &&
            ((runLogId, workoutId) => {
              onLinkRun(runLogId, workoutId);
              setAnnouncement("Run connected to the plan.");
            })
          }
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

      <TrainingSignalDetailSheet
        signal={selectedSignal}
        plan={plan}
        runLogs={runLogs}
        today={today}
        isOpen={isSignalOpen}
        onClose={() => {
          setSignalOpen(false);
          if (!returnToSignal.current) setSelectedSignal(null);
        }}
        onOpenRun={(runLogId) => {
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
