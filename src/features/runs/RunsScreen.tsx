import { History, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { earnedBlockPhrase, totalActualMiles } from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { runHistory, type RunHistoryEntry } from "../../domain/runs";
import type { RunLog, TrainingPlan, Workout } from "../../domain/types";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { RunDetailSheet } from "./RunDetailSheet";
import { RunRow } from "./RunRow";
import { TrendCards } from "./TrendCards";

interface RunsScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  onSaveRun?: (
    workout: Workout | null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  onDeleteRun?: (runLogId: string) => void;
  /** Opens the full Training Trends view, which the cards lead into. */
  onViewTrends?: () => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
  syncToken?: string | null;
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
 */
export function RunsScreen({
  plan,
  runLogs,
  onSaveRun = () => undefined,
  onDeleteRun = () => undefined,
  onViewTrends = () => undefined,
  today = todayLocalDate(),
  syncToken,
}: RunsScreenProps) {
  const [detailRunLogId, setDetailRunLogId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
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
  }, [isEditOpen, isDetailOpen]);

  function openEntry(entry: RunHistoryEntry | null, fromDetail: boolean) {
    returnToDetail.current = fromDetail;
    setEditing(entry);
    setDetailOpen(false);
    setEditVisit((visit) => visit + 1);
    setEditOpen(true);
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
        <div className="runs-screen__summary">
          <h1 className="runs-screen__count" ref={headingRef} tabIndex={-1}>
            {history.length === 0
              ? "No runs yet"
              : `${history.length} ${history.length === 1 ? "run" : "runs"}`}
          </h1>
          {history.length > 0 && (
            <p className="runs-screen__miles">{formatMiles(miles)} miles run</p>
          )}
        </div>
        <Button
          variant="secondary"
          className="runs-screen__log"
          icon={<Plus size={18} strokeWidth={2} />}
          onClick={() => openEntry(null, false)}
        >
          Log Run
        </Button>
      </div>

      <TrendCards
        plan={plan}
        runLogs={runLogs}
        today={today}
        onViewTrends={onViewTrends}
      />

      {history.length === 0 ? (
        <EmptyState
          icon={<History size={24} strokeWidth={1.6} />}
          title="Nothing recorded yet"
        >
          Every run you complete or sync shows up here, newest first —
          scheduled or extra. Log one and it earns a block.
        </EmptyState>
      ) : (
        <ul className="runs-screen__list">
          {history.map((entry) => (
            <RunRow
              key={entry.runLog.id}
              entry={entry}
              onOpen={() => {
                setDetailRunLogId(entry.runLog.id);
                setDetailOpen(true);
              }}
            />
          ))}
        </ul>
      )}

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {selected && (
        <RunDetailSheet
          entry={selected}
          syncToken={syncToken}
          isOpen={isDetailOpen}
          onEditRun={() => openEntry(selected, true)}
          onClose={() => setDetailOpen(false)}
        />
      )}

      {(isEditOpen || editing) && (
        <CompleteRunSheet
          key={editVisit}
          isOpen={isEditOpen}
          // The workout the run satisfied, so the sheet says which day this
          // was rather than calling a scheduled run extra. It cannot move the
          // run to another workout: the repository keeps the link that an
          // edit was never asked to change.
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
