import { windowRangeLabel } from "./signalFormatting";
import type {
  SignalWindow,
  SignalWindowCoverage,
} from "../../signals/trainingSignal";

/**
 * Shared presentation pieces for Training Signals details.
 *
 * The domain decides every value and comparison. These components only make the
 * working easier to scan on a phone: one compact comparison instead of four KPI
 * tiles, exact dates underneath, and short coverage copy for optional metrics.
 */

export function SignalComparisonSummary({
  currentLabel = "Last 28 days",
  currentValue,
  baselineLabel = "Prior 28 days",
  baselineValue,
  change,
}: {
  currentLabel?: string;
  currentValue: string;
  baselineLabel?: string;
  baselineValue: string;
  change: string;
}) {
  return (
    <div className="signal-comparison">
      <div className="signal-comparison__period">
        <span className="machine-label">{currentLabel}</span>
        <strong className="data-value">{currentValue}</strong>
      </div>
      <div className="signal-comparison__period">
        <span className="machine-label">{baselineLabel}</span>
        <strong className="data-value">{baselineValue}</strong>
      </div>
      <p className="signal-comparison__change">
        <span className="machine-label">Change</span>
        <strong className="data-value">{change}</strong>
      </p>
    </div>
  );
}

/** Both windows' dates, stated together so neither can be mistaken. */
export function SignalPeriods({
  current,
  baseline,
}: {
  current: SignalWindow;
  baseline: SignalWindow | null;
}) {
  return (
    <dl className="signal-periods">
      <div>
        <dt className="machine-label">Last {current.days} days</dt>
        <dd className="machine-label">{windowRangeLabel(current)}</dd>
      </div>
      {baseline && (
        <div>
          <dt className="machine-label">Prior {baseline.days} days</dt>
          <dd className="machine-label">{windowRangeLabel(baseline)}</dd>
        </div>
      )}
    </dl>
  );
}

/**
 * A concise statement of optional-metric coverage. The domain already refuses a
 * comparison when coverage is too thin or too uneven; the runner only needs to
 * know how many runs contributed, not the implementation rule behind it.
 */
export function SignalCoverageNote({
  coverage,
  metric,
}: {
  coverage: SignalWindowCoverage;
  metric: string;
}) {
  return (
    <p className="signal-detail__note">
      {metric} available for {coverage.currentPresent}/{coverage.currentTotal} recent{" "}
      {coverage.currentTotal === 1 ? "run" : "runs"} and {coverage.baselinePresent}/
      {coverage.baselineTotal} prior {coverage.baselineTotal === 1 ? "run" : "runs"}.
    </p>
  );
}
