import { Frown, Meh, Smile, type LucideIcon } from "lucide-react";
import { useId } from "react";
import type { Effort } from "../../domain/types.js";

const EFFORTS: Array<{ value: Effort; label: string; Icon: LucideIcon }> = [
  { value: "rough", label: "Rough", Icon: Frown },
  { value: "solid", label: "Solid", Icon: Meh },
  { value: "great", label: "Great", Icon: Smile },
];

interface EffortPickerProps {
  value: Effort | null;
  onChange: (value: Effort) => void;
  required?: boolean;
  error?: string;
}

export function EffortPicker({
  value,
  onChange,
  required = false,
  error,
}: EffortPickerProps) {
  const errorId = `${useId()}-effort-error`;
  return (
    <fieldset className="effort-picker" aria-describedby={error ? errorId : undefined}>
      <legend className="effort-picker__legend">
        Effort {required && <span aria-hidden="true">*</span>}
      </legend>
      <div className="effort-picker__options">
        {EFFORTS.map(({ value: option, label, Icon }) => (
          <button
            key={option}
            type="button"
            className="effort-picker__option"
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            <Icon size={24} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
      {error && (
        <p id={errorId} className="form-field__error" role="alert">
          {error}
        </p>
      )}
    </fieldset>
  );
}
