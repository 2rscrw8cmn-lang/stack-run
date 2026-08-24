/**
 * How many buckets a phone chart may label, and where those labels go.
 *
 * The rule from `RUNS_R2_CHART_SYSTEM.md` is that a crowded axis loses labels
 * before it loses type size. R2's first pass also forced the *selected* bucket
 * into the axis, which is what produced the `Jun 15Jun 29` overlaps in owner
 * review: a selected index two buckets from a fixed edge label has nowhere to
 * go. The selected period is stated in the readout above the chart, so the axis
 * no longer has to carry it. What is left is evenly spaced chronology with a
 * guaranteed gap, which cannot collide by construction.
 */

/** A phone chart reads best at about four dated ticks. */
export const PHONE_X_LABEL_TARGET = 4;

/**
 * The share of the plot that must separate two visible labels.
 *
 * A short date (`Jun 15`) is roughly 48px at the 13–14px sizes the chart
 * system asks for; a fifth of a ~330px phone plot is 66px.
 */
export const MINIMUM_LABEL_GAP_RATIO = 0.2;

/**
 * Evenly spaced label positions, first and last always included.
 *
 * Returns indices only — the caller decides what a label says and how the
 * selected bucket is emphasised, which stays independent of density.
 */
export function sparseTickIndices(
  count: number,
  maximumTicks = PHONE_X_LABEL_TARGET,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [0];
  if (count <= maximumTicks) {
    return Array.from({ length: count }, (_, index) => index);
  }
  const minimumGap = Math.max(1, Math.ceil(count * MINIMUM_LABEL_GAP_RATIO));
  const ticks = Math.max(
    2,
    Math.min(maximumTicks, 1 + Math.floor((count - 1) / minimumGap)),
  );
  return Array.from({ length: ticks }, (_, index) =>
    Math.round((index * (count - 1)) / (ticks - 1)),
  );
}
