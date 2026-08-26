import { useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { formatDateLabel } from "../../domain/dates.js";
import {
  currentCrossTrainingDays,
  planCrossTrainingDayChange,
} from "../../domain/crossTrainingDays.js";
import { WEEKDAY_NAMES, WEEKDAY_ORDER, type Weekday } from "../../domain/runDays.js";
import type { TrainingPlan } from "../../domain/types.js";

interface CrossTrainingDaysSheetProps {
  plan: TrainingPlan;
  /** The saved preference, or null/empty while the runner has not said. */
  crossTrainingDays: Weekday[] | null;
  today: string;
  isOpen: boolean;
  onClose: () => void;
  onApply: (crossTrainingDays: Weekday[]) => void;
}

/**
 * Which days of the week carry Cross Training, applied to the whole plan at
 * once — the additive sibling of Run Days. Choosing a weekday fills in every
 * rest day that lands on it; a day that already schedules a run is never
 * touched, and neither is one that has already happened.
 *
 * Unlike Run Days, an empty choice is a valid, ordinary state: most plans
 * have no Cross Training in them until the runner asks for some.
 */
export function CrossTrainingDaysSheet({
  plan,
  crossTrainingDays,
  today,
  isOpen,
  onClose,
  onApply,
}: CrossTrainingDaysSheetProps) {
  const [chosen, setChosen] = useState<Weekday[]>(crossTrainingDays ?? []);
  const shape = currentCrossTrainingDays(plan);

  const change = planCrossTrainingDayChange(plan, chosen, { today });

  function toggle(day: Weekday) {
    setChosen((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  return (
    <Sheet title="Cross Training Days" isOpen={isOpen} onClose={onClose}>
      <div className="run-days">
        <p className="run-days__lede">
          The days you want Cross Training on. STACK fills in rest days that
          land on these weekdays; a day that already schedules a run is never
          touched.
        </p>

        {shape.length > 0 && (
          <p className="run-days__shape">
            Your plan currently has Cross Training on{" "}
            {shape.map((day) => WEEKDAY_NAMES[day].slice(0, 3)).join(", ")}.
          </p>
        )}

        <fieldset className="run-days__picker">
          <legend className="visually-hidden">Days for Cross Training</legend>
          {WEEKDAY_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              className="run-days__day"
              aria-pressed={chosen.includes(day)}
              onClick={() => toggle(day)}
            >
              <span aria-hidden="true">{WEEKDAY_NAMES[day].slice(0, 3)}</span>
              <span className="visually-hidden">{WEEKDAY_NAMES[day]}</span>
            </button>
          ))}
        </fieldset>

        {chosen.length === 0 ? (
          <p className="run-days__summary">
            Pick a day to add Cross Training to the plan, or leave this alone
            if you do not want any.
          </p>
        ) : change.fills.length === 0 ? (
          <p className="run-days__summary">
            No rest days land on those weekdays yet. Nothing to add.
          </p>
        ) : (
          <>
            <p className="run-days__summary">
              {change.fills.length}{" "}
              {change.fills.length === 1 ? "rest day becomes" : "rest days become"}{" "}
              Cross Training. A day that already schedules a run is never
              touched.
            </p>
            <ol className="run-days__moves">
              {change.fills.slice(0, 4).map((workout) => (
                <li key={workout.id}>
                  {formatDateLabel(workout.date, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </li>
              ))}
              {change.fills.length > 4 && (
                <li className="run-days__more">
                  and {change.fills.length - 4} more
                </li>
              )}
            </ol>
          </>
        )}

        <div className="run-days__actions">
          <Button
            disabled={change.fills.length === 0}
            onClick={() => onApply(chosen)}
          >
            {change.fills.length > 0
              ? `Add ${change.fills.length} Cross Training ${
                  change.fills.length === 1 ? "Day" : "Days"
                }`
              : "Apply to Plan"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
