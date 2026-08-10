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
