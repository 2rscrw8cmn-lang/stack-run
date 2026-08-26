import type { CSSProperties } from "react";
import type { RunnerRun } from "../../history/runnerRun.js";
import type { TrainingSignal } from "../../signals/trainingSignal.js";
import { signalOverviewVisual } from "./signalOverview.js";

interface SignalOverviewVisualProps {
  signal: TrainingSignal;
  runs: readonly RunnerRun[];
  today: string;
}

function fillStyle(percent: number): CSSProperties {
  return { "--signal-fill": `${percent}%` } as CSSProperties;
}

/**
 * Compact visual evidence for one already-computed Training Signal.
 * The card's visible sentence and accessible name remain authoritative; this
 * renderer only compresses the same facts into the family's documented form.
 */
export function SignalOverviewVisual({ signal, runs, today }: SignalOverviewVisualProps) {
  const visual = signalOverviewVisual(signal, runs, today);
  if (!visual) return null;

  if (visual.kind === "trend") {
    return (
      <span className="signal-card__visual signal-visual signal-visual--trend" aria-hidden="true">
        <svg viewBox="0 0 100 32" preserveAspectRatio="none">
          <path className="signal-visual__guide" d="M0 27H100" />
          {visual.segments.map((points) => (
            <polyline key={points} className="signal-visual__line" points={points} />
          ))}
        </svg>
      </span>
    );
  }

  if (visual.kind === "zones") {
    return (
      <span className="signal-card__visual signal-visual signal-visual--zones" aria-hidden="true">
        <span className="signal-visual__row">
          <span className="signal-visual__label">NOW</span>
          <span className="signal-visual__track signal-visual__track--zones">
            <span className="signal-visual__fill" style={fillStyle(visual.currentPercent)} />
          </span>
        </span>
        <span className="signal-visual__row">
          <span className="signal-visual__label">PRIOR</span>
          <span className="signal-visual__track signal-visual__track--zones">
            <span className="signal-visual__fill" style={fillStyle(visual.baselinePercent)} />
          </span>
        </span>
      </span>
    );
  }

  if (visual.kind === "progress") {
    return (
      <span className="signal-card__visual signal-visual signal-visual--progress" aria-hidden="true">
        <span className="signal-visual__row">
          <span className="signal-visual__label">RECORDED</span>
          <span className="signal-visual__track signal-visual__track--blocks">
            <span className="signal-visual__fill" style={fillStyle(visual.percent)} />
          </span>
        </span>
      </span>
    );
  }

  return (
    <span
      className="signal-card__visual signal-visual signal-visual--comparison"
      data-texture={visual.texture}
      aria-hidden="true"
    >
      <span className="signal-visual__row">
        <span className="signal-visual__label">NOW</span>
        <span className="signal-visual__track">
          <span className="signal-visual__fill" style={fillStyle(visual.currentPercent)} />
        </span>
      </span>
      <span className="signal-visual__row">
        <span className="signal-visual__label">PRIOR</span>
        <span className="signal-visual__track">
          <span className="signal-visual__fill" style={fillStyle(visual.baselinePercent)} />
        </span>
      </span>
    </span>
  );
}
