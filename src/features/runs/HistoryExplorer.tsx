import { ArrowLeft } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { sparseTickIndices } from "../../components/charts/chartTickDensity";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { RunnerRun } from "../../history/runnerRun";
import { RunnerRunRow } from "./RunnerRunRow";
import {
  HISTORY_FILTER_IDS,
  HISTORY_METRIC_IDS,
  HISTORY_RANGE_IDS,
  aggregateHistoryMetric,
  aggregateHistoryZones,
  createHistoryBuckets,
  defaultHistoryRange,
  filterHistoryRuns,
  resolveHistoryDateRange,
  runsInHistoryRange,
  summarizeHistoryMetric,
  type HistoryBucket,
  type HistoryFilterId,
  type HistoryMetricBucket,
  type HistoryMetricId,
  type HistoryRangeId,
  type HistoryZoneMix,
} from "./historyExplorerModel";
import "./historyExplorer.css";

export const HISTORY_EXPLORER_PAGE_SIZE = 25;

const METRIC_LABEL: Record<HistoryMetricId, string> = {
  miles: "Miles",
  runs: "Runs",
  time: "Time",
  load: "Load",
  gain: "Gain",
  zones: "Zones",
};

const RANGE_LABEL: Record<HistoryRangeId, string> = {
  "4w": "4W",
  "3m": "3M",
  "6m": "6M",
  ytd: "YTD",
  "1y": "1Y",
  all: "ALL",
};

const FILTER_LABEL: Record<HistoryFilterId, string> = {
  all: "All",
  planned: "Planned",
  extra: "Extra",
  history: "History only",
};

interface HistoryExplorerProps {
  runs: readonly RunnerRun[];
  today: string;
  onBack: () => void;
  onOpenRun: (run: RunnerRun) => void;
}

/** The complete chronology/lookup depth inside Runs. */
export function HistoryExplorer({ runs, today, onBack, onOpenRun }: HistoryExplorerProps) {
  const [metric, setMetric] = useState<HistoryMetricId>("miles");
  const [rangeId, setRangeId] = useState<HistoryRangeId>(() =>
    defaultHistoryRange(runs, today),
  );
  const [filter, setFilter] = useState<HistoryFilterId>("all");
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  const [visibleRuns, setVisibleRuns] = useState(HISTORY_EXPLORER_PAGE_SIZE);

  const range = resolveHistoryDateRange(runs, today, rangeId);
  const rangedRuns = runsInHistoryRange(runs, range);
  const filteredRuns = filterHistoryRuns(rangedRuns, filter);
  const buckets = createHistoryBuckets(filteredRuns, range);
  const metricBuckets =
    metric === "zones" ? [] : aggregateHistoryMetric(buckets, metric);
  const selectedBucket =
    metricBuckets.find((bucket) => bucket.key === selectedBucketKey) ??
    [...metricBuckets].reverse().find((bucket) => bucket.runs.length > 0) ??
    metricBuckets.at(-1) ??
    null;
  const rangeSummary =
    metric === "zones" ? null : summarizeHistoryMetric(filteredRuns, metric);
  const zoneMix = aggregateHistoryZones(filteredRuns);
  const contributingRuns = (
    metric === "zones" ? filteredRuns : selectedBucket?.runs ?? filteredRuns
  ).slice().sort((a, b) => b.date.localeCompare(a.date));
  const visibleContributingRuns = contributingRuns.slice(0, visibleRuns);
  const availability = metricAvailability(filteredRuns);
  const coveredDates = formatPeriod(range.startDate, range.endDate, true);

  function resetBrowsingSelection() {
    setSelectedBucketKey(null);
    setVisibleRuns(HISTORY_EXPLORER_PAGE_SIZE);
  }

  return (
    <div className="history-explorer">
      <header className="history-explorer__header">
        <Button
          variant="ghost"
          className="history-explorer__back"
          icon={<ArrowLeft size={18} strokeWidth={2} />}
          onClick={onBack}
        >
          Runs
        </Button>
        <div>
          <p className="machine-label">RUNS · HISTORY</p>
          <h1 tabIndex={-1}>History</h1>
          <p>Explore what you actually ran over time.</p>
        </div>
      </header>

      <div className="history-explorer__controls">
        <div className="history-selector" role="tablist" aria-label="History metric">
          {HISTORY_METRIC_IDS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={metric === id}
              aria-controls="history-result"
              disabled={!availability[id]}
              onClick={() => {
                setMetric(id);
                resetBrowsingSelection();
              }}
            >
              {METRIC_LABEL[id]}
            </button>
          ))}
        </div>

        <div className="history-selector history-selector--range" aria-label="History range">
          {HISTORY_RANGE_IDS.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={rangeId === id}
              onClick={() => {
                setRangeId(id);
                resetBrowsingSelection();
              }}
            >
              {RANGE_LABEL[id]}
            </button>
          ))}
        </div>
      </div>

      <section
        id="history-result"
        className="history-explorer__instrument"
        role="tabpanel"
        aria-label={`${METRIC_LABEL[metric]} history`}
      >
        <div className="history-explorer__result">
          <div>
            <span>{METRIC_LABEL[metric]}</span>
            <strong>{formatRangeResult(metric, rangeSummary, zoneMix)}</strong>
          </div>
          <p>{coveredDates}</p>
        </div>

        {filteredRuns.length === 0 ? (
          <p className="history-explorer__empty">No runs recorded in this range.</p>
        ) : metric === "zones" ? (
          zoneMix.coveredRuns > 0 ? (
            <ZoneComposition mix={zoneMix} />
          ) : (
            <p className="history-explorer__empty">
              Heart-rate zones were not recorded for these runs.
            </p>
          )
        ) : rangeSummary?.value === null ? (
          <p className="history-explorer__empty">
            {METRIC_LABEL[metric]} was not recorded for these runs.
          </p>
        ) : (
          <HistoryMetricChart
            metric={metric}
            buckets={metricBuckets}
            selectedKey={selectedBucket?.key ?? null}
            onSelect={setSelectedBucketKey}
          />
        )}

        {coverageNote(metric, rangeSummary, zoneMix)}
        {range.isCoverageTruncated && (
          <p className="history-explorer__coverage">
            Available history begins {formatDateLabel(range.startDate)}; earlier time in this
            preset is unknown.
          </p>
        )}
      </section>

      <div className="history-selector history-selector--filter" aria-label="Filter runs">
        {HISTORY_FILTER_IDS.map((id) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            onClick={() => {
              setFilter(id);
              resetBrowsingSelection();
            }}
          >
            {FILTER_LABEL[id]}
          </button>
        ))}
      </div>

      <section className="history-explorer__runs" aria-labelledby="history-contributors-title">
        <div className="history-explorer__runs-heading">
          <div>
            <p className="machine-label">CONTRIBUTING RUNS</p>
            <h2 id="history-contributors-title">
              {metric === "zones" || !selectedBucket
                ? coveredDates
                : formatPeriod(selectedBucket.startDate, selectedBucket.endDate)}
            </h2>
          </div>
          <span className="machine-label">
            {contributingRuns.length} {contributingRuns.length === 1 ? "RUN" : "RUNS"}
          </span>
        </div>

        {contributingRuns.length > 0 ? (
          <>
            <ul className="runs-screen__list history-explorer__run-list">
              {visibleContributingRuns.map((run) => (
                <RunnerRunRow key={run.id} run={run} onOpen={() => onOpenRun(run)} />
              ))}
            </ul>
            {visibleContributingRuns.length < contributingRuns.length && (
              <Button
                variant="ghost"
                className="history-explorer__reveal"
                onClick={() =>
                  setVisibleRuns((count) => count + HISTORY_EXPLORER_PAGE_SIZE)
                }
              >
                Show {Math.min(
                  HISTORY_EXPLORER_PAGE_SIZE,
                  contributingRuns.length - visibleContributingRuns.length,
                )} more
              </Button>
            )}
          </>
        ) : (
          <p className="history-explorer__empty history-explorer__empty--runs">
            No runs match this selection.
          </p>
        )}
      </section>
    </div>
  );
}

interface HistoryMetricChartProps {
  metric: Exclude<HistoryMetricId, "zones">;
  buckets: readonly HistoryMetricBucket[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
}

function HistoryMetricChart({ metric, buckets, selectedKey, onSelect }: HistoryMetricChartProps) {
  const selectedIndex = Math.max(
    0,
    buckets.findIndex((bucket) => bucket.key === selectedKey),
  );
  const selected = buckets[selectedIndex] ?? null;
  const maximum = Math.max(0, ...buckets.map((bucket) => bucket.value ?? 0));
  const tickIndices = useMemo(
    () => sparseTickIndices(buckets.length, selectedIndex),
    [buckets.length, selectedIndex],
  );

  if (!selected) return null;

  return (
    <figure className="history-chart">
      <figcaption className="history-chart__selection" aria-live="polite">
        <span>{formatPeriod(selected.startDate, selected.endDate)}</span>
        <strong>{formatBucketReading(metric, selected)}</strong>
      </figcaption>
      <div className="history-chart__body">
        <div className="history-chart__y" aria-hidden="true">
          <span>{formatAxisValue(metric, maximum)}</span>
          <span>{formatAxisValue(metric, maximum / 2)}</span>
          <span>0</span>
        </div>
        <div className="history-chart__plot">
          <div
            className="history-chart__bars"
            style={{ "--history-buckets": buckets.length } as CSSProperties}
            aria-hidden="true"
          >
            {buckets.map((bucket, index) => (
              <span
                key={bucket.key}
                className="history-chart__bar-slot"
                data-selected={index === selectedIndex}
                data-missing={bucket.value === null}
              >
                <span
                  className="history-chart__bar"
                  style={
                    {
                      "--history-bar-height": `${
                        maximum > 0 && bucket.value !== null
                          ? Math.max(2, (bucket.value / maximum) * 100)
                          : 0
                      }%`,
                    } as CSSProperties
                  }
                />
              </span>
            ))}
          </div>
          {buckets.length > 1 && (
            <input
              className="history-chart__scrubber"
              type="range"
              min={0}
              max={buckets.length - 1}
              step={1}
              value={selectedIndex}
              aria-label={`Select ${METRIC_LABEL[metric]} period`}
              aria-valuetext={`${formatPeriod(selected.startDate, selected.endDate)}, ${formatBucketReading(metric, selected)}`}
              onChange={(event) => onSelect(buckets[Number(event.currentTarget.value)].key)}
            />
          )}
        </div>
      </div>
      <div
        className="history-chart__x"
        style={{ "--history-buckets": buckets.length } as CSSProperties}
        aria-hidden="true"
      >
        {buckets.map((bucket, index) => (
          <span key={bucket.key} data-selected={index === selectedIndex}>
            {tickIndices.includes(index) ? formatBucketTick(bucket, buckets) : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

function ZoneComposition({ mix }: { mix: HistoryZoneMix }) {
  return (
    <div className="history-zones" aria-label="Heart-rate zone composition">
      {[...mix.zones].reverse().map((zone) => (
        <div className="history-zones__row" key={zone.index}>
          <span>Z{zone.index + 1}</span>
          <span className="history-zones__track" aria-hidden="true">
            <span
              style={{ "--zone-share": `${zone.share * 100}%` } as CSSProperties}
              data-zone={Math.min(zone.index + 1, 7)}
            />
          </span>
          <strong>{Math.round(zone.share * 100)}%</strong>
        </div>
      ))}
    </div>
  );
}

function metricAvailability(runs: readonly RunnerRun[]): Record<HistoryMetricId, boolean> {
  return {
    miles: true,
    runs: true,
    time: runs.some((run) => run.durationSeconds !== null),
    load: runs.some((run) => run.trainingLoad !== null),
    gain: runs.some((run) => run.elevationGainFeet !== null),
    zones: runs.some(
      (run) => run.hrZoneSeconds !== null && run.hrZoneSeconds.some((seconds) => seconds > 0),
    ),
  };
}

function coverageNote(
  metric: HistoryMetricId,
  summary: ReturnType<typeof summarizeHistoryMetric> | null,
  zones: HistoryZoneMix,
) {
  const covered = metric === "zones" ? zones.coveredRuns : summary?.coveredRuns ?? 0;
  const total = metric === "zones" ? zones.totalRuns : summary?.totalRuns ?? 0;
  if (metric === "miles" || metric === "runs" || total === 0 || covered === 0) return null;
  const source = metric === "load" || metric === "gain" ? "Source-provided" : "Recorded";
  return (
    <p className="history-explorer__coverage">
      {source} for {covered} of {total} {total === 1 ? "run" : "runs"}.
    </p>
  );
}

function formatRangeResult(
  metric: HistoryMetricId,
  summary: ReturnType<typeof summarizeHistoryMetric> | null,
  zones: HistoryZoneMix,
): string {
  if (metric === "zones") {
    if (zones.coveredRuns === 0) return "Not recorded";
    return formatAggregateDuration(zones.totalSeconds);
  }
  if (!summary || summary.value === null) return "Not recorded";
  return formatMetricValue(metric, summary.value);
}

function formatBucketReading(
  metric: Exclude<HistoryMetricId, "zones">,
  bucket: HistoryMetricBucket,
): string {
  const value = bucket.value === null ? "Not recorded" : formatMetricValue(metric, bucket.value);
  return `${value} · ${bucket.runs.length} ${bucket.runs.length === 1 ? "run" : "runs"}`;
}

function formatMetricValue(metric: Exclude<HistoryMetricId, "zones">, value: number): string {
  switch (metric) {
    case "miles":
      return `${formatMiles(value)} mi`;
    case "runs":
      return `${value} ${value === 1 ? "run" : "runs"}`;
    case "time":
      return formatAggregateDuration(value);
    case "load":
      return `${Math.round(value)} load`;
    case "gain":
      return `${Math.round(value).toLocaleString("en-US")} ft`;
  }
}

function formatAggregateDuration(seconds: number): string {
  const totalMinutes = Math.round(seconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatAxisValue(metric: Exclude<HistoryMetricId, "zones">, value: number): string {
  if (metric === "time") {
    if (value >= 3600) return `${Number((value / 3600).toFixed(1))}h`;
    return `${Math.round(value / 60)}m`;
  }
  if (metric === "gain") {
    return value >= 1000 ? `${Number((value / 1000).toFixed(1))}k` : `${Math.round(value)}`;
  }
  return `${Number(value.toFixed(value < 10 && metric === "miles" ? 1 : 0))}`;
}

function formatPeriod(startDate: string, endDate: string, includeYear = false): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  };
  const start = formatDateLabel(startDate, options);
  const end = formatDateLabel(endDate, options);
  return startDate === endDate ? start : `${start} – ${end}`;
}

function formatBucketTick(bucket: HistoryBucket, buckets: readonly HistoryBucket[]): string {
  const isMonthly = bucket.key.startsWith("month:");
  const crossesYears = buckets[0]?.startDate.slice(0, 4) !== buckets.at(-1)?.endDate.slice(0, 4);
  return formatDateLabel(bucket.startDate, isMonthly
    ? { month: "short", ...(crossesYears ? { year: "2-digit" } : {}) }
    : { month: "short", day: "numeric" });
}
