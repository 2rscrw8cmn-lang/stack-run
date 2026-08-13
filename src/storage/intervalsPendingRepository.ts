import type { IntervalsCandidate } from "../connected/intervals";
import type { ImportedRunMetrics } from "../domain/types";
import { StorageWriteError } from "./appStateRepository";
import { INTERVALS_PENDING_STORAGE_KEY } from "./storageKeys";

function storageKey(accountId: string | null): string {
  return accountId
    ? `${INTERVALS_PENDING_STORAGE_KEY}.${encodeURIComponent(accountId)}`
    : INTERVALS_PENDING_STORAGE_KEY;
}

/**
 * The unresolved Run Data review queue, kept outside schema-9 AppState.
 *
 * A network window answers "what changed recently", never "what is still
 * waiting to be reviewed". Before this existed, every rolling 14-day sync
 * replaced the whole candidate set, so a run discovered by the first 90-day
 * read vanished the next morning without ever having been imported, ignored
 * or dismissed — it was simply outside the newest query.
 *
 * These are normalized `IntervalsCandidate` snapshots only: the same approved
 * fields the review screen already shows. No raw Intervals responses, no
 * credentials, and nothing that reaches a backup, an export or Race Crew.
 */

function numeric(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function metrics(value: unknown): ImportedRunMetrics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  const zones = source.hrZoneSeconds;
  if (zones !== undefined && !(Array.isArray(zones) && zones.every(numeric))) return null;
  const scalars = ["averageHeartRate", "maxHeartRate", "averageCadence", "elevationGainFeet", "trainingLoad", "elapsedTimeSeconds"] as const;
  if (scalars.some((key) => source[key] !== undefined && !numeric(source[key]))) return null;
  return source as ImportedRunMetrics;
}

function isPendingCandidate(value: unknown): value is IntervalsCandidate {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<IntervalsCandidate>;
  return (
    typeof candidate.externalId === "string" &&
    candidate.externalId.length > 0 &&
    typeof candidate.sourceType === "string" &&
    typeof candidate.completedDate === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(candidate.completedDate) &&
    numeric(candidate.distanceMiles) &&
    candidate.distanceMiles > 0 &&
    numeric(candidate.durationSeconds) &&
    candidate.durationSeconds > 0 &&
    (candidate.sourceUpdatedAt === null || typeof candidate.sourceUpdatedAt === "string") &&
    metrics(candidate.metrics) !== null
  );
}

/**
 * Never throws. A queue that cannot be read is a queue the next sync rebuilds;
 * it is not a reason to keep the user out of their own training data.
 */
export function loadPendingIntervalsCandidates(accountId: string | null = null): IntervalsCandidate[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(storageKey(accountId));
  } catch {
    return [];
  }
  if (raw === null) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isPendingCandidate) : [];
  } catch {
    return [];
  }
}

/**
 * Throws `StorageWriteError` so the caller can say the queue will not survive
 * this session rather than quietly promise a persistence it did not get.
 */
export function savePendingIntervalsCandidates(
  candidates: readonly IntervalsCandidate[],
  accountId: string | null = null,
): void {
  try {
    if (candidates.length === 0) {
      localStorage.removeItem(storageKey(accountId));
      return;
    }
    localStorage.setItem(storageKey(accountId), JSON.stringify(candidates));
  } catch (error) {
    throw new StorageWriteError(
      "This browser could not save the list of runs waiting to be reviewed.",
      { cause: error },
    );
  }
}

/** Only an explicit Forget Connection may call this. */
export function clearPendingIntervalsCandidates(accountId: string | null = null): void {
  try {
    localStorage.removeItem(storageKey(accountId));
  } catch {
    // Nothing to recover: the queue is filtered against imported and ignored
    // activities on load, so a failed clear cannot resurrect a settled run.
  }
}
