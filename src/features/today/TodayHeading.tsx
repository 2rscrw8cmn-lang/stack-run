import { Flag } from "lucide-react";
import { formatDateLabel } from "../../domain/dates";
import type { Race } from "../../domain/types";

interface TodayHeadingProps {
  today: string;
  race: Race;
  daysRemaining: number;
}

/**
 * What Today leads with: the date, and the race it is counting toward.
 *
 * The screen used to be titled "Today", which is the one word already printed
 * on the tab that got you here. The date is the same information said
 * usefully — it is the thing a runner actually wants confirmed when they open
 * the app in the morning.
 */
export function TodayHeading({ today, race, daysRemaining }: TodayHeadingProps) {
  const days = Math.max(0, daysRemaining);

  return (
    <div className="today-heading">
      <h1 className="today-heading__date machine-label">
        <span className="today-heading__day">
          {formatDateLabel(today, { month: "short", day: "numeric" })}
        </span>
        <span aria-hidden="true"> · </span>
        <span className="today-heading__weekday">
          {formatDateLabel(today, { weekday: "long" })}
        </span>
      </h1>

      <p className="race-context machine-label">
        <Flag size={14} strokeWidth={2} aria-hidden="true" />
        <span className="race-context__name">{race.name}</span>
        <span className="race-context__separator" aria-hidden="true">
          ·
        </span>
        <span className="race-context__days data-value">
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
    </div>
  );
}
