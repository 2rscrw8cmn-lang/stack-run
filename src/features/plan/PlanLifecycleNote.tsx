import { CalendarPlus, ChevronRight, Flag } from "lucide-react";
import type { PlanLifecycleNote as LifecycleNote } from "./planLifecycle.js";

interface PlanLifecycleNoteProps {
  note: LifecycleNote;
  /**
   * Offered only once the plan's race has passed, and only where the existing
   * race/plan setup flow is reachable. Plan does not own plan generation; this
   * opens the same sheet Settings opens.
   */
  onSetUpNextRace?: () => void;
  onFinishRacePlan?: () => void;
}

/**
 * Where the plan is in its own life, in one quiet line.
 *
 * This exists because a plan window has edges. Before it starts, every week is
 * a preview; after race day, every week is history. Without saying so, Plan
 * reads as though training is permanently underway and a week that was never
 * trained looks like a week that went wrong.
 *
 * It is deliberately not a hero: no countdown, no progress, no grade. Today
 * already carries race context, so this says only which side of the plan
 * window the runner is on and — once the race is behind them — where the next
 * race is set up.
 */
export function PlanLifecycleNote({
  note,
  onSetUpNextRace,
  onFinishRacePlan,
}: PlanLifecycleNoteProps) {
  const Icon = note.lifecycle === "before-plan" ? CalendarPlus : Flag;

  return (
    <section
      className="plan-lifecycle"
      data-lifecycle={note.lifecycle}
      aria-label="Plan lifecycle"
    >
      <p className="plan-lifecycle__headline machine-label">
        <Icon size={14} strokeWidth={1.8} aria-hidden="true" />
        {note.headline}
      </p>
      <p className="plan-lifecycle__detail">{note.detail}</p>
      {onSetUpNextRace && (
        <button
          type="button"
          className="plan-lifecycle__action"
          onClick={onSetUpNextRace}
        >
          Set up next race
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
      {onFinishRacePlan && (
        <button
          type="button"
          className="plan-lifecycle__action plan-lifecycle__action--quiet"
          onClick={onFinishRacePlan}
        >
          Finish race plan
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      )}
    </section>
  );
}
