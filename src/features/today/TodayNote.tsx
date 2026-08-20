import type { ReactNode } from "react";

interface TodayNoteProps {
  /** A lucide icon at 15-16px. Decorative: the eyebrow carries the meaning. */
  icon: ReactNode;
  /** What today is, in two or three words. */
  eyebrow: string;
  children: ReactNode;
}

/**
 * A day that asks nothing of the runner, said in one line.
 *
 * Three of Today's five immediate states are this state: a rest day, a plan that
 * has not started, and a race that has already happened. Each used to occupy a
 * full card — an icon block, a heading and a paragraph — which made the emptiest
 * days on the calendar the loudest thing on the screen and left no room above
 * the fold for anything that was actually true about the runner.
 *
 * The information is unchanged and the tone is unchanged; only the volume is.
 * A rest day is still a fact worth stating, and stating it quietly is what lets
 * the recent-training context, the week and the Build below it carry the screen
 * on the days the plan has nothing to say.
 */
export function TodayNote({ icon, eyebrow, children }: TodayNoteProps) {
  return (
    <div className="today-note">
      <p className="today-note__eyebrow machine-label">
        <span className="today-note__icon" aria-hidden="true">
          {icon}
        </span>
        {eyebrow}
      </p>
      <p className="today-note__body">{children}</p>
    </div>
  );
}
