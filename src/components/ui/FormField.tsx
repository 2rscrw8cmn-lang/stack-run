import { cloneElement, useId, type InputHTMLAttributes, type ReactElement } from "react";

interface FormFieldProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactElement<InputHTMLAttributes<HTMLInputElement>>;
}

/** Provides the label/input id relationship, hint, error, and required state for one field. */
export function FormField({
  label,
  hint,
  error,
  required,
  children,
}: FormFieldProps) {
  const inputId = useId();
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div className="form-field">
      <label htmlFor={inputId} className="form-field__label">
        {label}
        {required && (
          <span className="form-field__required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {cloneElement(children, {
        id: inputId,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required,
      })}
      {hint && (
        <p id={hintId} className="form-field__hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="form-field__error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
