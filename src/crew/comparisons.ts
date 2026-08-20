import { addDaysToLocalDate, compareLocalDates } from "../domain/dates";
import { formatMiles, formatMilesBuilt } from "../domain/distance";
import { formatPaceSeconds } from "../domain/runs";
import type { CrewMember, CrewMemberSummary } from "./types";
import { AVG_PACE_WINDOW } from "./avgPace";

export type ComparisonMetric =
  | "weekly-miles"
  | "longest-run"
  | "avg-pace"
  | "miles-built"
  | "awards-28d";

/**
 * The raw synced summary plus Avg Pace and a trailing award count, computed
 * by the screen from actual shared runs and award blocks rather than a
 * training plan — which is why the same metrics now serve a Race Crew and a
 * Run Club alike (issue #120).
 */
export interface ComparisonSummary extends CrewMemberSummary {
  /** Trailing-window seconds per mile, or null with no eligible running. */
  avgPaceSeconds: number | null;
  /** Special Blocks won in the trailing 28 days. */
  awardsWon28d: number;
}

export interface ComparisonRow {
  member: CrewMember;
  summary: ComparisonSummary | null;
}

/** Every mileage metric rewards a bigger number; pace rewards a smaller one. */
export function lowerIsBetter(metric: ComparisonMetric): boolean {
  return metric === "avg-pace";
}

export function comparisonValue(
  metric: ComparisonMetric,
  summary: ComparisonSummary | null,
): number | null {
  if (!summary) return null;
  if (metric === "weekly-miles") return summary.weeklyMiles;
  if (metric === "longest-run") return summary.longestRun28dMiles;
  if (metric === "miles-built") return summary.milesBuilt;
  if (metric === "awards-28d") return summary.awardsWon28d;
  return summary.avgPaceSeconds;
}

/**
 * The best reading on screen, which every bar is drawn against — the largest
 * value for a mileage metric, the smallest for pace.
 */
export function comparisonBest(
  metric: ComparisonMetric,
  rows: readonly ComparisonRow[],
): number {
  const values = rows
    .map((row) => comparisonValue(metric, row.summary))
    .filter((value): value is number => value !== null && value > 0);
  if (values.length === 0) return 0;
  return lowerIsBetter(metric) ? Math.min(...values) : Math.max(...values);
}

/**
 * Graphic support for the visible value. A full bar always means "best on
 * this screen", so a faster pace draws a longer bar even though its number
 * is smaller — the alternative reads as a leaderboard upside down.
 */
export function comparisonBarPercent(
  metric: ComparisonMetric,
  summary: ComparisonSummary | null,
  bestValue: number,
): number {
  const value = comparisonValue(metric, summary);
  if (value === null || value <= 0 || bestValue <= 0) return 0;
  const ratio = lowerIsBetter(metric) ? bestValue / value : value / bestValue;
  return Math.min(100, Math.max(0, ratio * 100));
}

export interface FormattedComparison {
  value: string;
  /** A short qualifier read on the same line as `value` — never a second stacked line (issue #86). */
  detail: string | null;
}

/**
 * The one reading every comparison metric prints: the compact comparison
 * rows and the Member Profile stat strip (issue #87) both format their
 * numbers this way, so a runner's Avg Pace or Miles Built never reads
 * differently in two places.
 */
export function formatComparisonReading(
  metric: ComparisonMetric,
  summary: ComparisonSummary | null,
): FormattedComparison {
  const value = comparisonValue(metric, summary);
  if (value === null || !summary) return { value: "—", detail: null };
  if (metric === "avg-pace") {
    return { value: formatPaceSeconds(value), detail: null };
  }
  if (metric === "awards-28d") {
    return { value: String(value), detail: value === 1 ? "AWARD" : "AWARDS" };
  }
  return {
    value: `${metric === "miles-built" ? formatMilesBuilt(value) : formatMiles(value)} MI`,
    detail: null,
  };
}

/** The window Avg Pace is measured over, stated once for every caller. */
export const AVG_PACE_WINDOW_LABEL = `${AVG_PACE_WINDOW}D`;

export const AWARDS_WINDOW_DAYS = 28;

/**
 * Special Blocks won per member in the trailing window, counting the week a
 * block was won rather than when it was placed — a runner who has not
 * gotten around to placing a recent win still shows it here.
 */
export function awardsWonByUserId(
  awards: readonly { winnerUserId: string; weekStart: string }[],
  today: string,
): Map<string, number> {
  const windowStart = addDaysToLocalDate(today, -(AWARDS_WINDOW_DAYS - 1));
  const counts = new Map<string, number>();
  for (const award of awards) {
    if (compareLocalDates(award.weekStart, windowStart) < 0) continue;
    counts.set(award.winnerUserId, (counts.get(award.winnerUserId) ?? 0) + 1);
  }
  return counts;
}

/**
 * Best factual order first; equal values remain in membership order, and a
 * member with no reading sorts last regardless of which way the metric runs.
 */
export function orderedComparisonRows(
  metric: ComparisonMetric,
  members: readonly CrewMember[],
  summaries: readonly ComparisonSummary[],
): ComparisonRow[] {
  const byUser = new Map(summaries.map((summary) => [summary.userId, summary]));
  const direction = lowerIsBetter(metric) ? -1 : 1;
  return members
    .map((member) => ({ member, summary: byUser.get(member.userId) ?? null }))
    .sort((a, b) => {
      const aValue = comparisonValue(metric, a.summary);
      const bValue = comparisonValue(metric, b.summary);
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return (bValue - aValue) * direction;
    });
}
