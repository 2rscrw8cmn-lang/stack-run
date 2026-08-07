import { Flag } from "lucide-react";
import { formatDateLabel } from "../../domain/dates";
import type { Race } from "../../domain/types";

interface RaceContextProps {
  race: Race;
  daysRemaining: number;
}

/**
 * The race, reduced to one line. It used to be the largest card on Today,
 * which made the screen a countdown with a workout attached; the workout is
 * the thing you can act on, so the race becomes context above it.
 */
export function RaceContext({ race, daysRemaining }: RaceContextProps) {
  const days = Math.max(0, daysRemaining);

  return (
    <p className="race-context">
      <Flag size={14} strokeWidth={2} aria-hidden="true" />
      <span className="race-context__name">{race.name}</span>
      <span className="race-context__separator" aria-hidden="true">
        ·
      </span>
      <span className="race-context__days">
        {days === 0 ? "Race day" : `${days} ${days === 1 ? "day" : "days"}`}
      </span>
      <span className="visually-hidden">
        {`Race day is ${formatDateLabel(race.date, {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}.`}
      </span>
    </p>
  );
}
