import { useRef, type KeyboardEvent } from "react";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import type { RunActivityType } from "../../domain/types";
import { ActivityIcon } from "./ActivityIcon";

const PICKER_TYPES: readonly RunActivityType[] = [
  "easy",
  "intervals",
  "long",
  "simulation",
  "race",
];

interface ActivityTypePickerProps {
  label?: string;
  value: RunActivityType;
  onChange: (value: RunActivityType) => void;
  required?: boolean;
}

export function ActivityTypePicker({
  label = "Activity",
  value,
  onChange,
  required = false,
}: ActivityTypePickerProps) {
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function selectFromKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % PICKER_TYPES.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + PICKER_TYPES.length) % PICKER_TYPES.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PICKER_TYPES.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    onChange(PICKER_TYPES[nextIndex]);
    optionRefs.current[nextIndex]?.focus();
  }

  return (
    <fieldset className="activity-type-picker">
      <legend className="activity-type-picker__legend">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </legend>
      <div
        className="activity-type-picker__options"
        role="radiogroup"
        aria-label={label}
        aria-required={required}
      >
        {PICKER_TYPES.map((type, index) => (
          <button
            key={type}
            ref={(element) => { optionRefs.current[index] = element; }}
            type="button"
            role="radio"
            aria-checked={value === type}
            tabIndex={value === type ? 0 : -1}
            className="activity-type-picker__option"
            data-type={type}
            onClick={() => onChange(type)}
            onKeyDown={(event) => selectFromKeyboard(event, index)}
          >
            <ActivityIcon type={type} size={18} />
            <span>{WORKOUT_TYPE_LABEL[type]}</span>
          </button>
        ))}
      </div>
    </fieldset>
  );
}
