import { useState } from "react";
import { Button } from "../../components/ui/Button.js";
import { FormField } from "../../components/ui/FormField.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { ActivityTypePicker } from "../../components/shared/ActivityTypePicker.js";
import { formatDateLabel } from "../../domain/dates.js";
import type { PlannedRunValues } from "../../domain/planEdit.js";
import type { RunActivityType, Workout } from "../../domain/types.js";
import {
  DETAILS_MAX_LENGTH,
  validateWorkoutForm,
  type WorkoutFormErrors,
  type WorkoutFormValues,
} from "./workoutValidation.js";

interface EditWorkoutSheetProps {
  /** The day being planned. A rest day here means a run is being added to it. */
  workout: Workout;
  isOpen: boolean;
  onClose: () => void;
  onSave: (values: PlannedRunValues) => void;
}

function initialValues(workout: Workout): WorkoutFormValues {
  const isRest = workout.type === "rest";
  return {
    type: isRest ? "easy" : (workout.type as RunActivityType),
    title: isRest ? "" : workout.title,
    target: isRest ? "" : (workout.targetDistanceMiles ?? ""),
    details: isRest ? "" : workout.details,
  };
}

/**
 * What the plan asks for on one day. The same form adds a run to a rest day
 * and edits one that is already scheduled — the fields are identical, and only
 * the wording changes, so there is one form rather than two that drift apart.
 *
 * This edits the *plan*. What actually happened on the day is a run log, and
 * it is edited from the run form.
 */
export function EditWorkoutSheet({
  workout,
  isOpen,
  onClose,
  onSave,
}: EditWorkoutSheetProps) {
  const isRest = workout.type === "rest";
  const [values, setValues] = useState<WorkoutFormValues>(() =>
    initialValues(workout),
  );
  const [errors, setErrors] = useState<WorkoutFormErrors>({});

  const isDirty =
    JSON.stringify(values) !== JSON.stringify(initialValues(workout));

  function guardClose() {
    return !isDirty || window.confirm("Discard your unsaved changes?");
  }

  function updateValue<Key extends keyof WorkoutFormValues>(
    key: Key,
    value: WorkoutFormValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  }

  function handleSubmit() {
    const result = validateWorkoutForm(values);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSave(result.value);
  }

  return (
    <Sheet
      title={isRest ? "Add Planned Run" : "Edit Workout"}
      isOpen={isOpen}
      onClose={onClose}
      guardClose={guardClose}
    >
      <form
        className="complete-run-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          handleSubmit();
        }}
      >
        <p className="complete-run-form__lede">
          {formatDateLabel(workout.date, {
            weekday: "long",
            month: "long",
            day: "numeric",
          })}
          {isRest
            ? " is a rest day. Planning a run here does not log one."
            : " — this changes the plan, not a run you have logged."}
        </p>

        <ActivityTypePicker
          label="Activity"
          value={values.type}
          required
          onChange={(type: RunActivityType) => updateValue("type", type)}
        />

        <FormField label="Name" required error={errors.title}>
          <input
            className="run-input"
            autoComplete="off"
            placeholder="4 Miles"
            value={values.title}
            onChange={(event) => updateValue("title", event.target.value)}
          />
        </FormField>

        <FormField
          label="Target (miles)"
          hint="Optional. A number like 5, or a range like 4-5."
          error={errors.target}
        >
          <input
            className="run-input"
            inputMode="decimal"
            autoComplete="off"
            placeholder="4-5"
            value={values.target}
            onChange={(event) => updateValue("target", event.target.value)}
          />
        </FormField>

        <FormField label="Instructions" error={errors.details}>
          <textarea
            className="run-input"
            rows={3}
            maxLength={DETAILS_MAX_LENGTH}
            placeholder="Easy conversational effort."
            value={values.details}
            onChange={(event) => updateValue("details", event.target.value)}
          />
        </FormField>

        <div className="complete-run-form__actions">
          <Button type="submit">
            {isRest ? "Add Planned Run" : "Save Workout"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
