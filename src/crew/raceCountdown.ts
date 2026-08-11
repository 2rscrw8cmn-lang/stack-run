import { daysBetweenLocalDates, formatDateLabel } from "../domain/dates";

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

/** `Dec 5 · Half Marathon`, falling back to the distance when unnamed. */
export function crewRaceLine(crew: {
  raceName: string;
  raceDate: string;
  raceDistanceMiles: number;
}): string {
  const facts: string[] = [];
  try {
    facts.push(formatDateLabel(crew.raceDate, { month: "short", day: "numeric" }));
  } catch {
    // An unreadable stored date simply drops out of the line.
  }
  const name = crew.raceName.trim();
  if (name) {
    facts.push(name);
  } else if (crew.raceDistanceMiles > 0) {
    facts.push(`${Number(crew.raceDistanceMiles.toFixed(2))} mi`);
  }
  return facts.join(" · ");
}
