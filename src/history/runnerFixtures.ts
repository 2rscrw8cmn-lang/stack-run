import type { RunLog } from "../domain/types.js";
import type { HistoricalActivity } from "./historicalActivity.js";

/**
 * Builders for the two records the unified history reconciles.
 *
 * Every value is invented, like `historicalFixtures.ts`: the standing rule is
 * that a real Intervals payload never enters this repository. These exist so the
 * runner-history tests can say what they are actually testing — a run on this
 * date, this far, with or without a heart rate — instead of restating a
 * seventeen-field record each time.
 *
 * Nothing in the application imports this file.
 */

const METERS_PER_MILE = 1609.344;

export interface HistoricalRunOptions {
  miles?: number;
  /** Seconds. Defaults to a flat ten minutes a mile. */
  durationSeconds?: number;
  startTimeLocal?: string | null;
  name?: string | null;
  averageHeartRate?: number | null;
  maxHeartRate?: number | null;
  hrZoneSeconds?: number[] | null;
  elevationGainMeters?: number | null;
  averageCadence?: number | null;
  trainingLoad?: number | null;
}

/** One historical activity, as the source mirror would hold it. */
export function historicalRun(
  sourceId: string,
  startDateLocal: string,
  {
    miles = 5,
    durationSeconds,
    startTimeLocal = `${startDateLocal}T06:00:00`,
    name = null,
    averageHeartRate = null,
    maxHeartRate = null,
    hrZoneSeconds = null,
    elevationGainMeters = null,
    averageCadence = null,
    trainingLoad = null,
  }: HistoricalRunOptions = {},
): HistoricalActivity {
  return {
    provider: "intervals",
    sourceId,
    startDateLocal,
    startTimeLocal,
    sourceType: "Run",
    name,
    distanceMeters: miles * METERS_PER_MILE,
    movingTimeSeconds: durationSeconds ?? Math.round(miles * 600),
    elapsedTimeSeconds: null,
    averageHeartRate,
    maxHeartRate,
    hrZoneSeconds,
    elevationGainMeters,
    averageCadence,
    trainingLoad,
    sourceUpdatedAt: null,
    firstSeenAt: "2026-08-15T00:00:00.000Z",
    lastSeenAt: "2026-08-15T00:00:00.000Z",
    reconciledAt: null,
  };
}

/** One STACK run, typed in by hand unless overridden. */
export function stackRun(
  id: string,
  completedDate: string,
  overrides: Partial<RunLog> = {},
): RunLog {
  return {
    id,
    workoutId: null,
    completedDate,
    activityType: "easy",
    distanceMiles: 3,
    durationSeconds: 1_800,
    effort: "solid",
    notes: "",
    createdAt: `${completedDate}T12:00:00Z`,
    updatedAt: `${completedDate}T12:00:00Z`,
    source: "manual",
    externalSource: null,
    importedMetrics: null,
    ...overrides,
  };
}

/** A STACK run the runner accepted from a specific Intervals activity. */
export function acceptedRun(
  id: string,
  completedDate: string,
  activityId: string,
  overrides: Partial<RunLog> = {},
): RunLog {
  return stackRun(id, completedDate, {
    source: "intervals",
    externalSource: {
      provider: "intervals",
      activityId,
      sourceUpdatedAt: null,
      importedAt: `${completedDate}T13:00:00Z`,
    },
    ...overrides,
  });
}
