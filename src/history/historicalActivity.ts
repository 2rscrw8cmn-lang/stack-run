import { VERIFIED_CROSS_TRAINING_TYPES, VERIFIED_RUNNING_TYPES } from "../connected/intervals.js";

/**
 * One historical activity in STACK's approved actual-history set, as the source stated it.
 *
 * This is STACK Next's first-class record of what the runner actually did, and
 * it is deliberately **not** a `RunLog`. A `RunLog` is a STACK activity: it
 * carries effort, notes, a plan link and a Build block, all of them things the
 * runner decided. A `HistoricalActivity` carries only what Intervals reported,
 * so later phases can compute volume, frequency, long-run progression, pace and
 * HR trends over a window far wider than any one race plan without first asking
 * the runner to review a year of runs one at a time.
 *
 * Three rules hold this record together, and every one of them is a rule the
 * repository has already learned the hard way (see `docs/CONNECTED_DATA_FIELDS.md`):
 *
 * 1. **Source units, source values.** Distance stays in metres, elevation in
 *    metres, durations in seconds, cadence in whatever number Intervals
 *    reported. Conversion is a presentation concern and lives in
 *    `historicalMeasures.ts`; nothing here doubles a cadence or invents a unit.
 * 2. **Missing is `null`, never `0`.** Every optional key is always present and
 *    explicitly null when the source did not supply it, so "no heart-rate
 *    monitor that day" cannot be read as "a heart rate of zero".
 * 3. **Source facts only.** There is no STACK classification, no derived pace,
 *    no plan link and no Build state on this record. Those are derivations, and
 *    keeping them out is what makes a re-sync safe: reconciliation can replace
 *    every field below from upstream without ever destroying something a person
 *    chose.
 *
 * The four `…At` fields at the bottom are STACK's own sync bookkeeping rather
 * than source facts, and are named so they cannot be mistaken for one.
 */
export interface HistoricalActivity {
  provider: "intervals";
  /** The external dedupe identity. One source id, at most one record. */
  sourceId: string;
  /** Local calendar date the activity started, `YYYY-MM-DD`. */
  startDateLocal: string;
  /**
   * Local wall-clock start as the source wrote it, or null. Kept for ordering
   * two runs on one day; deliberately local-only, because a UTC instant is
   * sync/debug trivia and the exact start time is never shared with Crew.
   */
  startTimeLocal: string | null;
  /** The source's own activity type, unmapped. */
  sourceType: string;
  name: string | null;
  distanceMeters: number;
  movingTimeSeconds: number | null;
  elapsedTimeSeconds: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  /** Seconds per zone, zone 1 first. A real zero inside the array is kept. */
  hrZoneSeconds: number[] | null;
  /** The source's stated total gain. Never recomputed from altitude samples. */
  elevationGainMeters: number | null;
  /** Verbatim, at the source's own convention. Not doubled, not given a unit. */
  averageCadence: number | null;
  trainingLoad: number | null;
  /** The source's last-modified marker when it supplies one. */
  sourceUpdatedAt: string | null;
  /** When this device first recorded the activity. */
  firstSeenAt: string;
  /** When a historical sync last saw it upstream. */
  lastSeenAt: string;
  /** When a source fact last changed under an id STACK already held, or null. */
  reconciledAt: string | null;
}

/**
 * Why a source row did not become a historical activity.
 *
 * Counted rather than logged: a rejection reason is engineering information,
 * and the row it came from is the runner's private data.
 */
export type HistoricalRejection =
  | "unreadable"
  | "not-running"
  | "no-source-id"
  | "no-local-date"
  | "no-distance"
  | "no-duration";

export interface HistoricalNormalizationResult {
  activities: HistoricalActivity[];
  /** Rejection counts, for the coverage report and for tests. */
  rejected: Record<HistoricalRejection, number>;
}

export function emptyRejectionCounts(): Record<HistoricalRejection, number> {
  return {
    unreadable: 0,
    "not-running": 0,
    "no-source-id": 0,
    "no-local-date": 0,
    "no-distance": 0,
    "no-duration": 0,
  };
}

function positive(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : null;
}

function nonnegative(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** The `YYYY-MM-DD` prefix of a source timestamp, or null if it is not one. */
export function localDateOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const local = value.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(local)) return null;
  const parsed = new Date(`${local}T00:00:00Z`);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === local
    ? local
    : null;
}

/** `YYYY-MM-DDTHH:MM:SS` when the source carried a wall-clock time, else null. */
function localTimeOf(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)/.exec(value);
  return match ? `${match[1]}T${match[2].length === 5 ? `${match[2]}:00` : match[2]}` : null;
}

/**
 * Heart-rate zone durations, or null.
 *
 * An array of all zeroes says nothing, so it is treated as no coverage; a
 * zero *inside* an otherwise populated array is a real zero and is kept. The
 * August 9 verified activity came back with seven entries, four of them zero.
 */
function hrZones(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const zones = value.map(nonnegative);
  if (zones.some((zone) => zone === null)) return null;
  const seconds = zones as number[];
  return seconds.some((zone) => zone > 0) ? seconds : null;
}

interface NormalizeOptions {
  /** The sync timestamp this activity was observed at. */
  seenAt: string;
}

/**
 * One raw source activity, narrowed to the Tier 1 facts in
 * `docs/INTERVALS_DATA_STRATEGY.md`, or a reason it cannot be one.
 *
 * The validity floor matches the existing connected-run import contract — a
 * verified running or Cross Training type, a readable local date and a
 * positive duration. Running still requires positive distance; verified Cross
 * Training deliberately does not, matching the connected import contract. Everything past that floor is optional and
 * stays null when absent.
 */
export function normalizeHistoricalActivity(
  raw: unknown,
  { seenAt }: NormalizeOptions,
): HistoricalActivity | HistoricalRejection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "unreadable";
  const source = raw as Record<string, unknown>;

  const sourceId =
    typeof source.id === "string" || typeof source.id === "number" ? String(source.id).trim() : "";
  if (!sourceId) return "no-source-id";
  const sourceType = typeof source.type === "string" ? source.type : "";
  const isRunning = VERIFIED_RUNNING_TYPES.has(sourceType);
  const isCrossTraining = VERIFIED_CROSS_TRAINING_TYPES.has(sourceType);
  if (!isRunning && !isCrossTraining) return "not-running";
  const startDateLocal = localDateOf(source.start_date_local);
  if (!startDateLocal) return "no-local-date";

  // Running has a distance validity floor because mileage, pace and Build sizing
  // depend on it. Verified Cross Training does not: the real HIIT source type
  // legitimately arrives with no distance, so zero is an explicit non-distance
  // activity value rather than invented running mileage.
  let distanceMeters: number;
  if (isRunning) {
    const runningDistance = positive(source.distance);
    if (!runningDistance) return "no-distance";
    distanceMeters = runningDistance;
  } else if (source.distance === undefined || source.distance === null) {
    distanceMeters = 0;
  } else if (typeof source.distance === "number" && Number.isFinite(source.distance) && source.distance >= 0) {
    distanceMeters = source.distance;
  } else {
    return "no-distance";
  }
  const movingTimeSeconds = positive(source.moving_time);
  const elapsedTimeSeconds = positive(source.elapsed_time);
  if (!movingTimeSeconds && !elapsedTimeSeconds) return "no-duration";

  return {
    provider: "intervals",
    sourceId,
    startDateLocal,
    startTimeLocal: localTimeOf(source.start_date_local),
    sourceType,
    name: text(source.name),
    distanceMeters,
    movingTimeSeconds: movingTimeSeconds === null ? null : Math.round(movingTimeSeconds),
    elapsedTimeSeconds: elapsedTimeSeconds === null ? null : Math.round(elapsedTimeSeconds),
    averageHeartRate: positive(source.average_heartrate),
    maxHeartRate: positive(source.max_heartrate),
    hrZoneSeconds: hrZones(source.icu_hr_zone_times),
    elevationGainMeters: positive(source.total_elevation_gain),
    averageCadence: positive(source.average_cadence),
    trainingLoad: positive(source.icu_training_load),
    sourceUpdatedAt: text(source.updated),
    firstSeenAt: seenAt,
    lastSeenAt: seenAt,
    reconciledAt: null,
  };
}

/**
 * A source activity list, normalized and counted.
 *
 * Duplicates within one response collapse to the newest occurrence, because a
 * paged read can legitimately return the same activity twice at a window
 * boundary and that is not two runs.
 */
export function normalizeHistoricalActivities(
  raw: unknown,
  options: NormalizeOptions,
): HistoricalNormalizationResult {
  const rejected = emptyRejectionCounts();
  if (!Array.isArray(raw)) {
    // A response that is not a list is one unreadable thing, not zero things.
    rejected.unreadable += 1;
    return { activities: [], rejected };
  }
  const byId = new Map<string, HistoricalActivity>();
  for (const item of raw) {
    const result = normalizeHistoricalActivity(item, options);
    if (typeof result === "string") {
      rejected[result] += 1;
      continue;
    }
    byId.set(result.sourceId, result);
  }
  return { activities: [...byId.values()], rejected };
}

export function addRejectionCounts(
  a: Record<HistoricalRejection, number>,
  b: Record<HistoricalRejection, number>,
): Record<HistoricalRejection, number> {
  const total = emptyRejectionCounts();
  for (const key of Object.keys(total) as HistoricalRejection[]) total[key] = a[key] + b[key];
  return total;
}

/** Newest first, with the source id breaking a same-day tie deterministically. */
export function compareHistoricalActivities(a: HistoricalActivity, b: HistoricalActivity): number {
  return (
    b.startDateLocal.localeCompare(a.startDateLocal) ||
    (b.startTimeLocal ?? "").localeCompare(a.startTimeLocal ?? "") ||
    a.sourceId.localeCompare(b.sourceId)
  );
}
