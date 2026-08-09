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
