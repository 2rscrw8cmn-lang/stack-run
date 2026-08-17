import {
  addDaysToLocalDate,
  daysBetweenLocalDates,
  formatLocalDate,
  mondayOfLocalDate,
  parseLocalDate,
} from "../../domain/dates";
import type { RunnerRun } from "../../history/runnerRun";

export const HISTORY_RANGE_IDS = ["4w", "3m", "6m", "ytd", "1y", "all"] as const;
export type HistoryRangeId = (typeof HISTORY_RANGE_IDS)[number];

export const HISTORY_METRIC_IDS = ["miles", "runs", "time", "load", "gain", "zones"] as const;
export type HistoryMetricId = (typeof HISTORY_METRIC_IDS)[number];

export const HISTORY_FILTER_IDS = ["all", "planned", "extra", "history"] as const;
export type HistoryFilterId = (typeof HISTORY_FILTER_IDS)[number];

export type HistoryBucketKind = "week" | "month";

export interface HistoryDateRange {
  id: HistoryRangeId;
  requestedStartDate: string;
  startDate: string;
  endDate: string;
  isCoverageTruncated: boolean;
}

export interface HistoryBucket {
  key: string;
  startDate: string;
  endDate: string;
  runs: RunnerRun[];
}

export interface HistoryMetricBucket extends HistoryBucket {
  value: number | null;
  coveredRuns: number;
}

export interface HistoryMetricSummary {
  metric: HistoryMetricId;
  value: number | null;
  coveredRuns: number;
  totalRuns: number;
}

export interface HistoryZoneShare {
  index: number;
  seconds: number;
  share: number;
}

export interface HistoryZoneMix {
  zones: HistoryZoneShare[];
  totalSeconds: number;
  coveredRuns: number;
  totalRuns: number;
}

function subtractCalendarMonths(dateString: string, months: number): string {
  const source = parseLocalDate(dateString);
  const day = source.getDate();
  const target = new Date(source.getFullYear(), source.getMonth() - months, 1);
  const finalDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(day, finalDay));
  return formatLocalDate(target);
}

function requestedRangeStart(id: HistoryRangeId, today: string): string {
  switch (id) {
    case "4w":
      return addDaysToLocalDate(today, -27);
    case "3m":
      return subtractCalendarMonths(today, 3);
    case "6m":
      return subtractCalendarMonths(today, 6);
    case "ytd":
      return `${today.slice(0, 4)}-01-01`;
    case "1y":
      return subtractCalendarMonths(today, 12);
    case "all":
      return today;
  }
}

/** Choose the largest fully known quick range up to the recommended 3M default. */
export function defaultHistoryRange(
  runs: readonly RunnerRun[],
  today: string,
): Extract<HistoryRangeId, "4w" | "3m"> {
  const earliest = runs
    .map((run) => run.date)
    .filter((date) => date <= today)
    .sort()[0];
  if (earliest && earliest <= requestedRangeStart("3m", today)) return "3m";
  return "4w";
}

/**
 * Resolves a requested preset against the history STACK actually holds.
 * Time before the first known run is unknown, not an empty zero period.
 */
export function resolveHistoryDateRange(
  runs: readonly RunnerRun[],
  today: string,
  id: HistoryRangeId,
): HistoryDateRange {
  const dates = runs
    .map((run) => run.date)
    .filter((date) => date <= today)
    .sort();
  const earliest = dates[0] ?? null;
  const presetStart = id === "all" ? earliest ?? today : requestedRangeStart(id, today);
  const startDate = earliest && earliest > presetStart ? earliest : presetStart;

  return {
    id,
    requestedStartDate: presetStart,
    startDate,
    endDate: today,
    isCoverageTruncated: earliest !== null && earliest > presetStart,
  };
}

export function bucketKindForRange(range: HistoryDateRange): HistoryBucketKind {
  if (range.id === "1y" || range.id === "all") return "month";
  if (range.id === "ytd" && daysBetweenLocalDates(range.startDate, range.endDate) > 184) {
    return "month";
  }
  return "week";
}

export function filterHistoryRuns(
  runs: readonly RunnerRun[],
  filter: HistoryFilterId,
): RunnerRun[] {
  if (filter === "all") return [...runs];
  return runs.filter((run) => {
    if (filter === "history") return run.stack === null;
    if (run.stack === null) return false;
    return filter === "planned" ? run.stack.workoutId !== null : run.stack.workoutId === null;
  });
}

export function runsInHistoryRange(
  runs: readonly RunnerRun[],
  range: HistoryDateRange,
): RunnerRun[] {
  return runs.filter((run) => run.date >= range.startDate && run.date <= range.endDate);
}

function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

function nextMonth(date: string): string {
  const parsed = parseLocalDate(date);
  return formatLocalDate(new Date(parsed.getFullYear(), parsed.getMonth() + 1, 1));
}

/** Empty buckets are retained inside known coverage so measured zero stays visible. */
export function createHistoryBuckets(
  runs: readonly RunnerRun[],
  range: HistoryDateRange,
  kind: HistoryBucketKind = bucketKindForRange(range),
): HistoryBucket[] {
  if (range.startDate > range.endDate) return [];
  const buckets: HistoryBucket[] = [];

  if (kind === "week") {
    let cursor = mondayOfLocalDate(range.startDate);
    while (cursor <= range.endDate) {
      const calendarEnd = addDaysToLocalDate(cursor, 6);
      const startDate = cursor < range.startDate ? range.startDate : cursor;
      const endDate = calendarEnd > range.endDate ? range.endDate : calendarEnd;
      buckets.push({
        key: `week:${cursor}`,
        startDate,
        endDate,
        runs: runs.filter((run) => run.date >= startDate && run.date <= endDate),
      });
      cursor = addDaysToLocalDate(cursor, 7);
    }
    return buckets;
  }

  let cursor = monthStart(range.startDate);
  while (cursor <= range.endDate) {
    const following = nextMonth(cursor);
    const calendarEnd = addDaysToLocalDate(following, -1);
    const startDate = cursor < range.startDate ? range.startDate : cursor;
    const endDate = calendarEnd > range.endDate ? range.endDate : calendarEnd;
    buckets.push({
      key: `month:${cursor.slice(0, 7)}`,
      startDate,
      endDate,
      runs: runs.filter((run) => run.date >= startDate && run.date <= endDate),
    });
    cursor = following;
  }
  return buckets;
}

function optionalMetricValue(run: RunnerRun, metric: HistoryMetricId): number | null {
  switch (metric) {
    case "time":
      return run.durationSeconds;
    case "load":
      return run.trainingLoad;
    case "gain":
      return run.elevationGainFeet;
    case "miles":
      return run.distanceMiles;
    case "runs":
    case "zones":
      return null;
  }
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function summarizeHistoryMetric(
  runs: readonly RunnerRun[],
  metric: Exclude<HistoryMetricId, "zones">,
): HistoryMetricSummary {
  if (metric === "runs") {
    return { metric, value: runs.length, coveredRuns: runs.length, totalRuns: runs.length };
  }
  if (metric === "miles") {
    return {
      metric,
      value: sum(runs.map((run) => run.distanceMiles)),
      coveredRuns: runs.length,
      totalRuns: runs.length,
    };
  }
  const values = runs.flatMap((run) => {
    const value = optionalMetricValue(run, metric);
    return value === null ? [] : [value];
  });
  return {
    metric,
    value: values.length ? sum(values) : null,
    coveredRuns: values.length,
    totalRuns: runs.length,
  };
}

export function aggregateHistoryMetric(
  buckets: readonly HistoryBucket[],
  metric: Exclude<HistoryMetricId, "zones">,
): HistoryMetricBucket[] {
  return buckets.map((bucket) => {
    const summary = summarizeHistoryMetric(bucket.runs, metric);
    return { ...bucket, value: summary.value, coveredRuns: summary.coveredRuns };
  });
}

export function aggregateHistoryZones(runs: readonly RunnerRun[]): HistoryZoneMix {
  const covered = runs.filter(
    (run) => run.hrZoneSeconds !== null && run.hrZoneSeconds.some((seconds) => seconds > 0),
  );
  const zoneCount = covered.reduce(
    (maximum, run) => Math.max(maximum, run.hrZoneSeconds?.length ?? 0),
    0,
  );
  const totals = Array.from({ length: zoneCount }, (_, index) =>
    sum(covered.map((run) => run.hrZoneSeconds?.[index] ?? 0)),
  );
  const totalSeconds = sum(totals);

  return {
    zones: totals.map((seconds, index) => ({
      index,
      seconds,
      share: totalSeconds > 0 ? seconds / totalSeconds : 0,
    })),
    totalSeconds,
    coveredRuns: covered.length,
    totalRuns: runs.length,
  };
}
