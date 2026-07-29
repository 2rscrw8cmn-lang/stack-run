import { Frown, Meh, Save, Smile, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { formatDurationSeconds } from "../../domain/duration";
import type { Effort, RunLog, Workout } from "../../domain/types";
import { validateRunEntry, type RunEntryErrors, type RunEntryValues, type ValidRunEntry } from "./runValidation";

const EFFORTS: Array<{ value: Effort; label: string; Icon: LucideIcon }> = [
  { value: "rough", label: "Rough", Icon: Frown },
  { value: "solid", label: "Solid", Icon: Meh },
  { value: "great", label: "Great", Icon: Smile },
];

interface CompleteRunSheetProps {
  isOpen: boolean;
  workout: Workout;
  runLog?: RunLog;
  onClose: () => void;
  onSave: (workout: Workout, values: ValidRunEntry) => void;
}

function initialValues(runLog?: RunLog): RunEntryValues {
  return runLog
    ? { distance: String(runLog.distanceMiles), duration: formatDurationSeconds(runLog.durationSeconds), effort: runLog.effort, notes: runLog.notes }
    : { distance: "", duration: "", effort: null, notes: "" };
}

export function CompleteRunSheet({ isOpen, workout, runLog, onClose, onSave }: CompleteRunSheetProps) {
  const [values, setValues] = useState<RunEntryValues>(() => initialValues(runLog));
  const [errors, setErrors] = useState<RunEntryErrors>({});
  const baseline = initialValues(runLog);
  const dirty = JSON.stringify(values) !== JSON.stringify(baseline);

  function guardClose() {
    return !dirty || window.confirm("Discard your unsaved run entry?");
  }

  return (
    <Sheet title={runLog ? "Edit Run" : "Complete Run"} isOpen={isOpen} onClose={onClose} guardClose={guardClose}>
      <form className="complete-run-form" noValidate onSubmit={(event) => {
        event.preventDefault();
        const result = validateRunEntry(values);
        if (!result.valid) { setErrors(result.errors); return; }
        onSave(workout, result.value);
      }}>
        <FormField label="Distance (miles)" required error={errors.distance}>
          <input className="run-input" inputMode="decimal" autoComplete="off" value={values.distance} onChange={(e) => setValues({ ...values, distance: e.target.value })} />
        </FormField>
        <FormField label="Duration" required hint="MM:SS or H:MM:SS" error={errors.duration}>
          <input className="run-input" inputMode="numeric" autoComplete="off" placeholder="31:42" value={values.duration} onChange={(e) => setValues({ ...values, duration: e.target.value })} />
        </FormField>
        <fieldset className="effort-picker" aria-describedby={errors.effort ? "effort-error" : undefined}>
          <legend>Effort <span aria-hidden="true">*</span></legend>
          <div className="effort-picker__options">
            {EFFORTS.map(({ value, label, Icon }) => <button key={value} type="button" className="effort-picker__option" aria-pressed={values.effort === value} onClick={() => setValues({ ...values, effort: value })}><Icon size={28} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></button>)}
          </div>
          {errors.effort && <p id="effort-error" className="form-field__error" role="alert">{errors.effort}</p>}
        </fieldset>
        <div className="notes-field">
          <label htmlFor="run-notes">Notes <span>(optional)</span></label>
          <textarea id="run-notes" className="run-input" maxLength={120} rows={3} value={values.notes} onChange={(e) => setValues({ ...values, notes: e.target.value })} />
          <span className="notes-field__counter">{values.notes.length}/120</span>
        </div>
        <Button type="submit" icon={<Save size={20} strokeWidth={1.8} />}>Save Run</Button>
      </form>
    </Sheet>
  );
}
