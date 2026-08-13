import { formatDurationSeconds } from "../../domain/duration";

const WIDTH = 300;
const HEIGHT = 120;
const PADDING_X = 3;
const PADDING_Y = 12;
/** Below this many samples a quartile domain is noise, so use the real extent. */
const ROBUST_DOMAIN_MINIMUM_SAMPLES = 8;
/** Tukey's usual multiplier: beyond this much IQR past a quartile is an outlier. */
const IQR_FENCE = 1.5;
const DOMAIN_PADDING = 0.08;
/** Shorter than this and a midpoint tick says nothing the ends do not. */
const MIDPOINT_LABEL_MINIMUM_SECONDS = 120;

export interface RunProfilePoint {
  timeSeconds: number;
  /** Null where the upstream stream carried no value at this time position. */
  value: number | null;
}

export interface RunProfileFact {
  label: string;
  value: string;
}

interface RunProfileChartProps {
  points: RunProfilePoint[];
  /**
   * What to state beneath the chart. Deliberately supplied rather than
   * derived: an authoritative imported aggregate beats anything this
   * component could compute from per-sample values, and for pace an
   * arithmetic mean of instantaneous samples is not a fact about the run at
   * all. Only elevation's low/high genuinely belong to the series.
   */
  facts: RunProfileFact[];
  /** Pace: lower is faster, so a faster pace should read higher on the chart. */
  invert?: boolean;
  /**
   * Scales the visible y-axis to the bulk of the series instead of its
   * extremes, so a few near-stop or GPS artefacts cannot flatten everything
   * else into a line. This is a display decision only — no sample is dropped,
   * rewritten, or excluded from the facts above.
   */
  robustDomain?: boolean;
  tone?: "accent" | "long" | "intervals";
}

function percentile(sorted: readonly number[], fraction: number): number {
  const position = (sorted.length - 1) * fraction;
  const low = Math.floor(position);
  const high = Math.ceil(position);
  return low === high ? sorted[low] : sorted[low] + (sorted[high] - sorted[low]) * (position - low);
}

/**
 * The window of values the y-axis covers. Outside a robust domain the extent
 * is simply the data's own range.
 *
 * The robust window uses Tukey's fences — a quartile and a multiple of the
 * interquartile range — rather than a fixed high percentile. A percentile
 * only excludes a known fraction of the samples, so on a short series it
 * interpolates straight back into the very outlier it was meant to keep out;
 * the IQR asks the different and better question of how far from the bulk a
 * value has to be before it stops describing the run.
 */
function displayDomain(values: readonly number[], robust: boolean): { low: number; high: number } {
  const low = Math.min(...values);
  const high = Math.max(...values);
  if (!robust || values.length < ROBUST_DOMAIN_MINIMUM_SAMPLES) return { low, high };
  const sorted = [...values].sort((a, b) => a - b);
  const quartileRange = percentile(sorted, 0.75) - percentile(sorted, 0.25);
  // A flat series has no spread to reason about; its own extent is honest.
  if (!(quartileRange > 0)) return { low, high };
  const fenceLow = Math.max(low, percentile(sorted, 0.25) - IQR_FENCE * quartileRange);
  const fenceHigh = Math.min(high, percentile(sorted, 0.75) + IQR_FENCE * quartileRange);
  if (!(fenceHigh > fenceLow)) return { low, high };
  const padding = (fenceHigh - fenceLow) * DOMAIN_PADDING;
  return { low: fenceLow - padding, high: fenceHigh + padding };
}

/**
 * One metric plotted over the run's elapsed time — a continuous line rather
 * than the date-scaled, per-point-selectable trend lines Training Signals
 * use, since a run has no dates to select between.
 *
 * A time position whose value is missing breaks the line rather than joining
 * its neighbours: a stream that stopped recording must not be drawn as though
 * it kept going. The facts beneath, not the line, are the accessible
 * authority, and they are given to this component rather than derived here.
 */
export function RunProfileChart({
  points,
  facts,
  invert = false,
  robustDomain = false,
  tone = "accent",
}: RunProfileChartProps) {
  const values = points.flatMap((point) => (point.value === null ? [] : [point.value]));
  if (values.length < 2) return null;
  const lastTime = points[points.length - 1]?.timeSeconds || 1;

  const { low, high } = displayDomain(values, robustDomain);
  const span = high - low || Math.max(Math.abs(high) * 0.1, 1);

  const plot = (point: { timeSeconds: number; value: number }) => {
    const x = PADDING_X + (point.timeSeconds / lastTime) * (WIDTH - PADDING_X * 2);
    // Clamped for drawing only: an outlier sits at the edge of the visible
    // window instead of dictating it. `points` itself is never touched.
    const clamped = Math.min(Math.max(point.value, low), high);
    const ratio = (clamped - low) / span;
    const normalized = invert ? 1 - ratio : ratio;
    return { x, y: HEIGHT - PADDING_Y - normalized * (HEIGHT - PADDING_Y * 2) };
  };

  /** Contiguous runs of measured samples; each is drawn as its own line. */
  const runs = points.reduce<Array<Array<{ x: number; y: number }>>>((result, point) => {
    if (point.value === null) return [...result, []];
    const current = result[result.length - 1] ?? [];
    const rest = result.slice(0, -1);
    return [...rest, [...current, plot({ timeSeconds: point.timeSeconds, value: point.value })]];
  }, [[]]);

  const showMidpoint = lastTime >= MIDPOINT_LABEL_MINIMUM_SECONDS;

  return (
    <div className={`run-profile-chart technical-grid chart--${tone}`}>
      <svg
        className="chart run-profile-chart__figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-hidden="true"
        focusable="false"
      >
        <line x1="0" y1={HEIGHT - 1} x2={WIDTH} y2={HEIGHT - 1} className="chart__axis" />
        {runs.map((run, index) =>
          run.length > 1 ? (
            <polyline
              key={index}
              className="chart__line"
              points={run.map(({ x, y }) => `${x},${y}`).join(" ")}
            />
          ) : run.length === 1 ? (
            // A lone measured sample between two gaps is still a fact; a
            // one-point polyline would draw nothing at all.
            <circle key={index} className="chart__dot" cx={run[0].x} cy={run[0].y} r="1.5" />
          ) : null,
        )}
      </svg>
      <div className="run-profile-chart__axis machine-label" aria-hidden="true">
        <span>0:00</span>
        {showMidpoint && <span>{formatDurationSeconds(Math.round(lastTime / 2))}</span>}
        <span>{formatDurationSeconds(Math.round(lastTime))}</span>
      </div>
      {facts.length > 0 && (
        <dl className="run-profile-chart__facts" data-count={facts.length}>
          {facts.map((fact) => (
            <div key={fact.label}>
              <dd className="data-value">{fact.value}</dd>
              <dt className="machine-label">{fact.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}
