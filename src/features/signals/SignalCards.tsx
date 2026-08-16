import { Activity, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Section } from "../../components/ui/Section";
import type {
  SignalDirection,
  TrainingSignal,
} from "../../signals/trainingSignal";
import "./signalPresentationCleanup.css";

interface SignalCardsProps {
  signals: TrainingSignal[];
  /** True when the runner has runs but no signal can be computed from them yet. */
  hasHistory: boolean;
  onOpenSignal: (signal: TrainingSignal) => void;
}

/**
 * Training Signals, as a short list of observations.
 *
 * Each historical card leads with the sentence and its evidence. Those cards all
 * use the same 28-day comparison, so that context is stated once for the section
 * rather than repeated on every row. Plan context is the exception and keeps its
 * own "Plan to date" label visible.
 */
export function SignalCards({ signals, hasHistory, onOpenSignal }: SignalCardsProps) {
  if (signals.length === 0 && !hasHistory) return null;
  const hasHistoricalComparison = signals.some(
    (signal) => signal.family !== "plan-context",
  );

  return (
    <Section
      className="signal-cards"
      icon={<Activity size={15} strokeWidth={2} />}
      title="Training Signals"
    >
      {signals.length === 0 ? (
        <p className="signal-cards__waiting">
          <strong>More history needed.</strong> Signals compare your last 28 days
          with the 28 before them.
        </p>
      ) : (
        <>
          {hasHistoricalComparison && (
            <p className="signal-cards__context machine-label">
              Last 28 days vs prior 28 days
            </p>
          )}
          <ul className="signal-cards__list">
            {signals.map((signal) => (
              <li key={signal.id}>
                <button
                  type="button"
                  className="signal-card"
                  data-signal={signal.id}
                  data-direction={signal.direction ?? "none"}
                  aria-label={`${signal.headline}. ${signal.support} ${signal.windowLabel}. Open ${signal.title} detail.`}
                  onClick={() => onOpenSignal(signal)}
                >
                  <span className="signal-card__mark" aria-hidden="true">
                    <DirectionGlyph direction={signal.direction} />
                  </span>
                  <span className="signal-card__body">
                    <span className="signal-card__headline">{signal.headline}</span>
                    <span className="signal-card__evidence">{signal.support}</span>
                    {signal.family === "plan-context" && (
                      <span className="signal-card__window machine-label">
                        {signal.windowLabel}
                      </span>
                    )}
                  </span>
                  <span className="signal-card__more" aria-hidden="true">
                    <ChevronRight size={16} strokeWidth={2} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/** A muted direction glyph; the headline carries the meaning for accessibility. */
function DirectionGlyph({ direction }: { direction: SignalDirection | null }) {
  switch (direction) {
    case "rising":
      return <TrendingUp size={16} strokeWidth={2} />;
    case "falling":
      return <TrendingDown size={16} strokeWidth={2} />;
    case "steady":
      return <Minus size={16} strokeWidth={2} />;
    case null:
      return <Activity size={16} strokeWidth={2} />;
  }
}
