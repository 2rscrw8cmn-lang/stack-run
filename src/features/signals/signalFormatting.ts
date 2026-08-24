import { formatDateLabel } from "../../domain/dates";
import { formatRunsMiles } from "../../domain/distance";

/**
 * Signed display of a change a signal has already decided the meaning of.
 *
 * Formatting only. Nothing here decides whether a change is meaningful, and
 * nothing attaches a word to it — the sign is arithmetic, and the language came
 * from the domain with the threshold that justified it.
 */
export function signedMilesChange(differenceMiles: number): string {
  if (differenceMiles === 0) return "0 mi";
  return `${differenceMiles > 0 ? "+" : "−"}${formatRunsMiles(Math.abs(differenceMiles))} mi`;
}

export function signedPercent(changeRatio: number): string {
  const percent = Math.round(changeRatio * 100);
  if (percent === 0) return "0%";
  return `${percent > 0 ? "+" : "−"}${Math.abs(percent)}%`;
}

export function signedNumber(difference: number, unit = ""): string {
  if (difference === 0) return `0${unit}`;
  return `${difference > 0 ? "+" : "−"}${Math.abs(difference)}${unit}`;
}

export function signedPoints(differenceShare: number): string {
  const points = Math.round(differenceShare * 100);
  if (points === 0) return "0 pts";
  return `${points > 0 ? "+" : "−"}${Math.abs(points)} pts`;
}

/** `Jul 19 — Aug 15`: the exact inclusive dates a window covered. */
export function windowRangeLabel(window: {
  startDate: string;
  endDate: string;
}): string {
  const day: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  return `${formatDateLabel(window.startDate, day)} — ${formatDateLabel(window.endDate, day)}`;
}
