import type { ImportedRunMetrics, RunLog, TrainingPlan, Workout } from "../domain/types";
import { daysBetweenLocalDates } from "../domain/dates";

const METERS_PER_MILE = 1609.344;
const FEET_PER_METER = 3.28084;
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
  return { externalId, sourceType, completedDate, distanceMiles: meters / METERS_PER_MILE, durationSeconds: Math.round(moving ?? elapsed!), sourceUpdatedAt: typeof activity.updated === "string" ? activity.updated : null, metrics };
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
      ...(distanceMeters ? { distanceMiles: distanceMeters / METERS_PER_MILE } : {}),
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

export function likelyManualMatches(candidate: IntervalsCandidate, runLogs: readonly RunLog[]): RunLog[] {
  return runLogs.filter((run) => run.source === "manual" && Math.abs(daysBetweenLocalDates(run.completedDate, candidate.completedDate)) <= 1 && Math.abs(run.distanceMiles - candidate.distanceMiles) <= Math.max(0.5, candidate.distanceMiles * 0.1));
}

export async function fetchIntervals(resource: "status" | "activities", token: string, range?: { oldest: string; newest: string }): Promise<unknown> {
  const params = new URLSearchParams({ resource });
  if (range) { params.set("oldest", range.oldest); params.set("newest", range.newest); }
  const response = await fetch(`/api/intervals?${params}`, { headers: { "X-Stack-Sync-Token": token }, cache: "no-store" });
  if (!response.ok) throw new Error(response.status === 401 ? "That sync token was not accepted." : response.status === 429 ? "Intervals.icu is rate limiting sync. Try again later." : "Run Data could not be reached.");
  return response.json();
}


export async function fetchIntervalsActivityDetail(activityId: string, token: string): Promise<IntervalsActivityDetail> {
  const params = new URLSearchParams({ resource: "activity", id: activityId, intervals: "true" });
  const response = await fetch(`/api/intervals?${params}`, { headers: { "X-Stack-Sync-Token": token }, cache: "no-store" });
  if (!response.ok) {
    throw new Error(response.status === 429
      ? "Intervals.icu is rate limiting detail requests. Try again later."
      : "Run detail could not be loaded.");
  }
  return normalizeIntervalsActivityDetail(await response.json());
}
