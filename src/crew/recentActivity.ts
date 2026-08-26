import { addDaysToLocalDate } from "../domain/dates.js";
import type { CrewSharedRun } from "./types.js";

/** Privacy-safe Today window: teammate runs from today or yesterday, max two. */
export function selectRecentCrewActivity(
  runs: readonly CrewSharedRun[],
  viewerUserId: string,
  today: string,
  limit = 2,
): CrewSharedRun[] {
  const earliest = addDaysToLocalDate(today, -1);
  return [...runs]
    .filter(
      (run) =>
        run.userId !== viewerUserId &&
        run.localDate >= earliest &&
        run.localDate <= today,
    )
    .sort(
      (a, b) =>
        b.localDate.localeCompare(a.localDate) ||
        b.createdAt.localeCompare(a.createdAt) ||
        b.id.localeCompare(a.id),
    )
    .slice(0, Math.max(0, limit));
}
