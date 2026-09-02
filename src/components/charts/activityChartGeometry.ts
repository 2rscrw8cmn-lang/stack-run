/**
 * The maths behind one run's activity chart, kept out of the component that
 * draws it.
 *
 * Everything here is pure and takes plain numbers. That is deliberate: the
 * interesting decisions in a scrubbable chart — what window the y-axis covers,
 * which sample a finger is over, where a gap in the stream is — are decisions
 * about data, and they should be checkable without rendering an SVG or faking a
 * pointer. The component is then only responsible for turning the answers into
 * marks.
 *
 * Nothing in this file computes a *summary* of the run. Values are clamped for
 * drawing and never rewritten; the numbers stated beside a chart come from the
 * source's own aggregates, as they do everywhere else in STACK.
 */

/** One time position in a stream, with `null` wherever the metric had no value. */
export interface ActivitySample {
  timeSeconds: number;
  /** Null where the stream carried no value at this time position. */
  value: number | null;
}

export interface ValueDomain {
  low: number;
  high: number;
}

/** Below this many samples a quartile domain is noise, so use the real extent. */
export const ROBUST_DOMAIN_MINIMUM_SAMPLES = 8;
/** Tukey's usual multiplier: beyond this much IQR past a quartile is an outlier. */
export const IQR_FENCE = 1.5;
const DOMAIN_PADDING = 0.08;

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
 * interquartile range — rather than a fixed high percentile. A percentile only
 * excludes a known fraction of the samples, so on a short series it
 * interpolates straight back into the very outlier it was meant to keep out;
 * the IQR asks the different and better question of how far from the bulk a
 * value has to be before it stops describing the run.
 *
 * Carried over unchanged from the Run Profile chart this replaced: a near-stop
 * at a traffic light is a real sample and stays in the series, but it may not
 * flatten the other twenty-nine minutes into a line.
 */
export function displayDomain(values: readonly number[], robust = false): ValueDomain {
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
 * A domain that can be divided by, even when the series is a single repeated
 * value. A flat heart rate is a real answer; a zero-height plot is not.
 */
export function domainSpan({ low, high }: ValueDomain): number {
  return high - low || Math.max(Math.abs(high) * 0.1, 1);
}

/**
 * A few round values inside the domain, for the y-axis.
 *
 * Round rather than evenly spaced: a runner reads `140`, `160`, `180` off a
 * heart-rate axis without doing arithmetic, and `142.7` is noise wearing three
 * significant figures. The step is the smallest of the 1/2/2.5/5 ladder that
 * still fits inside `maximumTicks` labels — chosen by counting the labels it
 * would actually produce rather than by dividing the range, because those two
 * differ by one at every boundary and the difference is what decides whether a
 * pace axis gets three labels or none at all.
 *
 * Returns nothing when the domain is degenerate: an axis of one repeated label
 * says less than no axis.
 */
export function axisTicks(domain: ValueDomain, maximumTicks = 4): number[] {
  const { low, high } = domain;
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return [];
  const magnitude = 10 ** Math.floor(Math.log10((high - low) / Math.max(1, maximumTicks)));
  const steps = [1, 2, 2.5, 5, 10, 20, 25, 50].map((factor) => factor * magnitude);

  const ticksFor = (step: number) => {
    const values: number[] = [];
    for (let value = Math.ceil(low / step) * step; value <= high + step * 1e-6; value += step) {
      // Floating-point steps accumulate error; a tick is a label, so round it
      // to the step's own precision rather than printing 159.99999999999997.
      values.push(Number(value.toFixed(10)));
    }
    return values;
  };

  for (const step of steps) {
    const values = ticksFor(step);
    if (values.length <= maximumTicks) return values.length > 0 ? values : [];
  }
  return [];
}

export interface ActivityRun {
  /** Index into the original sample list, so a run knows where it came from. */
  index: number;
  timeSeconds: number;
  value: number;
}

/**
 * The measured stretches of a series, split wherever the stream stopped.
 *
 * A time position with no value ends the current stretch rather than being
 * skipped over. Joining the samples either side of a gap would draw a straight
 * line across data that was never recorded, which is the one thing a run
 * profile must never do.
 */
export function contiguousRuns(samples: readonly ActivitySample[]): ActivityRun[][] {
  const runs: ActivityRun[][] = [];
  let current: ActivityRun[] = [];
  samples.forEach((sample, index) => {
    if (sample.value === null) {
      if (current.length > 0) runs.push(current);
      current = [];
      return;
    }
    current.push({ index, timeSeconds: sample.timeSeconds, value: sample.value });
  });
  if (current.length > 0) runs.push(current);
  return runs;
}

/**
 * The sample nearest a time position, by elapsed time rather than by index.
 *
 * Streams are not always evenly spaced — a paused watch leaves a minute
 * between two consecutive samples — so a finger halfway across the plot is
 * halfway through the *run*, not halfway through the array.
 *
 * Returns -1 for an empty series. Never returns a "closest enough" miss: every
 * position over the plot belongs to some sample.
 */
export function nearestSampleIndex(
  samples: readonly ActivitySample[],
  timeSeconds: number,
): number {
  if (samples.length === 0) return -1;
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  samples.forEach((sample, index) => {
    const distance = Math.abs(sample.timeSeconds - timeSeconds);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

/**
 * The elapsed time a ratio across the plot points at.
 *
 * Ratios outside 0–1 happen constantly on touch: a finger that starts on the
 * chart and slides past its edge keeps sending events, and the honest answer
 * is the end of the run rather than a time the run never reached.
 */
export function timeAtRatio(ratio: number, lastTimeSeconds: number): number {
  return Math.min(Math.max(ratio, 0), 1) * lastTimeSeconds;
}

/**
 * How far through the run one sample sits, as a 0–1 ratio.
 *
 * A run whose stream is a single time position has no span to speak of; it
 * plots at the start rather than dividing by zero.
 */
export function ratioAtTime(timeSeconds: number, lastTimeSeconds: number): number {
  return lastTimeSeconds > 0 ? Math.min(Math.max(timeSeconds / lastTimeSeconds, 0), 1) : 0;
}
