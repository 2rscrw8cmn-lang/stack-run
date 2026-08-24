import { VERIFIED_CROSS_TRAINING_TYPES, VERIFIED_RUNNING_TYPES } from "../connected/intervals";
import type { HistoricalActivity } from "../history/historicalActivity";
import { compareHistoricalActivities } from "../history/historicalActivity";
import { StorageWriteError } from "./appStateRepository";
import { HISTORICAL_ACTIVITIES_STORAGE_KEY } from "./storageKeys";

/**
 * The runner's normalized historical activity history, kept outside schema-9
 * AppState.
 *
 * Outside AppState for the same reasons the Run Data review queue is: it is not
 * part of the plan/Build/run-log state a backup restores, it is regenerable
 * from the source, and keeping it separate means introducing it costs no
 * AppState migration and cannot corrupt one.
 *
 * What is stored is the Tier 1 summary and nothing else. Every write goes
 * through `storedActivity` below, which builds the record key by key from an
 * explicit allowlist, so a raw Intervals payload, a GPS track, a stream array
 * or a credential cannot reach this slot even if a caller hands one in.
 */

function storageKey(accountId: string | null): string {
  return accountId
    ? `${HISTORICAL_ACTIVITIES_STORAGE_KEY}.${encodeURIComponent(accountId)}`
    : HISTORICAL_ACTIVITIES_STORAGE_KEY;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function zonesOrNull(value: unknown): number[] | null {
  return Array.isArray(value) && value.length > 0 && value.every((zone) => typeof zone === "number" && Number.isFinite(zone))
    ? [...(value as number[])]
    : null;
}

/**
 * The exact shape that reaches storage.
 *
 * Written field by field rather than spread: a spread would carry whatever
 * else happened to be on the object, and "whatever else" is precisely the raw
 * source payload this phase is not allowed to persist.
 */
function storedActivity(activity: HistoricalActivity): HistoricalActivity {
  return {
    provider: "intervals",
    sourceId: activity.sourceId,
    startDateLocal: activity.startDateLocal,
    startTimeLocal: stringOrNull(activity.startTimeLocal),
    sourceType: activity.sourceType,
    name: stringOrNull(activity.name),
    distanceMeters: activity.distanceMeters,
    movingTimeSeconds: numberOrNull(activity.movingTimeSeconds),
    elapsedTimeSeconds: numberOrNull(activity.elapsedTimeSeconds),
    averageHeartRate: numberOrNull(activity.averageHeartRate),
    maxHeartRate: numberOrNull(activity.maxHeartRate),
    hrZoneSeconds: zonesOrNull(activity.hrZoneSeconds),
    elevationGainMeters: numberOrNull(activity.elevationGainMeters),
    averageCadence: numberOrNull(activity.averageCadence),
    trainingLoad: numberOrNull(activity.trainingLoad),
    sourceUpdatedAt: stringOrNull(activity.sourceUpdatedAt),
    firstSeenAt: activity.firstSeenAt,
    lastSeenAt: activity.lastSeenAt,
    reconciledAt: stringOrNull(activity.reconciledAt),
  };
}

function isStoredActivity(value: unknown): value is HistoricalActivity {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const activity = value as Partial<HistoricalActivity>;
  const sourceType = typeof activity.sourceType === "string" ? activity.sourceType : "";
  const isRunning = VERIFIED_RUNNING_TYPES.has(sourceType);
  const isCrossTraining = VERIFIED_CROSS_TRAINING_TYPES.has(sourceType);
  return (
    activity.provider === "intervals" &&
    typeof activity.sourceId === "string" &&
    activity.sourceId.length > 0 &&
    typeof activity.startDateLocal === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(activity.startDateLocal) &&
    (isRunning || isCrossTraining) &&
    typeof activity.distanceMeters === "number" &&
    Number.isFinite(activity.distanceMeters) &&
    (isRunning ? activity.distanceMeters > 0 : activity.distanceMeters >= 0) &&
    (typeof activity.movingTimeSeconds === "number" || typeof activity.elapsedTimeSeconds === "number") &&
    typeof activity.firstSeenAt === "string" &&
    typeof activity.lastSeenAt === "string"
  );
}

/**
 * Never throws. Unreadable history is history the next sync rebuilds from the
 * source; it is not a reason to keep the runner out of their own app.
 */
export function loadHistoricalActivities(accountId: string | null = null): HistoricalActivity[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(accountId));
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(isStoredActivity)
      .map(storedActivity)
      .sort(compareHistoricalActivities);
  } catch {
    return [];
  }
}

/**
 * Throws `StorageWriteError` so a caller can say the history will not survive
 * this session rather than quietly promise a persistence it did not get.
 */
export function saveHistoricalActivities(
  activities: readonly HistoricalActivity[],
  accountId: string | null = null,
): void {
  try {
    if (activities.length === 0) {
      localStorage.removeItem(storageKey(accountId));
      return;
    }
    localStorage.setItem(storageKey(accountId), JSON.stringify(activities.map(storedActivity)));
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not save the runner's activity history.",
      { cause: error },
    );
  }
}

/**
 * Discards this device's stored history.
 *
 * Nothing in the current product calls it: the existing Forget Connection
 * deliberately leaves personal review data in place, and dropping a year of
 * history is a product decision rather than a side effect of changing a
 * credential. It exists so that decision, when it is made, has a repository to
 * call instead of reaching into storage.
 */
export function clearHistoricalActivities(accountId: string | null = null): void {
  try {
    localStorage.removeItem(storageKey(accountId));
  } catch {
    // A history that cannot be cleared is rebuilt from the source on the next
    // sync anyway; there is nothing here worth failing an app over.
  }
}
