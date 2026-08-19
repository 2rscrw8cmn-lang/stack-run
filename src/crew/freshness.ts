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

/**
 * `healthy`: green. `syncing`: neutral, and animated. `attention`: amber —
 * either the last refresh failed or the numbers are old enough to change
 * what a comparison means.
 */
export type CrewSyncState = "healthy" | "syncing" | "attention";

export interface CrewSyncStatus {
  state: CrewSyncState;
  /** The whole status in words, for the refresh control's accessible name. */
  label: string;
}

/**
 * Crew's sync state, as the refresh control itself rather than a line of copy
 * beside it (issue #120). Normal use says nothing: a green icon is the whole
 * message, and the words only exist for a screen reader. Mild staleness stays
 * quiet too — a comparison a few minutes old is still the same comparison.
 */
export function crewSyncStatus(input: {
  summaries: readonly CrewMemberSummary[];
  loading: boolean;
  error: boolean;
  now?: number;
}): CrewSyncStatus {
  if (input.loading) return { state: "syncing", label: "Refreshing crew data" };
  if (input.error) {
    return { state: "attention", label: "Refresh crew data. Last refresh failed." };
  }
  const freshness = crewFreshness(input.summaries, input.now ?? Date.now());
  if (freshness?.warning) {
    return { state: "attention", label: `Refresh crew data. ${freshness.label}.` };
  }
  return { state: "healthy", label: "Refresh crew data. Crew data is up to date." };
}
