import type { ReactNode } from "react";
import { Card } from "../../components/ui/Card";

interface TodayActionCardProps {
  /** Which state of the same card this is. Presentation only. */
  state: "scheduled" | "found" | "complete";
  /** Decorative: the eyebrow names the kind of run in text. */
  icon: ReactNode;
  /** What the card is: `Today’s workout`, `Run complete`. */
  label: string;
  /** What kind of run it is about, named once for the whole card. */
  kind: string;
  /** The activity colour chip, or the completion mark. */
  mark: ReactNode;
  /** The one figure the card leads with. */
  value: string;
  /** A second line, only when the title carries more than the value does. */
  caption?: string | null;
  /**
   * Announces the value when the card arrives. The completed state uses it:
   * a run can appear on Today without the runner having saved it here.
   */
  live?: boolean;
  /** Instruction, actions — whatever this state still needs.  */
  children?: ReactNode;
}

/**
 * The Today Action Card: one card language for the run Today is about, before
 * and after it happens (issues #152 and #153).
 *
 * Today only ever has one of these on screen. Before the run it holds either
 * the scheduled workout or the synced run that may satisfy it; after explicit
 * acceptance it holds what the run still owes. The frame is the same in every
 * state so the card reads as one object changing state, and every state pays
 * for its own height: an eyebrow, one value, and only the lines still true.
 */
export function TodayActionCard({
  state,
  icon,
  label,
  kind,
  mark,
  value,
  caption = null,
  live = false,
  children,
}: TodayActionCardProps) {
  return (
    <Card className="today-action" data-state={state}>
      <p className="today-action__eyebrow machine-label">
        {icon}
        <span>{label}</span>
        <span className="today-action__separator" aria-hidden="true">
          ·
        </span>
        <span className="today-action__kind">{kind}</span>
      </p>
      <div className="today-action__reading">
        {mark}
        <div className="today-action__lines">
          <p
            className="today-action__value data-value"
            aria-live={live ? "polite" : undefined}
          >
            {value}
          </p>
          {caption && <p className="today-action__caption">{caption}</p>}
        </div>
      </div>
      {children}
    </Card>
  );
}
