import type { CrewMemberSummary } from "./types";
import { formatUpdatedAgo } from "../domain/dates";

export const CREW_DASHBOARD_STALE_MS = 5 * 60_000;
const CREW_DASHBOARD_WARNING_MS = 2 * 60 * 60_000;

export interface CrewFreshness {
  label: string;
  warning: boolean;
}

/**
 * Fresh data stays quiet. Once stale, the oldest displayed summary controls
 * the label because that is the limiting fact in a member comparison.
 */
export function crewFreshness(
  summaries: readonly CrewMemberSummary[],
  now = Date.now(),
): CrewFreshness | null {
  const timestamps = summaries
    .map((summary) => new Date(summary.updatedAt).getTime())
    .filter((timestamp) => Number.isFinite(timestamp));
  if (timestamps.length === 0) return null;

  const age = Math.max(0, now - Math.min(...timestamps));
  if (age < CREW_DASHBOARD_STALE_MS) return null;

  const label = formatUpdatedAgo(new Date(now - age).toISOString(), now);
  if (!label) return null;

  return { label, warning: age >= CREW_DASHBOARD_WARNING_MS };
}
