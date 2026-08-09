import type { ReactNode } from "react";

interface SectionProps {
  /** A lucide icon, sized 15-16px. Decorative: the title carries the meaning. */
  icon: ReactNode;
  title: string;
  /** A short value that belongs beside the title — a count, a progress figure. */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * A titled band of content.
 *
 * Everything on a screen used to be a card, which gave five unrelated things
 * the same weight and left nothing to look at first. A section is the quiet
 * alternative: a hairline, an icon, a name, and the content itself. Cards are
 * kept for the one thing on a screen the user can act on.
 */
export function Section({
  icon,
  title,
  meta,
  className,
  children,
}: SectionProps) {
  const classes = ["section", className].filter(Boolean).join(" ");

  return (
    <section className={classes}>
      <div className="section__header">
        <span className="section__icon" aria-hidden="true">
          {icon}
        </span>
        <h2 className="section__title">{title}</h2>
        {meta !== undefined && <div className="section__meta">{meta}</div>}
      </div>
      {children}
    </section>
  );
}
