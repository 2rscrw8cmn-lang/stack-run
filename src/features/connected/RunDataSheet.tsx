import { Database, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import type { AppState, Effort, RunActivityType } from "../../domain/types";
import { earnedBlockPhrase } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { fetchIntervals, likelyManualMatches, suggestScheduledMatches, type IntervalsCandidate } from "../../connected/intervals";

/** A candidate handed in from Today, already decided as match or extra. */
export interface RunDataReview {
  candidate: IntervalsCandidate;
  asExtra: boolean;
}

interface Props {
  isOpen: boolean; onClose: () => void; state: AppState; initialToken: string | null;
  /** Sync lives above this sheet now, so Today and Run Data agree on it. */
  candidates: IntervalsCandidate[]; isSyncing: boolean; syncError: string | null;
  onSync: () => void; onSettle: (externalId: string) => void;
  initialReview?: RunDataReview | null;
  onConnect: (token: string) => void; onForget: () => void;
  onImport: (candidate: IntervalsCandidate, workoutId: string | null, type: RunActivityType, effort: Effort, notes: string) => void;
  onAttach: (candidate: IntervalsCandidate, runLogId: string) => void; onIgnore: (id: string) => void; onClearIgnored: () => void;
}

export function RunDataSheet(props: Props) {
  const [token, setToken] = useState(props.initialToken ?? "");
  const [connected, setConnected] = useState(Boolean(props.initialToken));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false);
  // Opened from Today with a run already chosen, or opened cold from the header.
  const [selected, setSelected] = useState<IntervalsCandidate | null>(props.initialReview?.candidate ?? null);
  const initialMatch = props.initialReview && !props.initialReview.asExtra
    ? suggestScheduledMatches(props.initialReview.candidate, props.state.plan, props.state.runLogs)[0]
    : undefined;
  const [workoutId, setWorkoutId] = useState<string | null>(initialMatch?.id ?? null);
  const [type, setType] = useState<RunActivityType>(initialMatch?.type && initialMatch.type !== "rest" ? initialMatch.type : "easy");
  const [effort, setEffort] = useState<Effort>("solid"); const [notes, setNotes] = useState("");

  /** A failure is worth reading and worth announcing; progress is not. */
  function report(text: string, isFailure = false) { setMessage(text); setFailed(isFailure); }
  /**
   * Connecting only proves the token. The first sync is left to the quiet one
   * that starts the moment a connection exists, so there is one path that
   * fetches activities rather than two that can disagree.
   */
  async function connect() {
    setBusy(true); report("");
    try {
      await fetchIntervals("status", token.trim());
      props.onConnect(token.trim());
      setConnected(true);
      report("Intervals.icu connected. Looking for runs…");
    } catch (error) {
      report(error instanceof Error ? error.message : "Connection failed.", true);
    } finally {
      setBusy(false);
    }
  }
  function review(candidate: IntervalsCandidate) { setSelected(candidate); const match = suggestScheduledMatches(candidate, props.state.plan, props.state.runLogs)[0]; setWorkoutId(match?.id ?? null); setType(match?.type && match.type !== "rest" ? match.type : "easy"); }
  function settle(candidate: IntervalsCandidate) { props.onSettle(candidate.externalId); setSelected(null); }
  function finish() {
    if (!selected) return;
    props.onImport(selected, workoutId, type, effort, notes);
    settle(selected);
    // The block is the reward, and it is earned the moment the run is real.
    report(`Run imported. You earned ${earnedBlockPhrase(type)}.`);
  }

  const workouts = selected ? suggestScheduledMatches(selected, props.state.plan, props.state.runLogs) : [];
  const manual = selected ? likelyManualMatches(selected, props.state.runLogs)[0] : undefined;
  const workout = workoutId ? workouts.find((item) => item.id === workoutId) : undefined;
  const status = props.syncError ?? message;
  return <Sheet title="Run Data" isOpen={props.isOpen} onClose={props.onClose}>
    <div className="run-data">
      {!connected ? <>
        <p className="run-data__copy">Connect STACK's read-only Intervals.icu sync. Enter the STACK sync token—not an Intervals API key.</p>
        <FormField label="STACK sync token"><input type="password" value={token} autoComplete="off" onChange={(event) => setToken(event.target.value)} /></FormField>
        <Button disabled={!token.trim()} isLoading={busy} icon={<Database size={18}/>} onClick={connect}>Test / Connect</Button>
      </> : <>
        <div className="run-data__status"><Database size={20}/><div><strong>Intervals.icu connected</strong><p>Last activity sync: {props.state.intervalsSync.lastSuccessfulActivitySyncAt ? new Date(props.state.intervalsSync.lastSuccessfulActivitySyncAt).toLocaleString() : "Not yet"}</p></div></div>
        <Button isLoading={props.isSyncing} icon={<RefreshCw size={18}/>} onClick={props.onSync}>Sync Now</Button>
        {!props.isSyncing && !props.candidates.length && !props.syncError && <p className="run-data__copy">No runs are waiting to be reviewed.</p>}
        {props.candidates.map((candidate) => <button className="run-data__candidate" key={candidate.externalId} onClick={() => review(candidate)}><strong>{formatMiles(candidate.distanceMiles)} mi</strong><span>{candidate.completedDate} · {formatDurationSeconds(candidate.durationSeconds)}</span></button>)}
        <Button variant="ghost" onClick={() => { props.onForget(); setConnected(false); setSelected(null); }}>Forget Connection</Button>
        <Button variant="ghost" disabled={!props.state.intervalsSync.ignoredActivityIds.length} onClick={props.onClearIgnored}>Clear Ignored Activities</Button>
      </>}
      {status && <p role={failed || props.syncError ? "alert" : "status"} className={failed || props.syncError ? "run-data__message run-data__message--failed" : "run-data__message"}>{status}</p>}
      {selected && <div className="run-data__review">
        <h3>Review synced run</h3><p>{selected.completedDate} · {formatMiles(selected.distanceMiles)} mi · {formatDurationSeconds(selected.durationSeconds)}</p>
        {manual && <><p>Possible manual run: {manual.completedDate}, {formatMiles(manual.distanceMiles)} mi, {formatDurationSeconds(manual.durationSeconds)}. Synced values above will replace date, distance and duration; effort, notes, workout link and block identity stay unchanged.</p><Button onClick={() => { props.onAttach(selected, manual.id); settle(selected); }}>Attach Synced Data</Button></>}
        <FormField label="Match"><select value={workoutId ?? ""} onChange={(event) => { const id = event.target.value || null; setWorkoutId(id); const chosen = workouts.find((item) => item.id === id); if (chosen && chosen.type !== "rest") setType(chosen.type); }}><option value="">Add as Extra Run</option>{workouts.map((item) => <option key={item.id} value={item.id}>{item.date} — {item.title}</option>)}</select></FormField>
        {workout && workout.date !== selected.completedDate && <p>Actual date {selected.completedDate}; planned date {workout.date}.</p>}
        {!workoutId && <FormField label="STACK activity type"><select value={type} onChange={(event) => setType(event.target.value as RunActivityType)}><option value="easy">Easy</option><option value="long">Long Run</option><option value="intervals">Intervals</option><option value="simulation">Simulation</option><option value="race">Race</option></select></FormField>}
        <FormField label="How did it feel?"><select value={effort} onChange={(event) => setEffort(event.target.value as Effort)}><option value="rough">Rough</option><option value="solid">Solid</option><option value="great">Great</option></select></FormField>
        <FormField label="Notes (optional)"><textarea value={notes} onChange={(event) => setNotes(event.target.value)}/></FormField>
        <Button onClick={finish}>{workoutId ? "Confirm Match" : "Add as Extra Run"}</Button>
        <Button variant="ghost" onClick={() => setSelected(null)}>Close suggestion</Button>
        <Button variant="ghost" onClick={() => { props.onIgnore(selected.externalId); settle(selected); }}>Ignore This Activity</Button>
      </div>}
    </div>
  </Sheet>;
}
