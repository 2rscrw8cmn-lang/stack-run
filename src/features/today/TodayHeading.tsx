import { Flag } from "lucide-react";
import { formatDateLabel } from "../../domain/dates";
import type { Race } from "../../domain/types";

interface TodayHeadingProps {
  today: string;
  race: Race | null;
  /** Signed: positive before race day, zero on it, negative once it has passed. */
  daysRemaining: number | null;
}

/**
 * What Today leads with: the date, and quietly, the race it is counting toward.
 *
 * The screen used to be titled "Today", which is the one word already printed on
 * the tab that got you here. The date is the same information said usefully — it
 * is the thing a runner actually wants confirmed when they open the app in the
 * morning.
 *
 * The race stays, as goal context rather than as a countdown clock. STACK Next
 * still cares what a runner is building toward, and a number that shrinks every
 * morning makes every day feel like a plan dashboard; it belongs here, in the
 * quietest type on the screen, and nowhere else on it.
 *
 * Once race day has passed the countdown is dropped rather than pinned at zero.
 * A finished race is still the goal the training was for, so the name remains,
 * but `Race day` printed every morning for the rest of the year is simply wrong.
 */
export function TodayHeading({ today, race, daysRemaining }: TodayHeadingProps) {
  const countdown = daysRemaining === null
    ? null
    : daysRemaining > 0
      ? `${daysRemaining} ${daysRemaining === 1 ? "day" : "days"}`
      : daysRemaining === 0
        ? "Race day"
        : null;

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

      {race && <p className="race-context machine-label">
        <Flag size={13} strokeWidth={2} aria-hidden="true" />
        <span className="race-context__name">{race.name}</span>
        {countdown && (
          <>
            <span className="race-context__separator" aria-hidden="true">
              ·
            </span>
            <span className="race-context__days data-value">{countdown}</span>
          </>
        )}
        <span className="visually-hidden">
          {`Race day is ${formatDateLabel(race.date, {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}.`}
        </span>
      </p>}
    </div>
  );
}
