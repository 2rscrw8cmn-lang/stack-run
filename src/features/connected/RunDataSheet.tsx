import { Database, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import type { AppState, Effort, RunActivityType } from "../../domain/types";
import { todayLocalDate } from "../../domain/dates";
import { fetchIntervals, likelyManualMatches, normalizeActivityList, suggestScheduledMatches, type IntervalsCandidate } from "../../connected/intervals";

interface Props {
  isOpen: boolean; onClose: () => void; state: AppState; initialToken: string | null;
  onConnect: (token: string) => void; onForget: () => void; onSynced: (at: string) => void;
  onImport: (candidate: IntervalsCandidate, workoutId: string | null, type: RunActivityType, effort: Effort, notes: string) => void;
  onAttach: (candidate: IntervalsCandidate, runLogId: string) => void; onIgnore: (id: string) => void; onClearIgnored: () => void;
}

function dateBefore(today: string, days: number): string { const value = new Date(`${today}T12:00:00Z`); value.setUTCDate(value.getUTCDate() - days); return value.toISOString().slice(0, 10); }

export function RunDataSheet(props: Props) {
  const [token, setToken] = useState(props.initialToken ?? "");
  const [connected, setConnected] = useState(Boolean(props.initialToken));
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(""); const [failed, setFailed] = useState(false);
  const [candidates, setCandidates] = useState<IntervalsCandidate[]>([]);
  const [selected, setSelected] = useState<IntervalsCandidate | null>(null);
  const [workoutId, setWorkoutId] = useState<string | null>(null);
  const [type, setType] = useState<RunActivityType>("easy"); const [effort, setEffort] = useState<Effort>("solid"); const [notes, setNotes] = useState("");

  /** A failure is worth reading and worth announcing; progress is not. */
  function report(text: string, isFailure = false) { setMessage(text); setFailed(isFailure); }
  async function connect() { setBusy(true); report(""); try { await fetchIntervals("status", token.trim()); props.onConnect(token.trim()); setConnected(true); report("Intervals.icu connected."); await sync(true, token.trim()); } catch (error) { report(error instanceof Error ? error.message : "Connection failed.", true); } finally { setBusy(false); } }
  async function sync(first = false, credential = token) { setBusy(true); report(""); try { const newest = todayLocalDate(); const raw = await fetchIntervals("activities", credential, { oldest: dateBefore(newest, first || !props.state.intervalsSync.lastSuccessfulActivitySyncAt ? 90 : 14), newest }); const normalized = normalizeActivityList(raw, props.state.runLogs, props.state.intervalsSync.ignoredActivityIds); setCandidates(normalized); const at = new Date().toISOString(); props.onSynced(at); report(normalized.length ? `${normalized.length} run ${normalized.length === 1 ? "is" : "are"} ready to review.` : "Sync complete. No new runs found."); } catch (error) { report(error instanceof Error ? error.message : "Sync failed.", true); } finally { setBusy(false); } }
  function review(candidate: IntervalsCandidate) { setSelected(candidate); const match = suggestScheduledMatches(candidate, props.state.plan, props.state.runLogs)[0]; setWorkoutId(match?.id ?? null); setType(match?.type && match.type !== "rest" ? match.type : "easy"); }
  function finish() { if (!selected) return; props.onImport(selected, workoutId, type, effort, notes); setCandidates((all) => all.filter((item) => item.externalId !== selected.externalId)); setSelected(null); }

  const workouts = selected ? suggestScheduledMatches(selected, props.state.plan, props.state.runLogs) : [];
  const manual = selected ? likelyManualMatches(selected, props.state.runLogs)[0] : undefined;
  const workout = workoutId ? workouts.find((item) => item.id === workoutId) : undefined;
  return <Sheet title="Run Data" isOpen={props.isOpen} onClose={props.onClose}>
    <div className="run-data">
      {!connected ? <>
        <p className="run-data__copy">Connect STACK's read-only Intervals.icu sync. Enter the STACK sync token—not an Intervals API key.</p>
        <FormField label="STACK sync token"><input type="password" value={token} autoComplete="off" onChange={(event) => setToken(event.target.value)} /></FormField>
        <Button disabled={!token.trim()} isLoading={busy} icon={<Database size={18}/>} onClick={connect}>Test / Connect</Button>
      </> : <>
        <div className="run-data__status"><Database size={20}/><div><strong>Intervals.icu connected</strong><p>Last activity sync: {props.state.intervalsSync.lastSuccessfulActivitySyncAt ? new Date(props.state.intervalsSync.lastSuccessfulActivitySyncAt).toLocaleString() : "Not yet"}</p></div></div>
        <Button isLoading={busy} icon={<RefreshCw size={18}/>} onClick={() => sync(false)}>Sync Now</Button>
        {candidates.map((candidate) => <button className="run-data__candidate" key={candidate.externalId} onClick={() => review(candidate)}><strong>{candidate.distanceMiles.toFixed(2)} mi</strong><span>{candidate.completedDate} · {Math.round(candidate.durationSeconds / 60)} min</span></button>)}
        <Button variant="ghost" onClick={() => { props.onForget(); setConnected(false); setCandidates([]); }}>Forget Connection</Button>
        <Button variant="ghost" disabled={!props.state.intervalsSync.ignoredActivityIds.length} onClick={props.onClearIgnored}>Clear Ignored Activities</Button>
      </>}
      {message && <p role={failed ? "alert" : "status"} className={failed ? "run-data__message run-data__message--failed" : "run-data__message"}>{message}</p>}
      {selected && <div className="run-data__review">
        <h3>Review synced run</h3><p>{selected.completedDate} · {selected.distanceMiles.toFixed(2)} mi · {Math.round(selected.durationSeconds / 60)} min</p>
        {manual && <><p>Possible manual run: {manual.completedDate}, {manual.distanceMiles.toFixed(2)} mi, {Math.round(manual.durationSeconds / 60)} min. Synced values above will replace date, distance and duration; effort, notes, workout link and block identity stay unchanged.</p><Button onClick={() => { props.onAttach(selected, manual.id); setCandidates((all) => all.filter((item) => item.externalId !== selected.externalId)); setSelected(null); }}>Attach Synced Data</Button></>}
        <FormField label="Match"><select value={workoutId ?? ""} onChange={(event) => { const id = event.target.value || null; setWorkoutId(id); const chosen = workouts.find((item) => item.id === id); if (chosen && chosen.type !== "rest") setType(chosen.type); }}><option value="">Add as Extra Run</option>{workouts.map((item) => <option key={item.id} value={item.id}>{item.date} — {item.title}</option>)}</select></FormField>
        {workout && workout.date !== selected.completedDate && <p>Actual date {selected.completedDate}; planned date {workout.date}.</p>}
        {!workoutId && <FormField label="STACK activity type"><select value={type} onChange={(event) => setType(event.target.value as RunActivityType)}><option value="easy">Easy</option><option value="long">Long Run</option><option value="intervals">Intervals</option><option value="simulation">Simulation</option><option value="race">Race</option></select></FormField>}
        <FormField label="How did it feel?"><select value={effort} onChange={(event) => setEffort(event.target.value as Effort)}><option value="rough">Rough</option><option value="solid">Solid</option><option value="great">Great</option></select></FormField>
        <FormField label="Notes (optional)"><textarea value={notes} onChange={(event) => setNotes(event.target.value)}/></FormField>
        <Button onClick={finish}>{workoutId ? "Confirm Match" : "Add as Extra Run"}</Button>
        <Button variant="ghost" onClick={() => setSelected(null)}>Close suggestion</Button>
        <Button variant="ghost" onClick={() => { props.onIgnore(selected.externalId); setCandidates((all) => all.filter((item) => item.externalId !== selected.externalId)); setSelected(null); }}>Ignore This Activity</Button>
      </div>}
    </div>
  </Sheet>;
}
