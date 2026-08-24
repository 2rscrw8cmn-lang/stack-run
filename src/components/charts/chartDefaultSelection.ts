/**
 * One product rule for what a chart is showing before anybody touches it.
 *
 * Owner review found the surfaces disagreeing: Recent Training opened on the
 * latest week with running in it, while Signal detail opened on the current
 * calendar week, which on a Monday morning is a truthful but useless `0 mi`.
 * Both are now the same rule:
 *
 * > Default to the latest **completed, non-empty** period.
 *
 * The in-progress period stays drawn and stays selectable — it is real, and a
 * runner mid-week wants to see it — it simply is not the answer the screen
 * opens with when finished history exists.
 */
export interface SelectablePeriod {
  /** Missing stays missing: a period with no recorded value is not a zero. */
  value: number | null;
  /** True while the period is still running, so its value is not final. */
  isPartial?: boolean;
}

function hasResult(period: SelectablePeriod): boolean {
  return period.value !== null && period.value !== 0;
}

/**
 * The index a chart should open on, or -1 when there is nothing to select.
 *
 * Falls back to the latest period with a value when every one of them is still
 * in progress, and to the last period when the whole series is empty — an empty
 * series still has to select something for the readout to describe.
 */
export function defaultSelectedIndex(periods: readonly SelectablePeriod[]): number {
  if (periods.length === 0) return -1;
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    if (!periods[index].isPartial && hasResult(periods[index])) return index;
  }
  for (let index = periods.length - 1; index >= 0; index -= 1) {
    if (hasResult(periods[index])) return index;
  }
  return periods.length - 1;
}

/** The same rule stated in keys, for the components that select by key. */
export function defaultSelectedKey<T extends SelectablePeriod & { key: string }>(
  periods: readonly T[],
): string | null {
  const index = defaultSelectedIndex(periods);
  return index < 0 ? null : periods[index].key;
}
