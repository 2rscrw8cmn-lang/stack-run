import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import {
  isInsidePlanRange,
  moveConflict,
  workoutOnDate,
} from "../../domain/planEdit";
import type { TrainingPlan, Workout } from "../../domain/types";

interface MoveWorkoutSheetProps {
  plan: TrainingPlan;
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onMove: (toDate: string) => void;
}

/**
 * Moving a workout to any date the plan covers.
 *
 * Every date holds exactly one workout, so a move trades two days. The sheet
 * says what is on the destination before anything happens: landing on a rest
 * day is quiet, and landing on another run needs the user to accept that the
 * two runs swap days — which is the confirmation the spec asks for, made
 * concrete rather than a yes/no about an unnamed collision.
 */
export function MoveWorkoutSheet({
  plan,
  workout,
  isOpen,
  onClose,
  onMove,
}: MoveWorkoutSheetProps) {
  const [toDate, setToDate] = useState(workout.date);
  const [error, setError] = useState<string | undefined>(undefined);

  // A date field can be empty or half-typed, and the date helpers are strict
  // about what a local date is. Nothing is asked of them until it is one.
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(toDate);
  const isSameDay = toDate === workout.date;
  const inRange = isDate && isInsidePlanRange(plan, toDate);
  const occupant = inRange ? (workoutOnDate(plan, toDate) ?? null) : null;
  const conflict = inRange ? moveConflict(plan, workout.id, toDate) : null;
  const blockedByRace = occupant !== null && occupant.type === "race";

  function handleSubmit() {
    if (isSameDay) {
      onClose();
      return;
    }
    if (!isDate) {
      setError("Pick the date to move it to.");
      return;
    }
    if (!inRange) {
      setError(
        `Pick a date between ${formatDateLabel(plan.startDate)} and ${formatDateLabel(plan.endDate)}.`,
      );
      return;
    }
    if (blockedByRace) {
      setError("Race day is fixed and cannot be moved.");
      return;
    }
    onMove(toDate);
  }

  return (
    <Sheet title="Move Workout" isOpen={isOpen} onClose={onClose}>
      <form
        className="complete-run-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="complete-run-form__lede">
          {workout.title} is on{" "}
          {formatDateLabel(workout.date, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          .
        </p>

        <FormField label="Move to" required error={error}>
          <input
            className="run-input"
            type="date"
            min={plan.startDate}
            max={plan.endDate}
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setError(undefined);
            }}
          />
        </FormField>

        {!isSameDay && isDate && inRange && (
          <p
            className="move-workout__destination"
            data-conflict={conflict && !blockedByRace ? "true" : undefined}
          >
            {blockedByRace ? (
              <span>Race day is fixed and cannot be moved.</span>
            ) : conflict ? (
              <>
                <TriangleAlert size={18} strokeWidth={2} aria-hidden="true" />
                <span>
                  {`${formatDateLabel(toDate)} already has ${conflict.title} (${WORKOUT_TYPE_LABEL[conflict.type]}). Moving here swaps the two days: ${conflict.title} moves to ${formatDateLabel(workout.date)}.`}
                </span>
              </>
            ) : (
              <span>
                {`${formatDateLabel(toDate)} is a rest day. It becomes ${formatDateLabel(workout.date)}'s rest day instead.`}
              </span>
            )}
          </p>
        )}

        <div className="complete-run-form__actions">
          <Button
            type="submit"
            variant={conflict && !blockedByRace ? "danger" : "primary"}
            disabled={blockedByRace}
          >
            {conflict && !blockedByRace ? "Swap These Days" : "Move Workout"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
