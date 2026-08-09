import type { ReactNode } from "react";

interface EmptyStateProps {
  /** A lucide icon, sized around 24px. Decorative. */
  icon: ReactNode;
  title: string;
  /** One or two sentences saying what would put something here. */
  children: ReactNode;
  action?: ReactNode;
}

/**
 * What a screen says when it has nothing to show yet.
 *
 * Always a reason and a next step, never an apology: an empty Build is the
 * state every runner starts in, and it should read like the beginning of
 * something rather than a fault.
 */
export function EmptyState({ icon, title, children, action }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className="empty-state__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="empty-state__title">{title}</p>
      <p className="empty-state__body">{children}</p>
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
