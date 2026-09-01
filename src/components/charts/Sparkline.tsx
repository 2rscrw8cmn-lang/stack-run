import { useId } from "react";
import {
  contiguousRuns,
  displayDomain,
  domainSpan,
  ratioAtTime,
  type ActivitySample,
} from "./activityChartGeometry.js";

const WIDTH = 200;
const HEIGHT = 48;

interface SparklineProps {
  /** Which metric this is, for the semantic colour the stylesheet attaches. */
  metric: string;
  samples: readonly ActivitySample[];
  /** Pace: lower is faster, so a faster pace should read higher. */
  invert?: boolean;
}

/**
 * The shape of one metric over the run, at a glance.
 *
 * Not a small chart: a *silhouette*. It carries no axis, no cursor and no
 * numbers, because the module around it states the figures and the Analysis
 * module above it is where a runner goes to interrogate the series. What this
 * adds is the thing a number cannot — whether the run climbed steadily or in
 * two lumps, whether cadence held or fell away — without asking anybody to
 * change tabs to find out.
 *
 * It obeys the same truth rules as the full chart: a gap in the stream is drawn
 * as a gap, and nothing here is ever averaged into a stated value.
 */
export function Sparkline({ metric, samples, invert = false }: SparklineProps) {
  const gradientId = useId();
  const measured = samples.flatMap((sample) => (sample.value === null ? [] : [sample.value]));
  const lastTime = samples.length > 0 ? samples[samples.length - 1].timeSeconds : 0;
  if (measured.length < 2 || lastTime <= 0) return null;

  const domain = displayDomain(measured);
  const span = domainSpan(domain);
  const plot = (sample: { timeSeconds: number; value: number }) => {
    const ratio = (sample.value - domain.low) / span;
    const normalized = invert ? 1 - ratio : ratio;
    return {
      x: ratioAtTime(sample.timeSeconds, lastTime) * WIDTH,
      // A hairline of headroom top and bottom, so the peaks are not clipped.
      y: 2 + (1 - normalized) * (HEIGHT - 4),
    };
  };

  const runs = contiguousRuns(samples).map((run) => run.map(plot));

  return (
    <svg
      className="sparkline"
      data-metric={metric}
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop className="sparkline__stop sparkline__stop--top" offset="0%" />
          <stop className="sparkline__stop sparkline__stop--bottom" offset="100%" />
        </linearGradient>
      </defs>
      {runs.map((run, index) =>
        run.length > 1 ? (
          <path
            key={`fill-${index}`}
            className="sparkline__area"
            fill={`url(#${gradientId})`}
            d={`${run.map((point, at) => `${at === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")} L${run[run.length - 1].x},${HEIGHT} L${run[0].x},${HEIGHT} Z`}
          />
        ) : null,
      )}
      {runs.map((run, index) =>
        run.length > 1 ? (
          <path
            key={`line-${index}`}
            className="sparkline__line"
            d={run.map((point, at) => `${at === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ")}
          />
        ) : null,
      )}
    </svg>
  );
}
