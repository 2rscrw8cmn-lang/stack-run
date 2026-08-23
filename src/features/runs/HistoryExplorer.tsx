import { ChevronLeft } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { defaultSelectedIndex } from "../../components/charts/chartDefaultSelection";
import { sparseTickIndices } from "../../components/charts/chartTickDensity";
import { formatDateLabel } from "../../domain/dates";
import { formatRunsMiles } from "../../domain/distance";
import type { RunnerRun } from "../../history/runnerRun";
import { RunnerRunRow } from "./RunnerRunRow";
import {
  HISTORY_METRIC_IDS,
  HISTORY_RANGE_IDS,
  aggregateHistoryMetric,
  aggregateHistoryZones,
  createHistoryBuckets,
  defaultHistoryRange,
  earliestKnownDate,
  earliestRunningDate,
  historyChartKind,
  readHistoryRange,
  resolveHistoryDateRange,
  runsInHistoryRange,
  type HistoryBucket,
  type HistoryMetricBucket,
  type HistoryMetricId,
  type HistoryRangeId,
  type HistoryRangeReading,
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
  all: "All",
};

/** What the equally long window before the selected range is called out loud. */
const PRIOR_LABEL: Record<HistoryRangeId, string> = {
  "4w": "prior 4 weeks",
  "3m": "prior 3 months",
  "6m": "prior 6 months",
  ytd: "prior period",
  "1y": "prior year",
  all: "prior period",
};

interface HistoryExplorerProps {
  runs: readonly RunnerRun[];
  today: string;
  onBack: () => void;
  onOpenRun: (run: RunnerRun) => void;
}

/**
 * The complete chronology/lookup depth inside Runs.
 *
 * One instrument rather than a control panel: choose a metric, choose a range,
 * read one result, see the shape, then see the runs behind it. The interface
 * around that stays quiet — sans labels, small controls, no permanent filter
 * rows exposing STACK's own data model — and the running data carries the
 * personality.
 */
export function HistoryExplorer({ runs, today, onBack, onOpenRun }: HistoryExplorerProps) {
  const [metric, setMetric] = useState<HistoryMetricId>("miles");
  const [rangeId, setRangeId] = useState<HistoryRangeId>(() =>
    defaultHistoryRange(runs, today),
  );
  /** Null until the runner picks a period themselves; the chart still has a default. */
  const [selectedBucketKey, setSelectedBucketKey] = useState<string | null>(null);
  const [visibleRuns, setVisibleRuns] = useState(HISTORY_EXPLORER_PAGE_SIZE);
  const headingRef = useRef<HTMLHeadingElement>(null);

  /**
   * A child screen opens at its own top with its own title focused, the way
   * navigation behaves. `RunsScreen` owns the scroll positions; this only moves
   * the reading order to the screen the runner just opened.
   */
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);

  const earliest = earliestKnownDate(runs, today);
  const earliestRunning = earliestRunningDate(runs, today);
  const range = resolveHistoryDateRange(runs, today, rangeId);
  const rangedRuns = runsInHistoryRange(runs, range);
  const buckets = createHistoryBuckets(rangedRuns, range);
  const chartKind = historyChartKind(metric);
  const metricBuckets =
    metric === "zones" ? [] : aggregateHistoryMetric(buckets, metric);
  const defaultIndex = defaultSelectedIndex(
    metricBuckets.map((bucket) => ({ value: bucket.value, isPartial: bucket.isInProgress })),
  );
  const explicitIndex = metricBuckets.findIndex((bucket) => bucket.key === selectedBucketKey);
  const selectedIndex = explicitIndex >= 0 ? explicitIndex : defaultIndex;
  const selectedBucket = metricBuckets[selectedIndex] ?? null;
  const reading =
    metric === "zones" ? null : readHistoryRange(runs, range, metric, earliestRunning);
  const zoneMix = aggregateHistoryZones(rangedRuns);
  const availability = metricAvailability(rangedRuns);

  /**
   * The list follows the range the runner chose. Picking one period out of the
   * chart narrows it to that period — and says so in its own heading — so the
   * runs behind a bar are one tap away without the default view pretending four
   * weeks of running is one week.
   */
  const isNarrowed = explicitIndex >= 0 && selectedBucket !== null;
  const listedRuns = (isNarrowed ? selectedBucket.runs : rangedRuns)
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));
  const visibleListedRuns = listedRuns.slice(0, visibleRuns);
  const listPeriod = isNarrowed
    ? formatPeriod(selectedBucket.startDate, selectedBucket.endDate)
    : // `Aug 17 – Aug 17` is not a year of running: a range that crosses a year
      // boundary has to say which years it means.
      formatPeriod(
        range.startDate,
        range.endDate,
        range.startDate.slice(0, 4) !== range.endDate.slice(0, 4),
      );

  function resetBrowsingSelection() {
    setSelectedBucketKey(null);
    setVisibleRuns(HISTORY_EXPLORER_PAGE_SIZE);
  }

  return (
    <div className="history-explorer">
      <header className="history-explorer__header">
        <button
          type="button"
          className="history-explorer__back"
          aria-label="Back to Runs"
          onClick={onBack}
        >
          <ChevronLeft size={22} strokeWidth={2} aria-hidden="true" />
        </button>
        <h1 ref={headingRef} tabIndex={-1}>
          History
        </h1>
      </header>

      <div className="history-explorer__controls">
        <div className="history-metrics" role="tablist" aria-label="History metric">
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
              <span>{METRIC_LABEL[id]}</span>
            </button>
          ))}
        </div>

        <div className="history-ranges" aria-label="History range">
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
              <span>{RANGE_LABEL[id]}</span>
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
        <div className="history-readout">
          <p className="history-readout__metric">{METRIC_LABEL[metric]}</p>
          <p className="history-readout__value">
            {metric === "zones" ? (
              <ZoneHeadline mix={zoneMix} />
            ) : (
              <MetricHeadline metric={metric} value={reading?.value ?? null} />
            )}
            <span className="history-readout__period">
              {formatPeriod(range.startDate, range.endDate, true)}
            </span>
          </p>
          <p className="history-readout__context">
            {metric === "zones"
              ? zoneContextLine(zoneMix)
              : metricContextLine(metric, rangeId, reading)}
          </p>
          {chartKind !== "composition" && selectedBucket && (
            <p className="history-readout__selection" aria-live="polite">
              {formatPeriod(selectedBucket.startDate, selectedBucket.endDate)} ·{" "}
              {formatBucketReading(metric as Exclude<HistoryMetricId, "zones">, selectedBucket)}
              {selectedBucket.isInProgress ? " · In progress" : ""}
            </p>
          )}
        </div>

        {rangedRuns.length === 0 ? (
          <p className="history-explorer__empty">No runs recorded in this range.</p>
        ) : chartKind === "composition" ? (
          zoneMix.coveredRuns > 0 ? (
            <ZoneComposition mix={zoneMix} />
          ) : (
            <p className="history-explorer__empty">
              Heart-rate zones were not recorded for these runs.
            </p>
          )
        ) : reading?.value === null ? (
          <p className="history-explorer__empty">
            {METRIC_LABEL[metric]} was not recorded for these runs.
          </p>
        ) : (
          <HistoryMetricChart
            metric={metric as Exclude<HistoryMetricId, "zones">}
            kind={chartKind}
            buckets={metricBuckets}
            selectedIndex={selectedIndex}
            onSelect={setSelectedBucketKey}
          />
        )}

        {range.isCoverageTruncated && (
          <p className="history-explorer__coverage">
            Available history begins {formatDateLabel(range.startDate)}; earlier time in
            this preset is unknown.
          </p>
        )}
      </section>

      <section className="history-explorer__runs" aria-labelledby="history-runs-title">
        <div className="history-explorer__runs-heading">
          <h2 id="history-runs-title">Activities in period</h2>
          <span className="history-explorer__runs-count machine-label">
            {listedRuns.length} {listedRuns.length === 1 ? "ACTIVITY" : "ACTIVITIES"}
          </span>
        </div>
        <p className="history-explorer__runs-period machine-label">{listPeriod}</p>

        {listedRuns.length > 0 ? (
          <ul className="runs-screen__list history-explorer__run-list">
            {visibleListedRuns.map((run) => (
              <RunnerRunRow key={run.id} run={run} onOpen={() => onOpenRun(run)} />
            ))}
          </ul>
        ) : (
          <p className="history-explorer__empty history-explorer__empty--runs">
            No activities recorded in this period.
          </p>
        )}

        <div className="history-explorer__runs-actions">
          {visibleListedRuns.length < listedRuns.length && (
            <Button
              variant="ghost"
              onClick={() => setVisibleRuns((count) => count + HISTORY_EXPLORER_PAGE_SIZE)}
            >
              Show more
            </Button>
          )}
          {/* A period with nothing in it still has to lead back to the range. */}
          {isNarrowed && (
            <Button variant="ghost" onClick={resetBrowsingSelection}>
              Show the whole range
            </Button>
          )}
        </div>
      </section>
    </div>
  );
}

function MetricHeadline({
  metric,
  value,
}: {
  metric: HistoryMetricId;
  value: number | null;
}) {
  if (value === null) return <strong>Not recorded</strong>;
  const reading = formatMetricValue(metric as Exclude<HistoryMetricId, "zones">, value);
  return (
    <>
      <strong>{reading.value}</strong>
      {reading.unit && <span className="history-readout__unit">{reading.unit}</span>}
    </>
  );
}

/** Zones lead with what the composition was, not with how much time was recorded. */
function ZoneHeadline({ mix }: { mix: HistoryZoneMix }) {
  if (mix.lowerZoneShare === null) return <strong>Not recorded</strong>;
  return (
    <>
      <strong>{Math.round(mix.lowerZoneShare * 100)}%</strong>
      <span className="history-readout__unit">Z1–Z2</span>
    </>
  );
}

interface HistoryMetricChartProps {
  metric: Exclude<HistoryMetricId, "zones">;
  kind: "bar" | "line";
  buckets: readonly HistoryMetricBucket[];
  selectedIndex: number;
  onSelect: (key: string) => void;
}

/**
 * One chart frame, two mark languages.
 *
 * Axis labels, touch target and the accessible readout are identical whether
 * the metric is drawn as columns or as a line, so density and readability stay
 * a system rather than a per-chart decision.
 */
function HistoryMetricChart({
  metric,
  kind,
  buckets,
  selectedIndex,
  onSelect,
}: HistoryMetricChartProps) {
  const selected = buckets[selectedIndex] ?? null;
  const maximum = Math.max(0, ...buckets.map((bucket) => bucket.value ?? 0));
  const tickIndices = sparseTickIndices(buckets.length);

  if (!selected) return null;

  return (
    <figure className="history-chart" data-kind={kind}>
      <div className="history-chart__body">
        <div className="history-chart__y" aria-hidden="true">
          <span>{formatAxisValue(metric, maximum)}</span>
          <span>{formatAxisValue(metric, maximum / 2)}</span>
          <span>0</span>
        </div>
        <div className="history-chart__plot">
          {kind === "bar" ? (
            <HistoryBars buckets={buckets} maximum={maximum} selectedIndex={selectedIndex} />
          ) : (
            <HistoryLine buckets={buckets} maximum={maximum} selectedIndex={selectedIndex} />
          )}
          {buckets.length > 1 && (
            <input
              className="history-chart__scrubber"
              type="range"
              min={0}
              max={buckets.length - 1}
              step={1}
              value={selectedIndex}
              aria-label={`Select ${METRIC_LABEL[metric]} period`}
              aria-valuetext={`${formatPeriod(selected.startDate, selected.endDate)}, ${formatBucketReading(metric, selected)}${selected.isInProgress ? ", in progress" : ""}`}
              onChange={(event) => onSelect(buckets[Number(event.currentTarget.value)].key)}
            />
          )}
        </div>
      </div>
      <figcaption className="history-chart__x" aria-hidden="true">
        {tickIndices.map((index) => (
          <span
            key={buckets[index].key}
            data-selected={index === selectedIndex}
            data-edge={index === 0 ? "start" : index === buckets.length - 1 ? "end" : undefined}
            style={
              { "--tick-x": `${((index + 0.5) / buckets.length) * 100}%` } as CSSProperties
            }
          >
            {formatBucketTick(buckets[index], buckets)}
          </span>
        ))}
      </figcaption>
    </figure>
  );
}

interface HistoryPlotProps {
  buckets: readonly HistoryMetricBucket[];
  maximum: number;
  selectedIndex: number;
}

function HistoryBars({ buckets, maximum, selectedIndex }: HistoryPlotProps) {
  return (
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
          data-progress={bucket.isInProgress}
        >
          <span
            className="history-chart__bar"
            style={
              {
                "--history-bar-height": `${barHeight(bucket.value, maximum)}%`,
              } as CSSProperties
            }
          />
        </span>
      ))}
    </div>
  );
}

function barHeight(value: number | null, maximum: number): number {
  if (value === null || maximum <= 0) return 0;
  return Math.max(2, (value / maximum) * 100);
}

/**
 * Chronological shape for the metrics that are read as movement.
 *
 * A period with no recorded value breaks the line rather than being joined
 * through, so the drawing never claims a value STACK does not have. The stroke
 * keeps its width under the non-uniform scale, and the point markers are laid
 * out in the document rather than the plot so they stay round at any width.
 */
function HistoryLine({ buckets, maximum, selectedIndex }: HistoryPlotProps) {
  const points = buckets.map((bucket, index) =>
    bucket.value === null
      ? null
      : {
          x: ((index + 0.5) / buckets.length) * 100,
          y: 100 - (maximum > 0 ? (bucket.value / maximum) * 92 : 0),
        },
  );
  const segments: Array<Array<{ x: number; y: number }>> = [];
  for (const point of points) {
    if (point === null) {
      if (segments.at(-1)?.length) segments.push([]);
      continue;
    }
    if (segments.length === 0) segments.push([]);
    segments[segments.length - 1].push(point);
  }
  const showEveryPoint = buckets.length <= 14;

  return (
    <>
      <svg
        className="history-chart__line"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {segments.map((segment) =>
          segment.length > 1 ? (
            <polyline
              key={segment[0].x}
              vectorEffect="non-scaling-stroke"
              points={segment.map((point) => `${point.x},${point.y}`).join(" ")}
            />
          ) : null,
        )}
      </svg>
      <div className="history-chart__points" aria-hidden="true">
        {points.map((point, index) =>
          point === null || !(showEveryPoint || index === selectedIndex) ? null : (
            <span
              key={buckets[index].key}
              data-selected={index === selectedIndex}
              data-progress={buckets[index].isInProgress}
              style={{ "--point-x": `${point.x}%`, "--point-y": `${point.y}%` } as CSSProperties}
            />
          ),
        )}
      </div>
    </>
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
  const running = runs.filter((run) => run.stack?.activityType !== "cross" && run.sourceType !== "HighIntensityIntervalTraining");
  return {
    miles: true,
    runs: true,
    time: running.some((run) => run.durationSeconds !== null),
    load: running.some((run) => run.trainingLoad !== null),
    gain: running.some((run) => run.elevationGainFeet !== null),
    zones: running.some(
      (run) => run.hrZoneSeconds !== null && run.hrZoneSeconds.some((seconds) => seconds > 0),
    ),
  };
}

/**
 * The one supporting line the summary is allowed.
 *
 * Required metrics get their comparison and their rate. Optional ones get their
 * comparison and their coverage, because a total nobody can see the coverage of
 * implies every run contributed to it.
 */
function metricContextLine(
  metric: HistoryMetricId,
  rangeId: HistoryRangeId,
  reading: HistoryRangeReading | null,
): string {
  if (!reading || reading.value === null) return "No recorded values in this range.";
  const exact = metric as Exclude<HistoryMetricId, "zones">;
  const parts: string[] = [];

  if (reading.priorValue !== null) {
    const difference = reading.value - reading.priorValue;
    parts.push(`${signed(exact, difference)} vs ${PRIOR_LABEL[rangeId]}`);
  }

  const isOptional = metric === "time" || metric === "load" || metric === "gain";
  if (isOptional && reading.coveredRuns < reading.totalRuns) {
    // Coverage only where it changes what the total means. Saying "recorded for
    // 15 of 15" spends the line on nothing.
    parts.push(
      `${metric === "gain" || metric === "load" ? "Source-provided" : "Recorded"} for ${reading.coveredRuns} of ${reading.totalRuns} ${reading.totalRuns === 1 ? "run" : "runs"}`,
    );
  } else if (metric !== "load" && metric !== "gain" && reading.perWeek !== null) {
    parts.push(`avg ${formatPerWeek(exact, reading.perWeek)}`);
  }

  if (parts.length === 0) {
    parts.push(`${reading.runCount} ${reading.runCount === 1 ? "run" : "runs"} in range`);
  }
  return parts.join(" · ");
}

function zoneContextLine(mix: HistoryZoneMix): string {
  if (mix.coveredRuns === 0) return "Heart-rate zones were not recorded in this range.";
  return `${formatAggregateDuration(mix.totalSeconds)} recorded · ${mix.coveredRuns} of ${mix.totalRuns} ${mix.totalRuns === 1 ? "run" : "runs"}`;
}

function signed(metric: Exclude<HistoryMetricId, "zones">, difference: number): string {
  const sign = difference > 0 ? "+" : difference < 0 ? "−" : "";
  const magnitude = formatMetricValue(metric, Math.abs(difference));
  return `${sign}${magnitude.value}${magnitude.unit ? ` ${magnitude.unit}` : ""}`;
}

function formatPerWeek(metric: Exclude<HistoryMetricId, "zones">, perWeek: number): string {
  if (metric === "runs") return `${perWeek.toFixed(1)} runs/wk`;
  if (metric === "time") return `${formatAggregateDuration(perWeek)}/wk`;
  return `${formatRunsMiles(perWeek)} mi/wk`;
}

function formatBucketReading(
  metric: Exclude<HistoryMetricId, "zones">,
  bucket: HistoryMetricBucket,
): string {
  if (bucket.value === null) {
    return `Not recorded · ${bucket.runs.length} ${bucket.runs.length === 1 ? "run" : "runs"}`;
  }
  const reading = formatMetricValue(metric, bucket.value);
  const value = `${reading.value}${reading.unit ? ` ${reading.unit}` : ""}`;
  if (metric === "runs") return value;
  return `${value} · ${bucket.runs.length} ${bucket.runs.length === 1 ? "run" : "runs"}`;
}

interface MetricReading {
  value: string;
  unit: string | null;
}

function formatMetricValue(
  metric: Exclude<HistoryMetricId, "zones">,
  value: number,
): MetricReading {
  switch (metric) {
    case "miles":
      return { value: formatRunsMiles(value), unit: "mi" };
    case "runs":
      return { value: String(Math.round(value)), unit: value === 1 ? "run" : "runs" };
    case "time":
      return { value: formatAggregateDuration(value), unit: null };
    case "load":
      return { value: String(Math.round(value)), unit: "load" };
    case "gain":
      return { value: Math.round(value).toLocaleString("en-US"), unit: "ft" };
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
  return formatDateLabel(
    bucket.startDate,
    isMonthly
      ? { month: "short", ...(crossesYears ? { year: "2-digit" } : {}) }
      : { month: "short", day: "numeric" },
  );
}
