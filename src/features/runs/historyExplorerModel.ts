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

/**
 * A metric's shape decides its chart, rather than every metric inheriting the
 * same columns.
 *
 * Miles and recorded time are discrete per-period totals, so they are columns.
 * Frequency, source Training Load and source elevation are read as movement
 * over time, so they are lines. Zone mix is a composition and never a single
 * line, because one line through six shares would say something the data does
 * not.
 */
export type HistoryChartKind = "bar" | "line" | "composition";

const HISTORY_CHART_KIND: Record<HistoryMetricId, HistoryChartKind> = {
  miles: "bar",
  time: "bar",
  runs: "line",
  load: "line",
  gain: "line",
  zones: "composition",
};

export function historyChartKind(metric: HistoryMetricId): HistoryChartKind {
  return HISTORY_CHART_KIND[metric];
}

export type HistoryBucketKind = "trailing-week" | "week" | "month";

/** `4W` means four weeks on the chart, not "however many Mondays 28 days touch". */
export const TRAILING_WEEK_BUCKETS = 4;
export const TRAILING_WEEK_DAYS = 7;

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
  /** True when the calendar period this bucket stands for has not finished. */
  isInProgress: boolean;
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

/** The one filtered result the screen leads with, and its single context line. */
export interface HistoryRangeReading extends HistoryMetricSummary {
  startDate: string;
  endDate: string;
  days: number;
  runCount: number;
  /**
   * The same metric over the equally long window immediately before this one,
   * or null when that window reaches past the history STACK actually holds. An
   * unknown prior period is not a smaller prior period.
   */
  priorValue: number | null;
  /** The range total spread over its own length, when the range spans weeks. */
  perWeek: number | null;
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
  /**
   * Recorded share of zone time in zones 1–2. Descriptive only: STACK does not
   * say what a composition should be.
   */
  lowerZoneShare: number | null;
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
      return addDaysToLocalDate(today, -(TRAILING_WEEK_BUCKETS * TRAILING_WEEK_DAYS - 1));
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
  const earliest = earliestKnownDate(runs, today);
  if (earliest && earliest <= requestedRangeStart("3m", today)) return "3m";
  return "4w";
}

export function earliestKnownDate(
  runs: readonly RunnerRun[],
  today: string,
): string | null {
  return (
    runs
      .map((run) => run.date)
      .filter((date) => date <= today)
      .sort()[0] ?? null
  );
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
  const earliest = earliestKnownDate(runs, today);
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
  if (range.id === "4w") return "trailing-week";
  if (range.id === "1y" || range.id === "all") return "month";
  if (range.id === "ytd" && daysBetweenLocalDates(range.startDate, range.endDate) > 184) {
    return "month";
  }
  return "week";
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

function runsBetween(
  runs: readonly RunnerRun[],
  startDate: string,
  endDate: string,
): RunnerRun[] {
  return runs.filter((run) => run.date >= startDate && run.date <= endDate);
}

/**
 * Empty buckets are retained inside known coverage so measured zero stays visible.
 *
 * `4W` uses four trailing seven-day buckets rather than the Monday weeks a
 * 28-day span touches. A trailing 28 days crosses five calendar weeks about
 * six days out of seven, and a chart of five columns under a control labelled
 * `4W` is arithmetically defensible and product-confusing. Every boundary date
 * still lands in exactly one bucket.
 */
export function createHistoryBuckets(
  runs: readonly RunnerRun[],
  range: HistoryDateRange,
  kind: HistoryBucketKind = bucketKindForRange(range),
): HistoryBucket[] {
  if (range.startDate > range.endDate) return [];
  const buckets: HistoryBucket[] = [];

  if (kind === "trailing-week") {
    for (let step = TRAILING_WEEK_BUCKETS - 1; step >= 0; step -= 1) {
      const bucketEnd = addDaysToLocalDate(range.endDate, -step * TRAILING_WEEK_DAYS);
      const bucketStart = addDaysToLocalDate(bucketEnd, -(TRAILING_WEEK_DAYS - 1));
      if (bucketEnd < range.startDate) continue;
      const startDate = bucketStart < range.startDate ? range.startDate : bucketStart;
      buckets.push({
        key: `trailing:${bucketStart}`,
        startDate,
        endDate: bucketEnd,
        // A trailing window always ends on a day that has happened.
        isInProgress: false,
        runs: runsBetween(runs, startDate, bucketEnd),
      });
    }
    return buckets;
  }

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
        isInProgress: calendarEnd > range.endDate,
        runs: runsBetween(runs, startDate, endDate),
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
      isInProgress: calendarEnd > range.endDate,
      runs: runsBetween(runs, startDate, endDate),
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

/**
 * The selected range as one reading: the total, the window it covers, and the
 * single comparison the summary is allowed to state.
 *
 * The comparison window is the equally long span immediately before the range.
 * When that span reaches earlier than STACK's first known run it is reported as
 * null rather than as a smaller number, because an unsynced month is not a
 * quiet month.
 */
export function readHistoryRange(
  runs: readonly RunnerRun[],
  range: HistoryDateRange,
  metric: Exclude<HistoryMetricId, "zones">,
  earliestDate: string | null,
): HistoryRangeReading {
  const rangedRuns = runsInHistoryRange(runs, range);
  const summary = summarizeHistoryMetric(rangedRuns, metric);
  const days = Math.max(1, daysBetweenLocalDates(range.startDate, range.endDate) + 1);
  const priorEnd = addDaysToLocalDate(range.startDate, -1);
  const priorStart = addDaysToLocalDate(priorEnd, -(days - 1));
  const priorKnown = earliestDate !== null && priorStart >= earliestDate;
  const prior = priorKnown
    ? summarizeHistoryMetric(runsBetween(runs, priorStart, priorEnd), metric)
    : null;

  return {
    ...summary,
    startDate: range.startDate,
    endDate: range.endDate,
    days,
    runCount: rangedRuns.length,
    priorValue: prior?.value ?? null,
    perWeek:
      summary.value === null || days < TRAILING_WEEK_DAYS
        ? null
        : summary.value / (days / TRAILING_WEEK_DAYS),
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
    lowerZoneShare:
      totalSeconds > 0 && totals.length >= 2
        ? (totals[0] + totals[1]) / totalSeconds
        : null,
  };
}
