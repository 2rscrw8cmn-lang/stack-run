import { addDaysToLocalDate, compareLocalDates, daysBetweenLocalDates } from "../domain/dates.js";

/** One inclusive `oldest`…`newest` request the activities endpoint accepts. */
export interface HistoricalWindow {
  oldest: string;
  newest: string;
}

/**
 * How far back a historical sync reaches by default.
 *
 * A year is the smallest window that can say anything about a runner's season:
 * it covers a full race build plus the base period behind it, and it makes
 * "this month against the same month last year" answerable at all. It is a
 * default rather than a limit — `syncHistoricalActivities` takes the lookback
 * as an argument, and nothing in the stored model changes when it grows.
 */
export const DEFAULT_HISTORICAL_LOOKBACK_DAYS = 365;

/**
 * The largest span STACK will put in one request.
 *
 * `api/intervals.ts` refuses a range wider than 120 days, and the direct
 * personal-key path talks to the same upstream. Ninety keeps a clear margin
 * under that ceiling and keeps a single failed window small enough to be worth
 * retrying. **This is the pagination**: the Intervals activities endpoint pages
 * by date range rather than by cursor, so a historical read is a sequence of
 * bounded windows, and no caller may assume one response holds the whole
 * history.
 */
export const HISTORICAL_WINDOW_DAYS = 90;

/**
 * A ceiling on the lookback so a bad argument cannot spin out thousands of
 * requests. Ten years is far past anything the product needs and far short of
 * anything that would hang a phone.
 */
export const MAX_HISTORICAL_LOOKBACK_DAYS = 3650;

/**
 * The windows a historical sync should read, **newest first**.
 *
 * Newest first is deliberate: the recent range is the part every later phase
 * needs most, so a sync that is rate-limited or interrupted halfway leaves
 * STACK with the useful end of the history rather than the far end of it.
 *
 * The windows tile the requested range exactly — contiguous, non-overlapping,
 * inclusive at both ends — and the last one is clipped to the oldest date
 * asked for rather than reaching past it.
 */
export function historicalWindows(
  lookbackDays: number,
  today: string,
  windowDays: number = HISTORICAL_WINDOW_DAYS,
): HistoricalWindow[] {
  const lookback = Math.min(
    MAX_HISTORICAL_LOOKBACK_DAYS,
    Math.max(0, Math.floor(Number.isFinite(lookbackDays) ? lookbackDays : 0)),
  );
  const span = Math.max(1, Math.floor(Number.isFinite(windowDays) ? windowDays : HISTORICAL_WINDOW_DAYS));
  const oldestRequested = addDaysToLocalDate(today, -lookback);

  const windows: HistoricalWindow[] = [];
  let newest = today;
  while (compareLocalDates(newest, oldestRequested) >= 0) {
    const reach = addDaysToLocalDate(newest, -span);
    const oldest = compareLocalDates(reach, oldestRequested) > 0 ? reach : oldestRequested;
    windows.push({ oldest, newest });
    newest = addDaysToLocalDate(oldest, -1);
  }
  return windows;
}

/** Inclusive day count of a window, which is what "at most 120 days" measures. */
export function windowSpanDays(window: HistoricalWindow): number {
  return daysBetweenLocalDates(window.oldest, window.newest) + 1;
}
