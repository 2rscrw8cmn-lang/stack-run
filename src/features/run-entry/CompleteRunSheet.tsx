import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { ActivityTypePicker } from "../../components/shared/ActivityTypePicker";
import { EffortPicker } from "../../components/shared/EffortPicker";
import { todayLocalDate } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import type {
  RunActivityType,
  RunLog,
  Workout,
} from "../../domain/types";
import { maskDurationInput } from "./durationMask";
import {
  validateRunEntry,
  type RunEntryErrors,
  type RunEntryValues,
  type ValidRunEntry,
} from "./runValidation";

const NOTES_MAX_LENGTH = 120;

interface CompleteRunSheetProps {
  isOpen: boolean;
  /** The scheduled workout being completed, or null for an extra run. */
  workout: Workout | null;
  runLog?: RunLog;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
  onClose: () => void;
  onSave: (workout: Workout | null, values: ValidRunEntry) => void;
  /** Provided when there is a saved run to remove. */
  onDelete?: () => void;
}

/**
 * The activity type a new entry starts from: what the plan asked for when
 * there is a workout, and Easy for an extra run.
 */
function defaultActivityType(workout: Workout | null): RunActivityType {
  return workout && workout.type !== "rest" ? workout.type : "easy";
}

function initialValues(
  workout: Workout | null,
  today: string,
  runLog?: RunLog,
): RunEntryValues {
  if (!runLog) {
    return {
      // A scheduled run is dated by its workout; an extra run happened today.
      date: workout ? workout.date : today,
      activityType: defaultActivityType(workout),
      distance: "",
      duration: "",
      effort: null,
      notes: "",
    };
  }
  return {
    date: runLog.completedDate,
    activityType: runLog.activityType,
    distance: formatMiles(runLog.distanceMiles),
    duration: formatDurationSeconds(runLog.durationSeconds),
    effort: runLog.effort,
    notes: runLog.notes,
  };
}

export function CompleteRunSheet({
  isOpen,
  workout,
  runLog,
  today = todayLocalDate(),
  onClose,
  onSave,
  onDelete,
}: CompleteRunSheetProps) {
  const [values, setValues] = useState<RunEntryValues>(() =>
    initialValues(workout, today, runLog),
  );
  const [errors, setErrors] = useState<RunEntryErrors>({});
  const fieldId = useId();
  const notesId = `${fieldId}-notes`;

  const isDirty =
    JSON.stringify(values) !==
    JSON.stringify(initialValues(workout, today, runLog));

  function guardClose() {
    return !isDirty || window.confirm("Discard your unsaved run entry?");
  }

  /** Editing a field also clears its error, so stale messages don't linger. */
  function updateValue<Key extends keyof RunEntryValues>(
    key: Key,
    value: RunEntryValues[Key],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) =>
      current[key] ? { ...current, [key]: undefined } : current,
    );
  }

  function handleSubmit() {
    const result = validateRunEntry(values, today);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSave(workout, result.value);
  }

  const title = runLog ? "Edit Run" : workout ? "Complete Run" : "Log Run";

  return (
    <Sheet
      title={title}
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
        {!workout && (
          <p className="complete-run-form__lede">
            An extra run counts your miles and earns a block. It does not
            complete anything on the plan.
          </p>
        )}

        <FormField label="Date" required error={errors.date}>
          <input
            className="run-input"
            type="date"
            max={today}
            value={values.date}
            onChange={(event) => updateValue("date", event.target.value)}
          />
        </FormField>

        <ActivityTypePicker
          value={values.activityType}
          required
          onChange={(activityType) => updateValue("activityType", activityType)}
        />

        <FormField label="Distance (miles)" required error={errors.distance}>
          <input
            className="run-input"
            inputMode="decimal"
            autoComplete="off"
            placeholder="3.2"
            value={values.distance}
            onChange={(event) => updateValue("distance", event.target.value)}
          />
        </FormField>

        <FormField
          label="Duration"
          required
          hint="Type digits only — 3142 becomes 31:42"
          error={errors.duration}
        >
          <input
            className="run-input"
            inputMode="numeric"
            autoComplete="off"
            placeholder="31:42"
            value={values.duration}
            onChange={(event) =>
              updateValue("duration", maskDurationInput(event.target.value))
            }
          />
        </FormField>

        <EffortPicker
          value={values.effort}
          required
          error={errors.effort}
          onChange={(effort) => updateValue("effort", effort)}
        />

        <div className="notes-field">
          <label className="notes-field__label" htmlFor={notesId}>
            Notes <span>(optional)</span>
          </label>
          <textarea
            id={notesId}
            className="run-input"
            maxLength={NOTES_MAX_LENGTH}
            rows={3}
            placeholder="How did it feel?"
            value={values.notes}
            onChange={(event) => updateValue("notes", event.target.value)}
          />
          <span className="notes-field__counter">
            {values.notes.length}/{NOTES_MAX_LENGTH}
          </span>
        </div>

        <div className="complete-run-form__actions">
          <Button type="submit">Save Run</Button>
          {onDelete && (
            <Button
              variant="danger"
              onClick={() => {
                if (
                  window.confirm(
                    "Delete this run? Its block comes out of the tower too.",
                  )
                ) {
                  onDelete();
                }
              }}
            >
              Delete Run
            </Button>
          )}
        </div>
      </form>
    </Sheet>
  );
}
