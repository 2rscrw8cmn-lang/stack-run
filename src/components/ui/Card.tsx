import type { HTMLAttributes } from "react";

/** One neutral surface. Deliberately has no variant explosion. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  const classes = ["card", className].filter(Boolean).join(" ");
  return <div className={classes} {...rest} />;
}
