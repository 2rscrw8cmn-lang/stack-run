import type { CrewMember, CrewMemberSummary } from "./types";

export type ComparisonMetric =
  | "weekly-miles"
  | "longest-run"
  | "consistency"
  | "run-days"
  | "miles-built";

/**
 * The raw synced summary plus Run Days, computed by the screen from actual
 * shared runs rather than a training plan. Race Crew comparisons never read
 * `runDays`; Run Club comparisons never read `consistencyCompleted/Due`.
 */
export interface ComparisonSummary extends CrewMemberSummary {
  runDays: number;
}

export interface ComparisonRow {
  member: CrewMember;
  summary: ComparisonSummary | null;
}

export function comparisonValue(
  metric: ComparisonMetric,
  summary: ComparisonSummary | null,
): number | null {
  if (!summary) return null;
  if (metric === "weekly-miles") return summary.weeklyMiles;
  if (metric === "longest-run") return summary.longestRun28dMiles;
  if (metric === "miles-built") return summary.milesBuilt;
  if (metric === "run-days") return summary.runDays;
  return summary.consistencyDue > 0
    ? summary.consistencyCompleted / summary.consistencyDue
    : null;
}

/** Graphic support for the visible value; consistency keeps its natural 0–100 scale. */
export function comparisonBarPercent(
  metric: ComparisonMetric,
  summary: ComparisonSummary | null,
  maxDisplayedValue: number,
): number {
  const value = comparisonValue(metric, summary);
  if (value === null || value <= 0) return 0;
  const scale = metric === "consistency" ? 1 : maxDisplayedValue;
  if (scale <= 0) return 0;
  return Math.min(100, Math.max(0, (value / scale) * 100));
}

/** Descending factual order; equal values remain in membership order. */
export function orderedComparisonRows(
  metric: ComparisonMetric,
  members: readonly CrewMember[],
  summaries: readonly ComparisonSummary[],
): ComparisonRow[] {
  const byUser = new Map(summaries.map((summary) => [summary.userId, summary]));
  return members
    .map((member) => ({ member, summary: byUser.get(member.userId) ?? null }))
    .sort((a, b) => {
      const aValue = comparisonValue(metric, a.summary);
      const bValue = comparisonValue(metric, b.summary);
      if (aValue === null && bValue === null) return 0;
      if (aValue === null) return 1;
      if (bValue === null) return -1;
      return bValue - aValue;
    });
}
