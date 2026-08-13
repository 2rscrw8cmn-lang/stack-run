import type { ImportedRunMetrics, RunLog, TrainingPlan, Workout } from "../domain/types";
import { daysBetweenLocalDates } from "../domain/dates";

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
/**
 * Imported distance is rounded where it enters STACK rather than at each place
 * it is shown. A converted distance is a float with fifteen decimals behind
 * it; STACK's own runs carry the two a person types, every screen prints the
 * stored number, and the edit sheet puts it back in a text field. Two decimals
 * is sixteen metres, which is below what a watch can tell you anyway.
 */
const MILE_DECIMALS = 2;
/** Intervals' canonical running activity type. Add source-verified aliases here only. */
export const VERIFIED_RUNNING_TYPES = new Set(["Run"]);

export type IntervalsConnection =
  | { mode: "legacy-proxy"; credential: string }
  | { mode: "local-api-key"; credential: string };

/** Existing callers/tests pass the legacy token as a string. */
type IntervalsConnectionInput = IntervalsConnection | string;

function connectionFrom(input: IntervalsConnectionInput): IntervalsConnection {
  return typeof input === "string"
    ? { mode: "legacy-proxy", credential: input }
    : input;
}

/** Exported so the fake-key test can verify the exact Intervals auth contract. */
export function intervalsBasicAuthorization(apiKey: string): string {
  return `Basic ${btoa(`API_KEY:${apiKey.trim()}`)}`;
}

export interface IntervalsCandidate {
  externalId: string;
  sourceType: string;
  completedDate: string;
  distanceMiles: number;
  durationSeconds: number;
  sourceUpdatedAt: string | null;
  metrics: ImportedRunMetrics;
}

export interface IntervalsActivityInterval {
  label: string;
  distanceMiles?: number;
  durationSeconds: number;
  averageHeartRate?: number;
}

export interface IntervalsActivityDetail {
  intervals: IntervalsActivityInterval[];
}

/**
 * One sample of the run over elapsed time. Every field but `timeSeconds` is
 * optional: a sample carries whatever stream actually had a value at that
 * index, never a guessed or interpolated one.
 *
 * `cadence` is carried in **whatever number Intervals reports, unconverted**.
 * The August 13 HealthFit-originated activity reports an overall cadence of
 * 79 with interval rows of 79/79/80, which is the value Intervals itself
 * displays. STACK does not double it into a steps-per-minute figure and does
 * not attach a unit it has not verified: the only source-verified fact is the
 * number, so the number is what is shown. See
 * `docs/CONNECTED_DATA_FIELDS.md`.
 */
export interface IntervalsRunProfileSample {
  timeSeconds: number;
  paceSecondsPerMile?: number;
  heartRate?: number;
  elevationFeet?: number;
  cadence?: number;
}

export interface IntervalsRunProfile {
  samples: IntervalsRunProfileSample[];
}

function positive(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}
function nonnegative(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : undefined;
}
function miles(meters: number): number {
  return Number((meters / METERS_PER_MILE).toFixed(MILE_DECIMALS));
}
function date(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const local = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(local)) return null;
  const parsed = new Date(`${local}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === local ? local : null;
}

export function normalizeIntervalsActivity(raw: unknown): IntervalsCandidate | null {
  if (!raw || typeof raw !== "object") return null;
  const activity = raw as Record<string, unknown>;
  const externalId = typeof activity.id === "string" || typeof activity.id === "number" ? String(activity.id) : "";
  const sourceType = typeof activity.type === "string" ? activity.type : "";
  const completedDate = date(activity.start_date_local);
  const meters = positive(activity.distance);
  const moving = positive(activity.moving_time);
  const elapsed = positive(activity.elapsed_time);
  if (!externalId || !VERIFIED_RUNNING_TYPES.has(sourceType) || !completedDate || !meters || (!moving && !elapsed)) return null;

  const metrics: ImportedRunMetrics = {};
  const averageHeartRate = positive(activity.average_heartrate);
  const maxHeartRate = positive(activity.max_heartrate);
  const averageCadence = positive(activity.average_cadence);
  const elevationMeters = positive(activity.total_elevation_gain);
  const trainingLoad = positive(activity.icu_training_load);
  if (averageHeartRate) metrics.averageHeartRate = averageHeartRate;
  if (maxHeartRate) metrics.maxHeartRate = maxHeartRate;
  if (averageCadence) metrics.averageCadence = averageCadence;
  if (elevationMeters) metrics.elevationGainFeet = elevationMeters * FEET_PER_METER;
  if (trainingLoad) metrics.trainingLoad = trainingLoad;
  if (moving && elapsed) metrics.elapsedTimeSeconds = Math.round(elapsed);
  if (Array.isArray(activity.icu_hr_zone_times)) {
    const zones = activity.icu_hr_zone_times.map(nonnegative);
    if (zones.length > 0 && zones.every((zone): zone is number => zone !== undefined) && zones.some((zone) => zone > 0)) metrics.hrZoneSeconds = zones;
  }
  return { externalId, sourceType, completedDate, distanceMiles: miles(meters), durationSeconds: Math.round(moving ?? elapsed!), sourceUpdatedAt: typeof activity.updated === "string" ? activity.updated : null, metrics };
}

/**
 * Detail is deliberately much narrower than the upstream response. A row is
 * useful only when Intervals supplies an explicit, human-readable grouping
 * and a positive duration; detected fragments without a name stay omitted.
 */
export function normalizeIntervalsActivityDetail(raw: unknown): IntervalsActivityDetail {
  if (!raw || typeof raw !== "object") return { intervals: [] };
  const source = (raw as Record<string, unknown>).icu_intervals;
  if (!Array.isArray(source)) return { intervals: [] };
  const intervals = source.flatMap((value): IntervalsActivityInterval[] => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const labelValue = item.name ?? item.label;
    const label = typeof labelValue === "string" ? labelValue.trim() : "";
    const duration = positive(item.moving_time) ?? positive(item.elapsed_time);
    if (!label || !duration) return [];
    const distanceMeters = positive(item.distance);
    const averageHeartRate = positive(item.average_heartrate);
    return [{
      label,
      durationSeconds: Math.round(duration),
      ...(distanceMeters ? { distanceMiles: miles(distanceMeters) } : {}),
      ...(averageHeartRate ? { averageHeartRate } : {}),
    }];
  });
  return { intervals };
}

/**
 * Finds one named stream's raw sample array inside an upstream streams
 * response, tolerant of the shapes a REST streams endpoint plausibly answers
 * with — an array of `{ type, data }` descriptors, or a map keyed by stream
 * name whose value is either the array itself or `{ data: [...] }`.
 *
 * Returns `undefined` rather than guessing when nothing matches, which is the
 * whole point: this file never invents a shape it has not actually seen.
 */
function rawStream(source: unknown, names: readonly string[]): unknown[] | undefined {
  if (Array.isArray(source)) {
    for (const entry of source) {
      if (!entry || typeof entry !== "object") continue;
      const record = entry as Record<string, unknown>;
      const type = record.type ?? record.stream_type ?? record.name;
      if (typeof type === "string" && names.includes(type) && Array.isArray(record.data)) return record.data;
    }
    return undefined;
  }
  if (source && typeof source === "object") {
    const record = source as Record<string, unknown>;
    for (const name of names) {
      const value = record[name];
      if (Array.isArray(value)) return value;
      if (value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).data)) {
        return (value as Record<string, unknown>).data as unknown[];
      }
    }
  }
  return undefined;
}

/** A same-length numeric array, or `undefined` if the stream is missing/short. */
function numericSamples(source: unknown, names: readonly string[], sampleCount: number): (number | undefined)[] | undefined {
  const raw = rawStream(source, names);
  if (!raw || raw.length !== sampleCount) return undefined;
  return raw.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined));
}

const METERS_PER_SECOND_MINIMUM = 0.1;

/**
 * The activity-detail endpoint's per-second streams, narrowed to what
 * `RunProfileChart` can plot honestly: pace derived from `velocity_smooth`
 * (metres/second, an unambiguous unit), heart rate, elevation, and cadence.
 *
 * **Status: `Expected`, not `Verified`** — see `docs/CONNECTED_DATA_FIELDS.md`.
 * The stream endpoint and field names below follow Intervals.icu's documented
 * `/activity/{id}/streams` contract. The August 13 real-device review
 * confirmed the *summary* aggregates this feature leans on — pace, average
 * and max HR, elevation gain and cadence — but the per-sample stream shapes
 * themselves still need checking against a real payload, so this normalizer
 * stays deliberately conservative: a shape it does not recognize yields
 * `null` rather than a guess, and the caller shows no Run Profile chart at
 * all, exactly what happens for a run with no profile data today.
 *
 * Nothing here is used to compute a summary statistic. Streams give the
 * *shape* of the run; the numbers stated beside them come from the imported
 * activity aggregates, which are the source's own answer and the one that
 * agrees with what Intervals and HealthFit show the runner.
 */
export function normalizeIntervalsRunProfile(raw: unknown): IntervalsRunProfile | null {
  if (!raw || typeof raw !== "object") return null;
  const time = rawStream(raw, ["time"]);
  if (!Array.isArray(time) || time.length < 2) return null;
  const timeSeconds = time.map((value) => (typeof value === "number" && Number.isFinite(value) ? value : undefined));
  if (timeSeconds.some((value) => value === undefined)) return null;

  const heartRate = numericSamples(raw, ["heartrate", "heart_rate"], time.length);
  const elevationMeters = numericSamples(raw, ["altitude"], time.length);
  const velocity = numericSamples(raw, ["velocity_smooth", "velocity"], time.length);
  const cadence = numericSamples(raw, ["cadence"], time.length);

  const samples: IntervalsRunProfileSample[] = (timeSeconds as number[]).map((value, index) => {
    const speed = velocity?.[index];
    const elevation = elevationMeters?.[index];
    const hr = heartRate?.[index];
    const steps = cadence?.[index];
    return {
      timeSeconds: value,
      ...(speed !== undefined && speed >= METERS_PER_SECOND_MINIMUM ? { paceSecondsPerMile: METERS_PER_MILE / speed } : {}),
      ...(hr !== undefined && hr > 0 ? { heartRate: hr } : {}),
      ...(elevation !== undefined ? { elevationFeet: elevation * FEET_PER_METER } : {}),
      // Verbatim. A zero here means the runner was standing still rather than
      // turning their legs over zero times a minute, so it is left out the
      // same way a near-stopped velocity yields no pace — the chart then
      // draws a gap instead of a plunge to the floor.
      ...(steps !== undefined && steps > 0 ? { cadence: steps } : {}),
    };
  });

  const hasProfile = samples.some((sample) =>
    sample.paceSecondsPerMile !== undefined || sample.heartRate !== undefined ||
    sample.elevationFeet !== undefined || sample.cadence !== undefined);
  return hasProfile ? { samples } : null;
}

/**
 * The stream types STACK asks Intervals for.
 *
 * `cadence` joined the list once the August 13 activity established what the
 * source actually reports — 79, the same figure Intervals shows — so STACK
 * had a verified convention to present rather than a guessed one.
 */
export const RUN_PROFILE_STREAM_TYPES = ["time", "heartrate", "altitude", "velocity_smooth", "cadence"] as const;

/**
 * The activity ids STACK has already settled: imported, attached or ignored.
 * Everything else that has ever been discovered is still the user's to review.
 */
function settledActivityIds(runLogs: readonly RunLog[], ignoredIds: readonly string[]): Set<string> {
  return new Set([...ignoredIds, ...runLogs.flatMap((run) => run.externalSource?.provider === "intervals" ? [run.externalSource.activityId] : [])]);
}

/**
 * Drops candidates that are no longer anybody's decision to make, and any
 * duplicate of an external id. Applied to a stored queue as well as a fresh
 * read, so a run imported on this device never comes back from either.
 */
export function unresolvedCandidates(candidates: readonly IntervalsCandidate[], runLogs: readonly RunLog[], ignoredIds: readonly string[]): IntervalsCandidate[] {
  const settled = settledActivityIds(runLogs, ignoredIds);
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    if (settled.has(candidate.externalId) || seen.has(candidate.externalId)) return false;
    seen.add(candidate.externalId);
    return true;
  });
}

/**
 * The unresolved queue after a read, which is a merge and never a replacement.
 *
 * A rolling window says what changed lately; it does not say what is still
 * waiting. Anything already pending stays pending, a re-read activity refreshes
 * its snapshot in place under the same external id, and newly discovered runs
 * join the queue. Newest first, so the review list reads like the run log.
 */
export function mergeCandidates(existing: readonly IntervalsCandidate[], fetched: readonly IntervalsCandidate[]): IntervalsCandidate[] {
  const byId = new Map(existing.map((candidate) => [candidate.externalId, candidate]));
  // The network snapshot is the newer truth for distance, duration and metrics.
  for (const candidate of fetched) byId.set(candidate.externalId, candidate);
  return [...byId.values()].sort((a, b) =>
    b.completedDate.localeCompare(a.completedDate) || a.externalId.localeCompare(b.externalId));
}

export function normalizeActivityList(raw: unknown, runLogs: readonly RunLog[], ignoredIds: readonly string[]): IntervalsCandidate[] {
  if (!Array.isArray(raw)) return [];
  return unresolvedCandidates(raw.flatMap((item) => normalizeIntervalsActivity(item) ?? []), runLogs, ignoredIds);
}

function targetDistance(workout: Workout): { low: number; high: number } | null {
  const value = workout.targetDistanceMiles?.trim();
  if (!value) return null;
  const match = /^(\d+(?:\.\d+)?)\s*(?:-\s*(\d+(?:\.\d+)?))?$/.exec(value);
  if (!match) return null;
  const low = Number(match[1]);
  const high = Number(match[2] ?? match[1]);
  return low > 0 && high >= low ? { low, high } : null;
}

/** How far from the run a planned date can be before a match is a guess. */
const SUGGESTION_WITHIN_DAYS = 2;

/**
 * Every scheduled workout this run could legitimately be, ordered by how
 * likely it is.
 *
 * This is the manual choice set, not the automatic one. Plans move: a runner
 * does Saturday's long run on Thursday, shifts a week around a work trip, or
 * connects Intervals and imports a month of history into a plan built after
 * the fact. `suggestScheduledMatches` answers "what would STACK pick", and
 * outside its two-day window it correctly picks nothing — but the user still
 * has to be able to say what actually happened, so nothing is hidden here for
 * merely being unlikely.
 *
 * The one thing this does exclude is a workout another run already satisfies.
 * One scheduled workout links to at most one RunLog, and that stays true.
 */
export function availableScheduledMatches(candidate: IntervalsCandidate, plan: TrainingPlan, runLogs: readonly RunLog[]): Workout[] {
  const matched = new Set(runLogs.flatMap((run) => run.workoutId ? [run.workoutId] : []));
  return plan.weeks
    .flatMap((week) => week.workouts)
    .filter((workout) => workout.type !== "rest" && !matched.has(workout.id))
    .sort((a, b) =>
      Math.abs(daysBetweenLocalDates(a.date, candidate.completedDate)) - Math.abs(daysBetweenLocalDates(b.date, candidate.completedDate)) ||
      a.date.localeCompare(b.date) ||
      a.id.localeCompare(b.id));
}

/**
 * The workouts STACK is confident enough about to choose for the user.
 *
 * Deliberately narrow: this drives the default selection and the match Today
 * offers on the Run Found card. The full manual list is
 * `availableScheduledMatches`.
 */
export function suggestScheduledMatches(candidate: IntervalsCandidate, plan: TrainingPlan, runLogs: readonly RunLog[]): Workout[] {
  const matched = new Set(runLogs.flatMap((run) => run.workoutId ? [run.workoutId] : []));
  return plan.weeks.flatMap((week) => week.workouts).filter((workout) => workout.type !== "rest" && !matched.has(workout.id) && Math.abs(daysBetweenLocalDates(workout.date, candidate.completedDate)) <= SUGGESTION_WITHIN_DAYS).sort((a, b) => {
    const dateDiff = Math.abs(daysBetweenLocalDates(a.date, candidate.completedDate)) - Math.abs(daysBetweenLocalDates(b.date, candidate.completedDate));
    if (dateDiff) return dateDiff;
    const score = (workout: Workout) => { const target = targetDistance(workout); return target ? candidate.distanceMiles < target.low ? target.low - candidate.distanceMiles : candidate.distanceMiles > target.high ? candidate.distanceMiles - target.high : 0 : Number.POSITIVE_INFINITY; };
    return score(a) - score(b) || a.date.localeCompare(b.date) || a.id.localeCompare(b.id);
  });
}

/**
 * How recent a synced run has to be before Today offers to deal with it.
 *
 * Today is a dashboard for now, not an inbox for everything sync found. A run
 * from last week is real and still waiting in Run Data; putting it above the
 * workout the user is about to do would be answering a question nobody asked.
 */
const RUN_FOUND_WITHIN_DAYS = 3;

export interface RunFound {
  candidate: IntervalsCandidate;
  /** The scheduled workout it most likely belongs to, when there is one. */
  workout: Workout | null;
}

/**
 * The one synced run Today should offer, if any.
 *
 * The newest candidate wins, and a run that matches a scheduled workout wins
 * over one that does not on the same day — confirming a match is the move that
 * completes the plan, and it is the one more likely to be right.
 */
export function selectRunFound(
  candidates: readonly IntervalsCandidate[],
  plan: TrainingPlan,
  runLogs: readonly RunLog[],
  today: string,
): RunFound | null {
  const recent = candidates
    .filter((candidate) => {
      const age = daysBetweenLocalDates(candidate.completedDate, today);
      return age >= 0 && age <= RUN_FOUND_WITHIN_DAYS;
    })
    .map((candidate) => ({ candidate, workout: suggestScheduledMatches(candidate, plan, runLogs)[0] ?? null }))
    .sort((a, b) =>
      b.candidate.completedDate.localeCompare(a.candidate.completedDate) ||
      Number(Boolean(b.workout)) - Number(Boolean(a.workout)) ||
      a.candidate.externalId.localeCompare(b.candidate.externalId));

  return recent[0] ?? null;
}

export function likelyManualMatches(candidate: IntervalsCandidate, runLogs: readonly RunLog[]): RunLog[] {
  return runLogs.filter((run) => run.source === "manual" && Math.abs(daysBetweenLocalDates(run.completedDate, candidate.completedDate)) <= 1 && Math.abs(run.distanceMiles - candidate.distanceMiles) <= Math.max(0.5, candidate.distanceMiles * 0.1));
}

/**
 * What a failed read is called on screen.
 *
 * Everything below exists because "Run Data could not be reached" was the only
 * thing the app said about a missing deployment secret, a reader that was
 * never deployed, an Intervals key the server had rejected and an argument
 * STACK itself got wrong. Four different jobs, one sentence, none of them
 * doable from a phone. The reader answers with a code for each; this turns
 * every one of them into the thing to go and fix.
 */
type ReadContext = "sync" | "detail";

const CONTEXT_FAILURE: Record<ReadContext, string> = {
  sync: "Run Data could not be reached",
  detail: "Run detail could not be loaded",
};

/** Said for both the 404 and the 200-that-is-really-the-app's-own-HTML. */
const NO_READER: Record<ReadContext, string> = {
  sync: `${CONTEXT_FAILURE.sync}: this deployment has no /api/intervals reader. Redeploy STACK so the Run Data function ships with the app.`,
  detail: `${CONTEXT_FAILURE.detail}: this deployment has no /api/intervals reader. Redeploy STACK so the Run Data function ships with the app.`,
};

interface ReaderError {
  error?: unknown;
  message?: unknown;
  missing?: unknown;
  upstreamStatus?: unknown;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The reader's error body, or null when the response is not one of its own. */
async function readerError(response: Response): Promise<ReaderError | null> {
  try {
    const body: unknown = await response.json();
    return body && typeof body === "object" ? (body as ReaderError) : null;
  } catch {
    return null;
  }
}

async function describeFailure(response: Response, context: ReadContext): Promise<string> {
  const body = await readerError(response);
  const rateLimited = context === "sync"
    ? "Intervals.icu is rate limiting sync. Try again later."
    : "Intervals.icu is rate limiting detail requests. Try again later.";

  switch (text(body?.error)) {
    case "not_configured":
      return `Run Data is not configured on the server. Set ${text(body?.missing) ?? "INTERVALS_API_KEY and STACK_SYNC_TOKEN"} in the Vercel project, then redeploy.`;
    case "unauthorized":
      return "That sync token was not accepted. It has to match STACK_SYNC_TOKEN in Vercel exactly.";
    case "rate_limited":
      return rateLimited;
    case "upstream_authorization_failed":
      return "Intervals.icu rejected STACK's API key. Check INTERVALS_API_KEY in Vercel.";
    case "upstream_unavailable":
      return "Intervals.icu could not be reached. Try again shortly.";
    case "upstream_timeout":
      return "Intervals.icu took too long to answer. Try again shortly.";
    case "upstream_rejected_request":
      return `Intervals.icu refused that request${typeof body?.upstreamStatus === "number" ? ` (${body.upstreamStatus})` : ""}.`;
    case "invalid_date_range":
    case "invalid_activity_id":
    case "invalid_resource":
    case "method_not_allowed":
      return `${CONTEXT_FAILURE[context]}: STACK asked the Run Data reader for something it does not serve.`;
  }

  // No code, so this is not the reader answering. The status is all there is.
  if (response.status === 401) return "That sync token was not accepted. It has to match STACK_SYNC_TOKEN in Vercel exactly.";
  if (response.status === 429) return rateLimited;
  if (response.status === 404) return NO_READER[context];
  return `${CONTEXT_FAILURE[context]} (HTTP ${response.status}${text(body?.message) ? `: ${text(body?.message)}` : ""}).`;
}

async function read(params: URLSearchParams, token: string, context: ReadContext): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`/api/intervals?${params}`, { headers: { "X-Stack-Sync-Token": token.trim() }, cache: "no-store" });
  } catch {
    // The request never arrived, which is a different problem from any answer.
    throw new Error(`${CONTEXT_FAILURE[context]}. Check this device's connection and try again.`);
  }
  if (!response.ok) throw new Error(await describeFailure(response, context));
  try {
    return await response.json();
  } catch {
    /**
     * A 200 that is not JSON is a static host answering `/api/intervals` with
     * the app's own HTML, which is what an undeployed function looks like from
     * here. Left alone it reaches the screen as `Unexpected token '<'`, which
     * names a parser rather than the thing to go and fix.
     */
    throw new Error(NO_READER[context]);
  }
}

type IntervalsResource = "status" | "activities" | "activity" | "activity-streams";

function directUrl(
  resource: IntervalsResource,
  range?: { oldest: string; newest: string },
  activityId?: string,
): string {
  if (resource === "activity") {
    return `https://intervals.icu/api/v1/activity/${encodeURIComponent(activityId ?? "")}?intervals=true`;
  }
  if (resource === "activity-streams") {
    return `https://intervals.icu/api/v1/activity/${encodeURIComponent(activityId ?? "")}/streams?types=${RUN_PROFILE_STREAM_TYPES.join(",")}`;
  }
  const directRange = range ?? (() => {
    const today = new Date().toISOString().slice(0, 10);
    return { oldest: today, newest: today };
  })();
  const query = new URLSearchParams(directRange);
  return `https://intervals.icu/api/v1/athlete/0/activities?${query}`;
}

async function readDirect(
  resource: IntervalsResource,
  apiKey: string,
  context: ReadContext,
  range?: { oldest: string; newest: string },
  activityId?: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(directUrl(resource, range, activityId), {
      headers: { Authorization: intervalsBasicAuthorization(apiKey) },
      cache: "no-store",
    });
  } catch {
    throw new Error(
      `${CONTEXT_FAILURE[context]}. Check this device's connection and browser access to Intervals.icu.`,
    );
  }
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        "Intervals.icu did not accept that personal API key. Copy a new key from Developer Settings and try again.",
      );
    }
    if (response.status === 429) {
      throw new Error("Intervals.icu is rate limiting requests. Try again later.");
    }
    throw new Error(`${CONTEXT_FAILURE[context]} (HTTP ${response.status}).`);
  }
  try {
    return await response.json();
  } catch {
    throw new Error(`${CONTEXT_FAILURE[context]}: Intervals.icu returned an unreadable response.`);
  }
}

export async function fetchIntervals(resource: "status" | "activities", connectionInput: IntervalsConnectionInput, range?: { oldest: string; newest: string }): Promise<unknown> {
  const connection = connectionFrom(connectionInput);
  if (connection.mode === "local-api-key") {
    return readDirect(resource, connection.credential, "sync", range);
  }
  const params = new URLSearchParams({ resource });
  if (range) { params.set("oldest", range.oldest); params.set("newest", range.newest); }
  return read(params, connection.credential, "sync");
}

export async function fetchIntervalsActivityDetail(activityId: string, connectionInput: IntervalsConnectionInput): Promise<IntervalsActivityDetail> {
  const connection = connectionFrom(connectionInput);
  if (connection.mode === "local-api-key") {
    return normalizeIntervalsActivityDetail(
      await readDirect("activity", connection.credential, "detail", undefined, activityId),
    );
  }
  const params = new URLSearchParams({ resource: "activity", id: activityId, intervals: "true" });
  return normalizeIntervalsActivityDetail(await read(params, connection.credential, "detail"));
}

/**
 * The Run Profile's per-second streams, fetched only when a synced run's
 * detail sheet is open — never during ordinary sync. See
 * `normalizeIntervalsRunProfile` for the field-verification caveat: a shape
 * this normalizer does not recognize resolves to `null`, and callers are
 * expected to render nothing rather than surface that as an error, exactly
 * like a run with no profile data at all.
 */
export async function fetchIntervalsRunProfile(activityId: string, connectionInput: IntervalsConnectionInput): Promise<IntervalsRunProfile | null> {
  const connection = connectionFrom(connectionInput);
  if (connection.mode === "local-api-key") {
    return normalizeIntervalsRunProfile(
      await readDirect("activity-streams", connection.credential, "detail", undefined, activityId),
    );
  }
  const params = new URLSearchParams({ resource: "activity-streams", id: activityId });
  return normalizeIntervalsRunProfile(await read(params, connection.credential, "detail"));
}
