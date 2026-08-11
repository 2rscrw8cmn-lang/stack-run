import type { CrewMember, CrewMemberSummary } from "./types";

export type ComparisonMetric =
  | "weekly-miles"
  | "longest-run"
  | "consistency"
  | "miles-built";

export interface ComparisonRow {
  member: CrewMember;
  summary: CrewMemberSummary | null;
}

export function comparisonValue(
  metric: ComparisonMetric,
  summary: CrewMemberSummary | null,
): number | null {
  if (!summary) return null;
  if (metric === "weekly-miles") return summary.weeklyMiles;
  if (metric === "longest-run") return summary.longestRun28dMiles;
  if (metric === "miles-built") return summary.milesBuilt;
  return summary.consistencyDue > 0
    ? summary.consistencyCompleted / summary.consistencyDue
    : null;
}

/** Descending factual order; equal values remain in membership order. */
export function orderedComparisonRows(
  metric: ComparisonMetric,
  members: readonly CrewMember[],
  summaries: readonly CrewMemberSummary[],
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
