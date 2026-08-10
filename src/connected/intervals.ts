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

export function normalizeActivityList(raw: unknown, runLogs: readonly RunLog[], ignoredIds: readonly string[]): IntervalsCandidate[] {
  if (!Array.isArray(raw)) return [];
  const unavailable = new Set([...ignoredIds, ...runLogs.flatMap((run) => run.externalSource?.provider === "intervals" ? [run.externalSource.activityId] : [])]);
  const seen = new Set<string>();
  return raw.flatMap((item) => {
    const candidate = normalizeIntervalsActivity(item);
    if (!candidate || unavailable.has(candidate.externalId) || seen.has(candidate.externalId)) return [];
    seen.add(candidate.externalId);
    return [candidate];
  });
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

export function suggestScheduledMatches(candidate: IntervalsCandidate, plan: TrainingPlan, runLogs: readonly RunLog[]): Workout[] {
  const matched = new Set(runLogs.flatMap((run) => run.workoutId ? [run.workoutId] : []));
  return plan.weeks.flatMap((week) => week.workouts).filter((workout) => workout.type !== "rest" && !matched.has(workout.id) && Math.abs(daysBetweenLocalDates(workout.date, candidate.completedDate)) <= 2).sort((a, b) => {
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

export async function fetchIntervals(resource: "status" | "activities", token: string, range?: { oldest: string; newest: string }): Promise<unknown> {
  const params = new URLSearchParams({ resource });
  if (range) { params.set("oldest", range.oldest); params.set("newest", range.newest); }
  return read(params, token, "sync");
}

export async function fetchIntervalsActivityDetail(activityId: string, token: string): Promise<IntervalsActivityDetail> {
  const params = new URLSearchParams({ resource: "activity", id: activityId, intervals: "true" });
  return normalizeIntervalsActivityDetail(await read(params, token, "detail"));
}
