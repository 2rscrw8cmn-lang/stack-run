import { daysBetweenLocalDates, formatDateLabel } from "../domain/dates.js";

export type RaceCountdown =
  | { kind: "future"; days: number; label: string }
  | { kind: "race-day"; days: 0; label: string }
  | { kind: "complete"; days: number; label: string };

/**
 * The Crew header's one piece of urgency, derived locally from the crew race
 * date already stored in UI-18. Nothing is written, and no clock but the
 * viewer's own local date is consulted.
 */
export function raceCountdown(
  raceDate: string,
  today: string,
): RaceCountdown | null {
  let days: number;
  try {
    days = daysBetweenLocalDates(today, raceDate);
  } catch {
    return null;
  }
  if (days === 0) return { kind: "race-day", days: 0, label: "Race day" };
  if (days < 0) return { kind: "complete", days, label: "Race complete" };
  return {
    kind: "future",
    days,
    label: `${days} ${days === 1 ? "day" : "days"} to race`,
  };
}

/** `Half Marathon · Dec 5`, falling back to the distance when unnamed. Nullable-safe: a Run Club has no race to describe. */
export function crewRaceLine(crew: {
  raceName: string | null;
  raceDate: string | null;
  raceDistanceMiles: number | null;
}): string {
  const facts: string[] = [];
  const name = crew.raceName?.trim();
  if (name) {
    facts.push(name);
  } else if (crew.raceDistanceMiles !== null && crew.raceDistanceMiles > 0) {
    facts.push(`${Number(crew.raceDistanceMiles.toFixed(2))} mi`);
  }
  if (crew.raceDate) {
    try {
      facts.push(formatDateLabel(crew.raceDate, { month: "short", day: "numeric" }));
    } catch {
      // An unreadable stored date simply drops out of the line.
    }
  }
  return facts.join(" · ");
}

/** `Building since Aug 1` — the Run Club header's compact, non-race context. */
export function crewClubLine(crew: { buildStartDate: string }): string {
  try {
    return `Building since ${formatDateLabel(crew.buildStartDate, { month: "short", day: "numeric" })}`;
  } catch {
    return "";
  }
}
