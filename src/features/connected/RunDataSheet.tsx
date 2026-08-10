import { CircleCheck, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import type { AppState, Effort, RunActivityType } from "../../domain/types";
import { earnedBlockPhrase } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import {
  likelyManualMatches,
  suggestScheduledMatches,
  type IntervalsCandidate,
  type IntervalsConnection,
} from "../../connected/intervals";
import { RunDataSetup } from "./RunDataSetup";

/** A candidate handed in from Today, already decided as match or extra. */
export interface RunDataReview {
  candidate: IntervalsCandidate;
  asExtra: boolean;
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

const ACTIVITY_OPTIONS: { value: RunActivityType; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "long", label: "Long Run" },
  { value: "intervals", label: "Intervals" },
  { value: "simulation", label: "Simulation" },
  { value: "race", label: "Race" },
];

function lastSyncLabel(at: string | null): string {
  return at ? new Date(at).toLocaleString() : "Not yet";
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
  const initialMatch =
    props.initialReview && !props.initialReview.asExtra
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
      : "easy",
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
    setType(match?.type && match.type !== "rest" ? match.type : "easy");
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

  const workouts = selected
    ? suggestScheduledMatches(selected, props.state.plan, props.state.runLogs)
    : [];
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

        {connected && (
          <>
            <div className="run-data__status">
              <CircleCheck size={20} strokeWidth={2} aria-hidden="true" />
              <div>
                <strong>Intervals.icu connected</strong>
                <p>
                  {connectionMode === "local-api-key"
                    ? "Personal key on this device"
                    : "Legacy owner proxy"}
                  <br />
                  Last activity sync:{" "}
                  {lastSyncLabel(
                    props.state.intervalsSync.lastSuccessfulActivitySyncAt,
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

            {/* Runs found but not yet settled. Importing one is a decision, so
                each is a row that opens the review rather than a one-tap add. */}
            {props.candidates.length > 0 && (
              <section className="run-data__found">
                <h3 className="run-data__heading">
                  {props.candidates.length === 1
                    ? "1 run to review"
                    : `${props.candidates.length} runs to review`}
                </h3>
                <ul className="run-data__candidates">
                  {props.candidates.map((candidate) => (
                    <li key={candidate.externalId}>
                      <button
                        type="button"
                        className="run-data__candidate"
                        onClick={() => review(candidate)}
                        aria-current={
                          selected?.externalId === candidate.externalId
                            ? "true"
                            : undefined
                        }
                      >
                        <strong>{formatMiles(candidate.distanceMiles)} mi</strong>
                        <span>
                          {candidate.completedDate} ·{" "}
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
            <h3 className="run-data__heading">Review synced run</h3>
            <p className="run-data__facts">
              {selected.completedDate} · {formatMiles(selected.distanceMiles)} mi
              · {formatDurationSeconds(selected.durationSeconds)}
            </p>

            {manual && (
              <div className="run-data__attach">
                <p>
                  Possible manual run: {manual.completedDate},{" "}
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
              <select
                className="run-input"
                value={workoutId ?? ""}
                onChange={(event) => {
                  const id = event.target.value || null;
                  setWorkoutId(id);
                  const chosen = workouts.find((item) => item.id === id);
                  if (chosen && chosen.type !== "rest") setType(chosen.type);
                }}
              >
                <option value="">Add as Extra Run</option>
                {workouts.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.date} — {item.title}
                  </option>
                ))}
              </select>
            </FormField>

            {workout && workout.date !== selected.completedDate && (
              <p className="run-data__note">
                Actual date {selected.completedDate}; planned date{" "}
                {workout.date}.
              </p>
            )}

            {!workoutId && (
              <FormField label="STACK activity type">
                <select
                  className="run-input"
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as RunActivityType)
                  }
                >
                  {ACTIVITY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </FormField>
            )}

            <FormField label="How did it feel?">
              <select
                className="run-input"
                value={effort}
                onChange={(event) => setEffort(event.target.value as Effort)}
              >
                <option value="rough">Rough</option>
                <option value="solid">Solid</option>
                <option value="great">Great</option>
              </select>
            </FormField>

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

            {/* Neither of these is the thing to do next, so neither is shaped
                like the button that is. */}
            <div className="run-data__quiet-actions">
              <button type="button" onClick={() => setSelected(null)}>
                Close suggestion
              </button>
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

        {connected && (
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
