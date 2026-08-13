const WIDTH = 300;
const HEIGHT = 120;
const PADDING_X = 3;
const PADDING_Y = 12;

export interface RunProfileSample {
  timeSeconds: number;
  value: number;
}

interface RunProfileChartProps {
  samples: RunProfileSample[];
  formatValue: (value: number) => string;
  /** Pace: lower is faster, so a faster pace should read higher on the chart. */
  invert?: boolean;
  tone?: "accent" | "long" | "intervals";
}

/**
 * One metric plotted over the run's elapsed time — a continuous line rather
 * than the date-scaled, per-point-selectable trend lines Training Signals
 * use, since a run has no dates to select between. `Low`/`Avg`/`High` is the
 * accessible authority; the line itself is presentational.
 */
export function RunProfileChart({ samples, formatValue, invert = false, tone = "accent" }: RunProfileChartProps) {
  if (samples.length < 2) return null;
  const values = samples.map((sample) => sample.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || Math.max(high * 0.1, 1);
  const lastTime = samples[samples.length - 1].timeSeconds || 1;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;

  const plot = (sample: RunProfileSample) => {
    const x = PADDING_X + (sample.timeSeconds / lastTime) * (WIDTH - PADDING_X * 2);
    const ratio = (sample.value - low) / span;
    const normalized = invert ? 1 - ratio : ratio;
    const y = HEIGHT - PADDING_Y - normalized * (HEIGHT - PADDING_Y * 2);
    return { x, y };
  };
  const points = samples.map(plot);

  return (
    <div className={`run-profile-chart technical-grid chart--${tone}`}>
      <svg
        className="chart run-profile-chart__figure"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        aria-hidden="true"
        focusable="false"
      >
        <line x1="0" y1={HEIGHT - 1} x2={WIDTH} y2={HEIGHT - 1} className="chart__axis" />
        <polyline
          className="chart__line"
          points={points.map(({ x, y }) => `${x},${y}`).join(" ")}
        />
      </svg>
      <dl className="run-profile-chart__facts">
        <div><dd className="data-value">{formatValue(low)}</dd><dt className="machine-label">Low</dt></div>
        <div><dd className="data-value">{formatValue(average)}</dd><dt className="machine-label">Avg</dt></div>
        <div><dd className="data-value">{formatValue(high)}</dd><dt className="machine-label">High</dt></div>
      </dl>
    </div>
  );
}
