import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import type { TrainingSignal } from "../../signals/trainingSignal.js";

interface TodaySignalNoteProps {
  signal: TrainingSignal;
  /** Opens Runs, where Training Signals and their detail already live. */
  onViewSignals: () => void;
}

/**
 * One observation about this runner's training, and only one.
 *
 * Today is allowed a single Training Signal. Not a list, not a carousel and not
 * a score — those exist on Runs, where a runner has gone to inspect. Here the
 * signal has one job: to say the thing about the last month that is actually
 * different, so the screen understands the runner beyond today's workout.
 *
 * What it says is what NEXT-3 already decided. The headline, the evidence, the
 * thresholds and the availability rules all come from `src/signals/`; this
 * component computes nothing and rewords nothing. In particular it does not
 * translate an observation into advice: "Workload is higher" never becomes "take
 * it easy today", because STACK describes training and does not coach.
 *
 * Tapping it goes to Runs rather than opening a second detail implementation
 * beside the one NEXT-3 built.
 */
export function TodaySignalNote({ signal, onViewSignals }: TodaySignalNoteProps) {
  return (
    <button
      type="button"
      className="today-signal"
      data-signal={signal.id}
      data-direction={signal.direction ?? "none"}
      aria-label={`${signal.headline}. ${signal.support} Open Runs.`}
      onClick={onViewSignals}
    >
      <span className="today-signal__mark" aria-hidden="true">
        {signal.direction === "falling" ? (
          <TrendingDown size={15} strokeWidth={2} />
        ) : (
          <TrendingUp size={15} strokeWidth={2} />
        )}
      </span>
      <span className="today-signal__body">
        <span className="today-signal__headline">{signal.headline}</span>
        <span className="today-signal__evidence">{signal.support}</span>
      </span>
      <span className="today-signal__more" aria-hidden="true">
        <ChevronRight size={16} strokeWidth={2} />
      </span>
    </button>
  );
}
