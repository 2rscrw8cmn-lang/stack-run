import { CircleCheck, History, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { ActivityTypePicker } from "../../components/shared/ActivityTypePicker";
import { EffortPicker } from "../../components/shared/EffortPicker";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { StackSelect } from "../../components/ui/StackSelect";
import { formatDateLabel, formatUpdatedAgo } from "../../domain/dates";
import type { AppState, Effort, RunActivityType } from "../../domain/types";
import { earnedBlockPhrase } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import {
  availableScheduledMatches,
  likelyManualMatches,
  suggestScheduledMatches,
  type IntervalsCandidate,
  type IntervalsConnection,
} from "../../connected/intervals";
import { RunDataSetup } from "./RunDataSetup";

/** A candidate handed in from Today, to open straight in its review state. */
export interface RunDataReview {
  candidate: IntervalsCandidate;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  state: AppState;
  initialToken: string | null;
  connection?: IntervalsConnection | null;
  /** Sync lives above this sheet now, so Today and Run Data agree on it. */
  candidates: IntervalsCandidate[];
  isSyncing: boolean;
  syncError: string | null;
  onSync: () => void;
  /** Resolves to how many runs it added, or null when the read failed. */
  onFindOlderRuns: () => Promise<number | null>;
  onSettle: (externalId: string) => void;
  initialReview?: RunDataReview | null;
  onConnect: (token: string) => void;
  onForget: () => void;
  onConnectApiKey?: (apiKey: string) => void;
  onForgetApiKey?: () => void;
  onImport: (
    candidate: IntervalsCandidate,
    workoutId: string | null,
    type: RunActivityType,
    effort: Effort,
    notes: string,
  ) => void;
  onAttach: (candidate: IntervalsCandidate, runLogId: string) => void;
  onIgnore: (id: string) => void;
  onClearIgnored: () => void;
}

function lastSyncLabel(at: string | null): string {
  if (!at) return "No successful sync yet";
  const age = Date.now() - new Date(at).getTime();
  return age >= 2 * 60 * 60_000 ? (formatUpdatedAgo(at) ?? "Sync date unavailable") : "";
}

export function RunDataSheet(props: Props) {
  const initialConnection = props.connection ?? (props.initialToken
    ? { mode: "legacy-proxy" as const, credential: props.initialToken }
    : null);
  const [connectionMode, setConnectionMode] = useState<IntervalsConnection["mode"] | null>(
    initialConnection?.mode ?? null,
  );
  const [setupOpen, setSetupOpen] = useState(!initialConnection);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  // Opened from Today with a run already chosen, or opened cold from Settings.
  const [selected, setSelected] = useState<IntervalsCandidate | null>(
    props.initialReview?.candidate ?? null,
  );
  const initialMatch = props.initialReview
    ? suggestScheduledMatches(
        props.initialReview.candidate,
        props.state.plan,
        props.state.runLogs,
      )[0]
    : undefined;
  const [workoutId, setWorkoutId] = useState<string | null>(
    initialMatch?.id ?? null,
  );
  const [type, setType] = useState<RunActivityType>(
    initialMatch?.type && initialMatch.type !== "rest"
      ? initialMatch.type
      : (props.initialReview?.candidate.inferredActivityType ?? "easy"),
  );
  const [effort, setEffort] = useState<Effort>("solid");
  const [notes, setNotes] = useState("");

  /** A failure is worth reading and worth announcing; progress is not. */
  function report(text: string, isFailure = false) {
    setMessage(text);
    setFailed(isFailure);
  }

  function review(candidate: IntervalsCandidate) {
    setSelected(candidate);
    const match = suggestScheduledMatches(
      candidate,
      props.state.plan,
      props.state.runLogs,
    )[0];
    setWorkoutId(match?.id ?? null);
    setType(match?.type && match.type !== "rest" ? match.type : candidate.inferredActivityType);
  }

  function settle(candidate: IntervalsCandidate) {
    props.onSettle(candidate.externalId);
    setSelected(null);
  }

  function finish() {
    if (!selected) return;
    props.onImport(selected, workoutId, type, effort, notes);
    settle(selected);
    // The block is the reward, and it is earned the moment the run is real.
    report(`Run imported. You earned ${earnedBlockPhrase(type)}.`);
  }

  /**
   * Two lists, two jobs. `suggested` is what STACK would choose on its own and
   * drives the default selection; `workouts` is every scheduled run this could
   * still be, because the plan is not the only thing that decides which
   * workout a run was. A workout already linked to another run is in neither.
   */
  const suggested = selected
    ? suggestScheduledMatches(selected, props.state.plan, props.state.runLogs)
    : [];
  const workouts = selected
    ? availableScheduledMatches(selected, props.state.plan, props.state.runLogs)
    : [];
  const suggestedIds = new Set(suggested.map((item) => item.id));
  const others = workouts.filter((item) => !suggestedIds.has(item.id));
  const manual = selected
    ? likelyManualMatches(selected, props.state.runLogs)[0]
    : undefined;
  const workout = workoutId
    ? workouts.find((item) => item.id === workoutId)
    : undefined;
  const status = props.syncError ?? message;
  const isFailure = Boolean(failed || props.syncError);
  const connected = connectionMode !== null;

  return (
    <Sheet title="Run Data" isOpen={props.isOpen} onClose={props.onClose}>
      <div className="run-data">
        {setupOpen && (
          <RunDataSetup
            onConnected={(key) => {
              if (props.onConnectApiKey) props.onConnectApiKey(key);
              else props.onConnect(key);
              setConnectionMode("local-api-key");
              setSetupOpen(false);
              report("Intervals.icu connected. Looking for runs…");
            }}
            onCancel={connected ? () => setSetupOpen(false) : undefined}
          />
        )}

        {/*
          Run Data is two states, not one long page (issue #120). The list
          state is connection, sync and the runs waiting; choosing one enters
          the review state, which replaces all of it. The review used to
          render *below* the full candidate list, so tapping the first run of
          six opened a form the runner then had to scroll past the list to
          reach — on the first sync, when the list is longest.
        */}
        {connected && !selected && (
          <>
            <div className="run-data__status">
              <CircleCheck size={20} strokeWidth={2} aria-hidden="true" />
              <div>
                <strong>Intervals.icu connected</strong>
                <p>
                  {connectionMode === "local-api-key"
                    ? "Personal key on this device"
                    : "Legacy owner proxy"}
                  {lastSyncLabel(props.state.intervalsSync.lastSuccessfulActivitySyncAt) && (
                    <><br />{lastSyncLabel(props.state.intervalsSync.lastSuccessfulActivitySyncAt)}</>
                  )}
                </p>
              </div>
            </div>

            {connectionMode === "legacy-proxy" && !setupOpen && (
              <Button variant="secondary" onClick={() => setSetupOpen(true)}>
                Set Up Personal API Key
              </Button>
            )}

            <Button
              variant="secondary"
              isLoading={props.isSyncing}
              icon={<RefreshCw size={18} />}
              onClick={props.onSync}
            >
              Sync Now
            </Button>

            {/* Reaches further back than a normal sync, for runs an earlier
                release discovered and then dropped. It imports nothing, clears
                nothing and forgets no ignored activity — it only looks. */}
            <Button
              variant="secondary"
              isLoading={props.isSyncing}
              icon={<History size={18} />}
              onClick={() => {
                void props.onFindOlderRuns().then((added) => {
                  if (added === null) return;
                  report(added > 0 ? "Older runs checked." : "No additional runs found.");
                });
              }}
            >
              Find Older Runs
            </Button>

            {/* Runs found but not yet settled. Importing one is a decision, so
                each is a row that opens the review rather than a one-tap add. */}
            {props.candidates.length > 0 && (
              <section className="run-data__found">
                <h3 className="run-data__heading">
                  Runs to Review
                  <span className="machine-label">{props.candidates.length}</span>
                </h3>
                <ul className="run-data__candidates">
                  {props.candidates.map((candidate) => (
                    <li key={candidate.externalId}>
                      <button
                        type="button"
                        className="run-data__candidate"
                        onClick={() => review(candidate)}
                      >
                        <strong>{formatMiles(candidate.distanceMiles)} mi</strong>
                        <span>
                          {formatDateLabel(candidate.completedDate)} ·{" "}
                          {formatDurationSeconds(candidate.durationSeconds)}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {!props.isSyncing &&
              !props.candidates.length &&
              !props.syncError && (
                <p className="run-data__copy">
                  No runs are waiting to be reviewed.
                </p>
              )}
          </>
        )}

        {status && (
          <p
            role={isFailure ? "alert" : "status"}
            className={
              isFailure
                ? "run-data__message run-data__message--failed"
                : "run-data__message"
            }
          >
            {status}
          </p>
        )}

        {selected && (
          <section className="run-data__review">
            {/* The way back to the remaining runs, above the review it leaves. */}
            {props.candidates.length > 1 && (
              <button
                type="button"
                className="run-data__back"
                onClick={() => setSelected(null)}
              >
                ← Back to runs
              </button>
            )}
            <h3 className="run-data__heading">Review synced run</h3>
            <p className="run-data__facts">
              {formatDateLabel(selected.completedDate)} · {formatMiles(selected.distanceMiles)} mi
              · {formatDurationSeconds(selected.durationSeconds)}
            </p>

            {manual && (
              <div className="run-data__attach">
                <p>
                  Possible manual run: {formatDateLabel(manual.completedDate)},{" "}
                  {formatMiles(manual.distanceMiles)} mi,{" "}
                  {formatDurationSeconds(manual.durationSeconds)}. Synced values
                  above will replace date, distance and duration; effort, notes,
                  workout link and block identity stay unchanged.
                </p>
                <Button
                  variant="secondary"
                  onClick={() => {
                    props.onAttach(selected, manual.id);
                    settle(selected);
                  }}
                >
                  Attach Synced Data
                </Button>
              </div>
            )}

            <FormField label="Match">
              <StackSelect
                value={workoutId ?? ""}
                onChange={(event) => {
                  const id = event.target.value || null;
                  setWorkoutId(id);
                  const chosen = workouts.find((item) => item.id === id);
                  if (chosen && chosen.type !== "rest") setType(chosen.type);
                }}
              >
                <option value="">Add as Extra Run</option>
                {suggested.length > 0 && (
                  <optgroup label="Suggested">
                    {suggested.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatDateLabel(item.date, { month: "short", day: "numeric" })} — {item.title}
                      </option>
                    ))}
                  </optgroup>
                )}
                {others.length > 0 && (
                  <optgroup label={suggested.length > 0 ? "Other plan runs" : "Plan runs"}>
                    {others.map((item) => (
                      <option key={item.id} value={item.id}>
                        {formatDateLabel(item.date, { month: "short", day: "numeric" })} — {item.title}
                      </option>
                    ))}
                  </optgroup>
                )}
              </StackSelect>
            </FormField>

            {workout && workout.date !== selected.completedDate && (
              <p className="run-data__note">
                Actual date {formatDateLabel(selected.completedDate)}; planned date{" "}
                {formatDateLabel(workout.date)}.
              </p>
            )}

            {!workoutId && (
              <ActivityTypePicker
                label="STACK activity type"
                value={type}
                onChange={setType}
              />
            )}

            <EffortPicker value={effort} onChange={setEffort} />

            <FormField label="Notes (optional)">
              <textarea
                className="run-input"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </FormField>

            <Button onClick={finish}>
              {workoutId ? "Confirm Match" : "Add as Extra Run"}
            </Button>

            {/* Ignoring an activity is not the thing to do next, so it is
                not shaped like the button that is. */}
            <div className="run-data__quiet-actions">
              <button
                type="button"
                onClick={() => {
                  props.onIgnore(selected.externalId);
                  settle(selected);
                }}
              >
                Ignore this activity
              </button>
            </div>
          </section>
        )}

        {connected && !selected && (
          <div className="run-data__connection-actions">
            <button
              type="button"
              onClick={() => {
                if (connectionMode === "local-api-key") {
                  props.onForgetApiKey?.();
                  setConnectionMode(props.initialToken ? "legacy-proxy" : null);
                } else {
                  props.onForget();
                  setConnectionMode(null);
                }
                setSetupOpen(!props.initialToken);
                setSelected(null);
              }}
            >
              Forget Connection
            </button>
            <button
              type="button"
              disabled={!props.state.intervalsSync.ignoredActivityIds.length}
              onClick={props.onClearIgnored}
            >
              Clear Ignored Activities
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
