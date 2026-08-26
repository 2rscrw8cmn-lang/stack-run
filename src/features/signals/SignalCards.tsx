import { Activity, ChevronRight } from "lucide-react";
import { Section } from "../../components/ui/Section.js";
import type { RunnerRun } from "../../history/runnerRun.js";
import type { TrainingSignal } from "../../signals/trainingSignal.js";
import { Button } from "../../components/ui/Button.js";
import { SignalOverviewVisual } from "./SignalOverviewVisual.js";
import { signalSummaryReading } from "./signalOverview.js";
import "./signalPresentationCleanup.css";

interface SignalCardsProps {
  signals: TrainingSignal[];
  runs: readonly RunnerRun[];
  today: string;
  /** True when the runner has runs but no signal can be computed from them yet. */
  hasHistory: boolean;
  onOpenSignal: (signal: TrainingSignal) => void;
  onToggleExpanded?: () => void;
  isExpanded?: boolean;
  hiddenSignalCount?: number;
}

/** Training Signals as visual-first factual instruments. */
export function SignalCards({
  signals,
  runs,
  today,
  hasHistory,
  onOpenSignal,
  onToggleExpanded,
  isExpanded = false,
  hiddenSignalCount = 0,
}: SignalCardsProps) {
  if (signals.length === 0 && !hasHistory) return null;

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
          <SignalSummaryList
            signals={signals}
            runs={runs}
            today={today}
            onOpenSignal={onOpenSignal}
          />
          {(hiddenSignalCount > 0 || isExpanded) && onToggleExpanded && (
            <div className="signal-cards__all">
              <Button
                variant="ghost"
                aria-expanded={isExpanded}
                aria-label={isExpanded ? "Show fewer signals" : "Show all signals"}
                onClick={onToggleExpanded}
              >
                {isExpanded ? "Show fewer" : "Show all"}
              </Button>
            </div>
          )}
        </>
      )}
    </Section>
  );
}

interface SignalSummaryListProps {
  signals: TrainingSignal[];
  runs: readonly RunnerRun[];
  today: string;
  onOpenSignal: (signal: TrainingSignal) => void;
  compact?: boolean;
}

export function SignalSummaryList({
  signals,
  runs,
  today,
  onOpenSignal,
  compact = false,
}: SignalSummaryListProps) {
  return (
    <ul className="signal-cards__list" data-density={compact ? "compact" : "featured"}>
      {signals.map((signal) => {
        const reading = signalSummaryReading(signal);
        if (!reading) return null;
        return (
          <li key={signal.id}>
            <button
              type="button"
              className="signal-card"
              data-signal={signal.id}
              data-direction={signal.direction ?? "none"}
              aria-label={`${signal.title}. ${reading.currentLabel}: ${reading.currentValue}. ${reading.changeLabel}: ${reading.changeValue}. ${reading.referenceLabel}: ${reading.referenceValue}. Open detail.`}
              onClick={() => onOpenSignal(signal)}
            >
              <span className="signal-card__header">
                <span className="signal-card__label">{signal.title}</span>
                <span className="signal-card__more" aria-hidden="true">
                  <ChevronRight size={16} strokeWidth={2} />
                </span>
              </span>
              <span className="signal-card__reading">
                <span className="signal-card__current">
                  <strong>{reading.currentValue}</strong>
                  <small>{reading.currentLabel}</small>
                </span>
                <span className="signal-card__change">
                  <strong>{reading.changeValue}</strong>
                  <small>{reading.changeLabel}</small>
                </span>
              </span>
              <SignalOverviewVisual signal={signal} runs={runs} today={today} />
              <span className="signal-card__reference">
                <small>{reading.referenceLabel}</small>
                <strong>{reading.referenceValue}</strong>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
