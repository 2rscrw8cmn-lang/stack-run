import { Activity, ChevronRight, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { Section } from "../../components/ui/Section";
import type {
  SignalDirection,
  TrainingSignal,
} from "../../signals/trainingSignal";

interface SignalCardsProps {
  signals: TrainingSignal[];
  /** True when the runner has runs but no signal can be computed from them yet. */
  hasHistory: boolean;
  onOpenSignal: (signal: TrainingSignal) => void;
}

/**
 * Training Signals, as a short list of observations.
 *
 * The v1 cards were KPI tiles: a title, a big number, a note — `8.2 mi`,
 * `Weekly Mileage`. A number that size reads as a score even when it is only a
 * sum, and two of them side by side invite a comparison nobody defined. These
 * cards lead with the *sentence* instead, and the numbers appear underneath it
 * as the evidence for the sentence:
 *
 * > **Volume is building**
 * > 24.8 mi in the last 28 days, up from 19.6 mi in the 28 before.
 * > Last 28d vs prior 28d
 *
 * Full-width rows rather than a grid, because the unit here is a statement and a
 * statement needs a line of text, not a tile. One idea per card, and the whole
 * card opens the detail behind it.
 *
 * Three things this deliberately does not do. It **computes nothing** — every
 * word and number arrives from the domain, and a component that decided what
 * counted as building would be inventing a claim nothing had documented. It
 * **does not colour by direction**: rising is not green and falling is not red,
 * because that is scorekeeping and a lower month is not a failure. And it
 * **never renders an empty card** — a signal with nothing to say is not here at
 * all, replaced at most by one compact line when nothing at all can be said yet.
 */
export function SignalCards({ signals, hasHistory, onOpenSignal }: SignalCardsProps) {
  if (signals.length === 0 && !hasHistory) return null;

  return (
    <Section
      className="signal-cards"
      icon={<Activity size={15} strokeWidth={2} />}
      title="Training Signals"
    >
      {signals.length === 0 ? (
        <p className="signal-cards__waiting">
          Signals compare your last 28 days with the 28 before them. STACK needs a
          little more history before it can say anything it could show you the
          working for.
        </p>
      ) : (
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
                  <span className="signal-card__window machine-label">
                    {signal.windowLabel}
                  </span>
                </span>
                <span className="signal-card__more" aria-hidden="true">
                  <ChevronRight size={16} strokeWidth={2} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

/**
 * A muted glyph for the direction, in the card's own ink.
 *
 * Decorative and `aria-hidden`: the headline already says which way the measure
 * moved, and the glyph is there so a runner can find the moving ones at a
 * glance. It carries no colour of its own for the same reason nothing else here
 * does.
 */
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
