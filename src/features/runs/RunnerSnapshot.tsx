import { ChevronRight } from "lucide-react";
import { formatDateLabel, formatUpdatedAgo } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { HistorySyncPhase } from "../../history/historySyncPolicy";
import type { RunnerSnapshot as Snapshot } from "../../history/runnerSnapshot";

interface RunnerSnapshotProps {
  snapshot: Snapshot;
  phase: HistorySyncPhase;
  lastCompleteAt: string | null;
  onOpenProfile: () => void;
}

/**
 * The runner, in four facts.
 *
 * This is the first thing NEXT-2 puts in front of a person, and the restraint is
 * the feature. The calculation layer behind it can produce a dozen more numbers;
 * showing them would make the top of Runs an analytics dashboard, which
 * `docs/STACK_NEXT.md` explicitly rules out. Four readings fit one phone row
 * without scrolling and can be taken in at a glance.
 *
 * **Every number states its window.** `28.4` means nothing; `28.4 mi / Last 7
 * days` is a fact. The windows are in the labels rather than in a legend
 * somewhere, because a reading and its window are one thing.
 *
 * **A missing value is not zero.** A runner with no long run in the last 28 days
 * gets `—`, not `0 mi`, because zero would assert a 0-mile run happened.
 */
export function RunnerSnapshot({
  snapshot,
  phase,
  lastCompleteAt,
  onOpenProfile,
}: RunnerSnapshotProps) {
  const { lastWeek, lastFourWeeks, frequency, longestRecent, range } = snapshot;

  const readings = [
    {
      key: "last-7",
      value: formatMiles(lastWeek.miles),
      unit: "mi",
      label: "Last 7 days",
      spoken: `${formatMiles(lastWeek.miles)} miles over the last 7 days`,
    },
    {
      key: "last-28",
      value: formatMiles(lastFourWeeks.miles),
      unit: "mi",
      label: "Last 28 days",
      spoken: `${formatMiles(lastFourWeeks.miles)} miles over the last 28 days`,
    },
    {
      key: "frequency",
      value: frequency.runsPerWeek === null ? "—" : frequency.runsPerWeek.toFixed(1),
      unit: "runs/wk",
      label: `Last ${frequency.weeks} wks`,
      spoken:
        frequency.runsPerWeek === null
          ? `No runs in the last ${frequency.weeks} weeks`
          : `${frequency.runsPerWeek.toFixed(1)} runs per week over the last ${frequency.weeks} weeks`,
    },
    {
      key: "longest",
      value: longestRecent.miles === null ? "—" : formatMiles(longestRecent.miles),
      unit: "mi",
      label: `Longest ${longestRecent.days}d`,
      spoken:
        longestRecent.miles === null
          ? `No longest run in the last ${longestRecent.days} days`
          : `Longest run of the last ${longestRecent.days} days, ${formatMiles(longestRecent.miles)} miles`,
    },
  ];

  return (
    <div className="runner-snapshot">
      <button
        type="button"
        className="runner-snapshot__readings"
        aria-label={`Runner snapshot. ${readings.map((reading) => reading.spoken).join(". ")}. Open history detail.`}
        onClick={onOpenProfile}
      >
        <dl className="runner-snapshot__grid">
          {readings.map((reading) => (
            <div key={reading.key} className="runner-snapshot__reading" data-reading={reading.key}>
              <dd className="runner-snapshot__value data-value">
                {reading.value}
                <span className="runner-snapshot__unit">{reading.unit}</span>
              </dd>
              <dt className="machine-label">{reading.label}</dt>
            </div>
          ))}
        </dl>
        <span className="runner-snapshot__more" aria-hidden="true">
          <ChevronRight size={16} strokeWidth={2} />
        </span>
      </button>
      <p className="runner-snapshot__range machine-label">
        <HistoryRangeLine range={range} />
        <HistoryStatusLine phase={phase} lastCompleteAt={lastCompleteAt} />
      </p>
    </div>
  );
}

/**
 * How far back the history behind these numbers actually reaches.
 *
 * Stated because a snapshot without it invites a wrong reading: "1.4 runs/week
 * over the last 8 weeks" means one thing when STACK holds a year and something
 * quite different when it holds nine days.
 */
function HistoryRangeLine({ range }: { range: Snapshot["range"] }) {
  if (!range.earliestDate) return null;
  return <span>Since {formatDateLabel(range.earliestDate, { month: "short", year: "numeric" })}</span>;
}

/**
 * What STACK currently knows about the runner's connected history.
 *
 * Silent in the two cases where there is nothing worth saying: a manual-only
 * runner has no Intervals connection and does not need to be told about one, and
 * fresh history is the expected state rather than news. The rule the rest of the
 * product already follows — freshness is hidden while normal and becomes
 * relative only when it is useful.
 */
function HistoryStatusLine({
  phase,
  lastCompleteAt,
}: {
  phase: HistorySyncPhase;
  lastCompleteAt: string | null;
}) {
  const text = (() => {
    switch (phase) {
      case "no-connection":
      case "fresh":
        return null;
      case "syncing":
        return "Loading history…";
      case "never-synced":
        return "History not loaded yet";
      case "partial":
        return "Some history could not be loaded";
      case "stale":
        return lastCompleteAt ? formatUpdatedAgo(lastCompleteAt) : null;
    }
  })();
  return text ? <span className="runner-snapshot__status"> · {text}</span> : null;
}
