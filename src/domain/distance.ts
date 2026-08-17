/**
 * STACK's stored distance is whatever a person typed — one or two decimals.
 * A synced distance is a unit conversion, so it arrives with fifteen of them.
 * `intervals.ts` rounds what it imports, but state written before it did is
 * already in browsers, and every screen prints the stored number directly.
 */
const MILE_DECIMALS = 2;

/**
 * Formats a distance in miles for display, without inventing precision.
 *
 * A run of exactly five miles stays "5" rather than becoming "5.00": the
 * decimals a person entered are shown, and the ones a conversion produced are
 * not.
 */
export function formatMiles(distanceMiles: number): string {
  return String(Number(distanceMiles.toFixed(MILE_DECIMALS)));
}

/**
 * The same distance, short enough to sit on a brick.
 *
 * A block face is between about 60 and 130 CSS pixels wide, so `10.25` costs
 * width the tower cannot spare and precision nobody reads at that size. One
 * decimal is the compact form D-045 asks for: `3.2`, `10.3`, and a flat `5`
 * for a run entered as five miles.
 */
export function formatCompactMiles(distanceMiles: number): string {
  return String(Number(distanceMiles.toFixed(1)));
}

/** Aggregate Build mileage always carries one decimal for cross-screen consistency. */
export function formatMilesBuilt(distanceMiles: number): string {
  return distanceMiles.toFixed(1);
}

/**
 * The one-decimal mileage Runs presents, for a single run and a range total alike.
 *
 * Summing a year of two-decimal imports produces readings like `63.25 mi` and,
 * with floating point in the way, worse. That is aggregation precision leaking
 * into the product: nobody reads a hundredth of a mile across four weeks of
 * running. Runs presents one decimal everywhere — `3.5`, `63.3`, `761.5` — so
 * the summary, the chart readout and the rows underneath it agree.
 *
 * Stored distance is untouched. This is presentation only.
 */
export function formatRunsMiles(distanceMiles: number): string {
  return distanceMiles.toFixed(1);
}
