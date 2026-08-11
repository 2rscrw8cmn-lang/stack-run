import { ChevronDown } from "lucide-react";
import type { SelectHTMLAttributes } from "react";

type StackSelectProps = SelectHTMLAttributes<HTMLSelectElement>;

/** Accessible native selection with one visual treatment across STACK. */
export function StackSelect({ className, children, ...props }: StackSelectProps) {
  return (
    <span className="stack-select">
      <select
        className={["stack-select__control", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="stack-select__chevron"
        size={18}
        strokeWidth={2}
        aria-hidden="true"
      />
    </span>
  );
}
