import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  icon: ReactNode;
}

/** Icon-only control (close, overflow, week navigation). Always carries an accessible label. */
export function IconButton({
  label,
  icon,
  className,
  type = "button",
  ...rest
}: IconButtonProps) {
  const classes = ["icon-button", className].filter(Boolean).join(" ");

  return (
    <button type={type} className={classes} aria-label={label} {...rest}>
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
