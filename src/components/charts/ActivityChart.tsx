import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { formatDurationSeconds } from "../../domain/duration.js";
import {
  axisTicks,
  contiguousRuns,
  displayDomain,
  domainSpan,
  nearestSampleIndex,
  ratioAtTime,
  timeAtRatio,
  type ActivitySample,
} from "./activityChartGeometry.js";

const WIDTH = 320;
const HEIGHT = 150;
/**
 * Room for the y-axis labels, which sit inside the figure so they cannot drift
 * out of step with the plot. Wide enough for the longest label any metric
 * produces — a five-character pace like `10:50` — because a clipped axis label
 * is worse than no axis at all.
 */
const PADDING_LEFT = 46;
/** Room on the right for the overlay's own axis, when one is drawn. */
const PADDING_RIGHT_WITH_OVERLAY = 34;
const PADDING_RIGHT = 6;
const PADDING_TOP = 12;
const PADDING_BOTTOM = 14;
const PLOT_HEIGHT = HEIGHT - PADDING_TOP - PADDING_BOTTOM;
/** Shorter than this and a midpoint tick says nothing the ends do not. */
const MIDPOINT_LABEL_MINIMUM_SECONDS = 120;
/**
 * How much of the plot's height a background silhouette may reach.
 *
 * The overlay is context, not a second reading: keeping it under the metric's
 * own line means a runner never has to work out which of two shapes is the one
 * the tab is named after.
 */
const OVERLAY_HEIGHT_RATIO = 0.55;
/** One arrow key moves the cursor this share of the run. */
const KEYBOARD_STEP_RATIO = 0.02;

export type ActivityChartShape = "line" | "area" | "step";

/** A horizontal line the series is read against — an imported average, say. */
export interface ActivityChartReference {
  value: number;
  label: string;
}

/**
 * Another stream, read at the selected time position and stated in the callout.
 *
 * Companions never get their own axis and never change the domain. They exist
 * because "what was my heart rate at that hill?" is the question a scrubbing
 * finger is actually asking.
 */
export interface ActivityChartCompanion {
  id: string;
  label: string;
  samples: readonly ActivitySample[];
  format: (value: number) => string;
}

interface ActivityChartProps {
  /** Which metric this is, for the semantic colour the stylesheet attaches. */
  metric: string;
  /** The metric's own name, used in the accessible description. */
  label: string;
  samples: readonly ActivitySample[];
  shape?: ActivityChartShape;
  /** Pace: lower is faster, so a faster pace should read higher on the chart. */
  invert?: boolean;
  /**
   * Scales the visible y-axis to the bulk of the series instead of its
   * extremes. A display decision only — no sample is dropped or rewritten.
   */
  robustDomain?: boolean;
  /** How one value is stated in the callout. */
  formatValue: (value: number) => string;
  /** How one value is stated on the y-axis; defaults to `formatValue`. */
  formatAxis?: (value: number) => string;
  references?: readonly ActivityChartReference[];
  /**
   * A quieter second series drawn behind this one — the run's elevation under
   * its pace, as the approved reference shows. It gets its own axis on the
   * right and its own name in the legend, because a shape with no scale is
   * decoration; what it never does is enter the domain of the metric above it
   * or contribute a number to anything stated elsewhere.
   */
  overlay?: {
    samples: readonly ActivitySample[];
    label: string;
    /** How one overlay value is labelled on its own axis. */
    formatAxis: (value: number) => string;
  } | null;
  /** The active metric's unit, stated once under its axis rather than on every tick. */
  unitLabel?: string;
  companions?: readonly ActivityChartCompanion[];
}

function pathFrom(points: readonly { x: number; y: number }[], shape: ActivityChartShape): string {
  if (points.length === 0) return "";
  if (shape !== "step") {
    return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  }
  // A step holds each sample's value until the next one arrives, which is what
  // a per-sample cadence reading actually claims: it is a count over the last
  // interval, not a point on a smooth curve through it.
  return points
    .map((point, index) => (index === 0 ? `M${point.x},${point.y}` : `H${point.x} V${point.y}`))
    .join(" ");
}

/**
 * One metric over the run's elapsed time, drawn to be investigated.
 *
 * This replaces the static Run Profile line. The differences that matter are
 * not cosmetic:
 *
 * - **it can be scrubbed.** A finger dragged across the plot moves a crosshair,
 *   selects the nearest recorded time position and states what was measured
 *   there, and the selection stays put when the finger lifts so it can be read.
 *   Keyboard users get the same cursor through the arrow keys, and the current
 *   reading is exposed as `aria-valuetext` rather than only drawn.
 * - **it has a real y-axis.** Two or three round values with the metric's own
 *   units, so the shape can be turned into numbers without touching it.
 * - **each metric gets a treatment that suits it.** A line for pace, a filled
 *   profile for elevation, a step for cadence — set by the caller, because what
 *   a stream means is not this component's business.
 *
 * What has not changed is the truth contract. A gap in the stream is drawn as
 * a gap; a clamped outlier is clamped for drawing only; and every number stated
 * *around* the chart comes from the source's own aggregates rather than from
 * these samples.
 */
export function ActivityChart({
  metric,
  label,
  samples,
  shape = "line",
  invert = false,
  robustDomain = false,
  formatValue,
  formatAxis,
  references = [],
  overlay = null,
  unitLabel,
  companions = [],
}: ActivityChartProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const describedById = useId();

  const measured = samples.flatMap((sample) => (sample.value === null ? [] : [sample.value]));
  const lastTime = samples.length > 0 ? samples[samples.length - 1].timeSeconds : 0;

  /**
   * A selection belongs to the series it was made on: switching metric must
   * not leave a crosshair pointing at a sample index that means something else
   * now. Adjusted during render, the way `DonutChart` re-defaults when it is
   * handed a different composition — this is derived state, not a
   * synchronization with anything outside React. Switching *run* is the
   * caller's business: Run Detail keys this component by the run, so a reopened
   * sheet starts from the whole run.
   */
  const [selectedFor, setSelectedFor] = useState(metric);
  if (selectedFor !== metric) {
    setSelectedFor(metric);
    setSelectedIndex(null);
  }

  /**
   * The scrub surface covers the plot itself rather than the whole figure, so
   * a ratio across it is a ratio through the run — the y-axis gutter is not
   * part of the timeline and must not shift every reading left by its width.
   */
  const select = useCallback((clientX: number) => {
    const surface = surfaceRef.current;
    if (!surface || samples.length === 0) return;
    const bounds = surface.getBoundingClientRect();
    if (bounds.width <= 0) return;
    const time = timeAtRatio((clientX - bounds.left) / bounds.width, lastTime);
    setSelectedIndex(nearestSampleIndex(samples, time));
  }, [lastTime, samples]);

  /**
   * A tap anywhere else puts the chart back to the whole-run state. Listening
   * on the document rather than on a blur keeps a locked reading alive while
   * the runner reads the rest of the sheet, and still lets one tap dismiss it.
   */
  useEffect(() => {
    if (selectedIndex === null) return;
    const dismiss = (event: PointerEvent) => {
      // Containment is the whole test: a press on the plot is a new selection,
      // and anything else is a dismissal. Deliberately not gated on an
      // in-progress drag — a pointerup the browser never delivered would
      // otherwise leave the chart unable to be dismissed at all.
      const surface = surfaceRef.current;
      if (surface && event.target instanceof Node && surface.contains(event.target)) return;
      setSelectedIndex(null);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [selectedIndex]);

  if (measured.length < 2 || lastTime <= 0) return null;

  const domain = displayDomain(measured, robustDomain);
  const span = domainSpan(domain);

  const overlayMeasured = (overlay?.samples ?? [])
    .flatMap((sample) => (sample.value === null ? [] : [sample.value]));
  const overlayDomain = overlayMeasured.length > 1 ? displayDomain(overlayMeasured) : null;
  const paddingRight = overlayDomain ? PADDING_RIGHT_WITH_OVERLAY : PADDING_RIGHT;
  const plotWidth = WIDTH - PADDING_LEFT - paddingRight;

  const plotX = (timeSeconds: number) => PADDING_LEFT + ratioAtTime(timeSeconds, lastTime) * plotWidth;
  const plotY = (value: number) => {
    // Clamped for drawing only: an outlier sits at the edge of the visible
    // window instead of dictating it. `samples` itself is never touched.
    const clamped = Math.min(Math.max(value, domain.low), domain.high);
    const ratio = (clamped - domain.low) / span;
    const normalized = invert ? 1 - ratio : ratio;
    return PADDING_TOP + (1 - normalized) * PLOT_HEIGHT;
  };
  const baselineY = PADDING_TOP + PLOT_HEIGHT;

  const runs = contiguousRuns(samples).map((run) =>
    run.map((point) => ({ ...point, x: plotX(point.timeSeconds), y: plotY(point.value) })));

  /** The overlay's own scale, which the axis on the right labels. */
  const overlayY = (value: number) =>
    baselineY -
    ((value - overlayDomain!.low) / domainSpan(overlayDomain!)) * PLOT_HEIGHT * OVERLAY_HEIGHT_RATIO;
  const overlayRuns = overlayDomain
    ? contiguousRuns(overlay!.samples).map((run) =>
        run.map((point) => ({ x: plotX(point.timeSeconds), y: overlayY(point.value) })))
    : [];
  const overlayTicks = overlayDomain ? axisTicks(overlayDomain, 3) : [];

  const ticks = axisTicks(domain);
  const selected = selectedIndex === null ? null : samples[selectedIndex] ?? null;
  const selectedTime = selected?.timeSeconds ?? null;
  const cursorRatio = selectedTime === null ? 0 : ratioAtTime(selectedTime, lastTime);

  const companionAt = (companion: ActivityChartCompanion) => {
    if (selectedTime === null) return null;
    const index = nearestSampleIndex(companion.samples, selectedTime);
    const sample = index < 0 ? null : companion.samples[index];
    // Only the same time position counts. The nearest sample of a stream that
    // stopped recording ten minutes ago is not a reading for this moment.
    if (!sample || sample.value === null || Math.abs(sample.timeSeconds - selectedTime) > 1) return null;
    return { label: companion.label, value: companion.format(sample.value) };
  };
  const companionReadings = companions.flatMap((companion) => {
    const reading = companionAt(companion);
    return reading ? [reading] : [];
  });

  const selectedValueText = selected?.value != null ? formatValue(selected.value) : null;
  const readingText = selectedTime === null
    ? `Whole run, ${formatDurationSeconds(Math.round(lastTime))}`
    : [
        `${formatDurationSeconds(Math.round(selectedTime))} elapsed`,
        selectedValueText ? `${label} ${selectedValueText}` : `no ${label.toLowerCase()} recorded here`,
        ...companionReadings.map((reading) => `${reading.label} ${reading.value}`),
      ].join(", ");

  function beginScrub(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = true;
    event.currentTarget.setPointerCapture?.(event.pointerId);
    select(event.clientX);
  }

  function trackScrub(event: ReactPointerEvent<HTMLDivElement>) {
    if (!draggingRef.current) return;
    select(event.clientX);
  }

  function endScrub(event: ReactPointerEvent<HTMLDivElement>) {
    draggingRef.current = false;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  }

  /** Arrow keys walk the cursor; Escape gives the whole run back. */
  function moveCursor(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = Math.max(1, Math.round(samples.length * KEYBOARD_STEP_RATIO));
    const current = selectedIndex ?? Math.floor(samples.length / 2);
    if (event.key === "ArrowRight" || event.key === "ArrowUp") {
      setSelectedIndex(Math.min(samples.length - 1, current + step));
    } else if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
      setSelectedIndex(Math.max(0, current - step));
    } else if (event.key === "Home") {
      setSelectedIndex(0);
    } else if (event.key === "End") {
      setSelectedIndex(samples.length - 1);
    } else if (event.key === "Escape") {
      if (selectedIndex === null) return;
      setSelectedIndex(null);
    } else {
      return;
    }
    event.preventDefault();
  }

  const showMidpoint = lastTime >= MIDPOINT_LABEL_MINIMUM_SECONDS;
  const axisText = formatAxis ?? formatValue;
  /** Positions as shares of the figure, so nothing depends on how wide it is drawn. */
  const percentX = (x: number) => `${(x / WIDTH) * 100}%`;
  const percentY = (y: number) => `${(y / HEIGHT) * 100}%`;

  return (
    <div
      className="activity-chart"
      data-metric={metric}
      style={{
        "--plot-left": percentX(PADDING_LEFT),
        "--plot-right": percentX(paddingRight),
      } as CSSProperties}
    >
      <div className="activity-chart__plot">
        {/*
          The figure is stretched to whatever box it is given — a phone sheet
          and a desktop dialog are very different shapes, and a chart that kept
          one aspect ratio would be either a stripe or half a screen tall. Every
          stroke below carries `non-scaling-stroke` so that stretching never
          thickens a line, and everything that must not distort — labels, the
          crosshair, the selected point — is HTML on top rather than SVG inside.
        */}
        <svg
          className="activity-chart__figure"
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <linearGradient id={`${describedById}-fill`} x1="0" y1="0" x2="0" y2="1">
              <stop className="activity-chart__fill-stop activity-chart__fill-stop--top" offset="0%" />
              <stop className="activity-chart__fill-stop activity-chart__fill-stop--bottom" offset="100%" />
            </linearGradient>
          </defs>

          {ticks.map((tick) => (
            <line
              key={`grid-${tick}`}
              className="activity-chart__grid"
              x1={PADDING_LEFT}
              x2={WIDTH - paddingRight}
              y1={plotY(tick)}
              y2={plotY(tick)}
            />
          ))}

          {overlayRuns.map((run, index) =>
            run.length > 1 ? (
              <path
                key={`overlay-${index}`}
                className="activity-chart__overlay"
                d={`${pathFrom(run, "line")} L${run[run.length - 1].x},${baselineY} L${run[0].x},${baselineY} Z`}
              />
            ) : null,
          )}

          {references.map((reference) => (
            <line
              key={`reference-${reference.label}`}
              className="activity-chart__reference"
              x1={PADDING_LEFT}
              x2={WIDTH - paddingRight}
              y1={plotY(reference.value)}
              y2={plotY(reference.value)}
            />
          ))}

          {shape !== "line" &&
            runs.map((run, index) =>
              run.length > 1 ? (
                <path
                  key={`fill-${index}`}
                  className="activity-chart__area"
                  fill={`url(#${describedById}-fill)`}
                  d={`${pathFrom(run, shape)} L${run[run.length - 1].x},${baselineY} L${run[0].x},${baselineY} Z`}
                />
              ) : null,
            )}

          {runs.map((run, index) =>
            run.length > 1 ? (
              <path key={`line-${index}`} className="activity-chart__line" d={pathFrom(run, shape)} />
            ) : run.length === 1 ? (
              // A lone measured sample between two gaps is still a fact; a
              // one-point path would draw nothing at all.
              <line
                key={`dot-${index}`}
                className="activity-chart__line"
                x1={run[0].x}
                x2={run[0].x}
                y1={run[0].y}
                y2={run[0].y}
              />
            ) : null,
          )}
        </svg>

        <div className="activity-chart__ticks" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={`tick-${tick}`} style={{ top: percentY(plotY(tick)) } as CSSProperties}>
              {axisText(tick)}
            </span>
          ))}
          {unitLabel && ticks.length > 0 && (
            <span
              className="activity-chart__unit"
              style={{ top: percentY(plotY(invert ? domain.high : domain.low)) } as CSSProperties}
            >
              {unitLabel}
            </span>
          )}
        </div>

        {overlayDomain && overlay && (
          <div className="activity-chart__ticks activity-chart__ticks--overlay" aria-hidden="true">
            {overlayTicks.map((tick) => (
              <span key={`overlay-tick-${tick}`} style={{ top: percentY(overlayY(tick)) } as CSSProperties}>
                {overlay.formatAxis(tick)}
              </span>
            ))}
          </div>
        )}

        {selectedTime !== null && (
          <div
            className="activity-chart__crosshair"
            aria-hidden="true"
            style={{ left: percentX(plotX(selectedTime)) } as CSSProperties}
          />
        )}
        {selected?.value != null && (
          <div
            className="activity-chart__marker"
            aria-hidden="true"
            style={{
              left: percentX(plotX(selected.timeSeconds)),
              top: percentY(plotY(selected.value)),
            } as CSSProperties}
          />
        )}

        <div
          ref={surfaceRef}
          className="activity-chart__scrub"
          role="slider"
          tabIndex={0}
          aria-label={`${label} over elapsed time`}
          aria-valuemin={0}
          aria-valuemax={Math.round(lastTime)}
          aria-valuenow={Math.round(selectedTime ?? 0)}
          aria-valuetext={readingText}
          aria-describedby={describedById}
          onPointerDown={beginScrub}
          onPointerMove={trackScrub}
          onPointerUp={endScrub}
          onPointerCancel={endScrub}
          onKeyDown={moveCursor}
        />

        {selectedTime !== null && (
          <div
            className="activity-chart__callout"
            data-flip={cursorRatio > 0.55 ? "left" : "right"}
            style={{ "--cursor": percentX(plotX(selectedTime)) } as CSSProperties}
          >
            <p className="activity-chart__callout-time machine-label">
              {formatDurationSeconds(Math.round(selectedTime))}
            </p>
            <p className="activity-chart__callout-value data-value">
              {selectedValueText ?? "No data"}
            </p>
            {companionReadings.length > 0 && (
              <ul className="activity-chart__callout-companions machine-label">
                {companionReadings.map((reading) => (
                  <li key={reading.label} data-companion={reading.label}>
                    {reading.value}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="activity-chart__axis machine-label" aria-hidden="true">
        <span>0:00</span>
        {showMidpoint && <span>{formatDurationSeconds(Math.round(lastTime / 2))}</span>}
        <span>{formatDurationSeconds(Math.round(lastTime))}</span>
      </div>

      <div className="activity-chart__foot" aria-hidden="true">
        {overlay && overlayDomain && (
          <p className="activity-chart__legend machine-label">
            <span data-series="metric">{label}</span>
            <span data-series="overlay">{overlay.label}</span>
          </p>
        )}
        {/*
          Said once, quietly, because a chart that can be interrogated has to
          say so: nothing else on the page tells a runner their finger does
          anything here.
        */}
        <p className="activity-chart__hint">
          {selectedTime === null ? "Drag to explore" : "Tap away to clear"}
        </p>
      </div>

      <p id={describedById} className="visually-hidden">
        {`${label} over elapsed time. Drag or use the arrow keys to inspect one time position. ${readingText}.`}
      </p>
    </div>
  );
}
