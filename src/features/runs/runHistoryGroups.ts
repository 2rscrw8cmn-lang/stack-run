import { formatDateLabel } from "../../domain/dates";
import type { RunnerRun } from "../../history/runnerRun";

export interface RunHistoryGroup {
  /** The month's `YYYY-MM`, which is also its stable list key. */
  key: string;
  /** `August 2026`, or `August` inside the run's own year. */
  label: string;
  runs: RunnerRun[];
}

/**
 * The history, split into the months it happened in.
 *
 * Purely presentational and lossless: every run appears exactly once, in the
 * order it was given, and nothing is counted, summed or classified. A year of
 * identical rows has no rhythm to scroll against, and a month rule is the
 * cheapest one available — it is already written on every row's date, so
 * grouping by it invents no fact and hides none.
 *
 * The chronology is the caller's. `unifiedRunnerHistory` returns newest first
 * and this preserves whatever order it is handed, so a group boundary is simply
 * the point where the month changes rather than a re-sort.
 */
export function groupRunsByMonth(
  runs: readonly RunnerRun[],
  today: string,
): RunHistoryGroup[] {
  const currentYear = today.slice(0, 4);
  const groups: RunHistoryGroup[] = [];

  for (const run of runs) {
    const key = run.date.slice(0, 7);
    const last = groups.at(-1);
    if (last?.key === key) {
      last.runs.push(run);
      continue;
    }
    groups.push({
      key,
      // The year is stated only when it is not the year the runner is in, the
      // same rule the rest of the product uses for dates.
      label: formatDateLabel(
        run.date,
        run.date.slice(0, 4) === currentYear
          ? { month: "long" }
          : { month: "long", year: "numeric" },
      ),
      runs: [run],
    });
  }

  return groups;
}
