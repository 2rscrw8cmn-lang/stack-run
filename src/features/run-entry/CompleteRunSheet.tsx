import { Frown, Meh, Smile, type LucideIcon } from "lucide-react";
import { useId, useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { formatDurationSeconds } from "../../domain/duration";
import type { Effort, RunLog, Workout } from "../../domain/types";
import { maskDurationInput } from "./durationMask";
import {
  validateRunEntry,
  type RunEntryErrors,
  type RunEntryValues,
  type ValidRunEntry,
} from "./runValidation";

const EFFORTS: Array<{ value: Effort; label: string; Icon: LucideIcon }> = [
  { value: "rough", label: "Rough", Icon: Frown },
  { value: "solid", label: "Solid", Icon: Meh },
  { value: "great", label: "Great", Icon: Smile },
];

const NOTES_MAX_LENGTH = 120;

interface CompleteRunSheetProps {
  isOpen: boolean;
  workout: Workout;
  runLog?: RunLog;
  onClose: () => void;
  onSave: (workout: Workout, values: ValidRunEntry) => void;
}

function initialValues(runLog?: RunLog): RunEntryValues {
  if (!runLog) {
    return { distance: "", duration: "", effort: null, notes: "" };
  }
  return {
    distance: String(runLog.distanceMiles),
    duration: formatDurationSeconds(runLog.durationSeconds),
    effort: runLog.effort,
    notes: runLog.notes,
  };
}

export function CompleteRunSheet({
  isOpen,
  workout,
  runLog,
  onClose,
  onSave,
}: CompleteRunSheetProps) {
  const [values, setValues] = useState<RunEntryValues>(() => initialValues(runLog));
  const [errors, setErrors] = useState<RunEntryErrors>({});
  const fieldId = useId();
  const effortErrorId = `${fieldId}-effort-error`;
  const notesId = `${fieldId}-notes`;

  const isDirty =
    JSON.stringify(values) !== JSON.stringify(initialValues(runLog));

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
    const result = validateRunEntry(values);
    if (!result.valid) {
      setErrors(result.errors);
      return;
    }
    onSave(workout, result.value);
  }

  return (
    <Sheet
      title={runLog ? "Edit Run" : "Complete Run"}
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

        <fieldset
          className="effort-picker"
          aria-describedby={errors.effort ? effortErrorId : undefined}
        >
          <legend className="effort-picker__legend">
            Effort <span aria-hidden="true">*</span>
          </legend>
          <div className="effort-picker__options">
            {EFFORTS.map(({ value, label, Icon }) => (
              <button
                key={value}
                type="button"
                className="effort-picker__option"
                aria-pressed={values.effort === value}
                onClick={() => updateValue("effort", value)}
              >
                <Icon size={28} strokeWidth={1.8} aria-hidden="true" />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {errors.effort && (
            <p id={effortErrorId} className="form-field__error" role="alert">
              {errors.effort}
            </p>
          )}
        </fieldset>

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
        </div>
      </form>
    </Sheet>
  );
}
