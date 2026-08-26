import { windowRangeLabel } from "./signalFormatting.js";
import type {
  SignalWindow,
  SignalWindowCoverage,
} from "../../signals/trainingSignal.js";

/**
 * Shared presentation pieces for Training Signals details.
 *
 * The domain decides every value and comparison. These components only make the
 * working easier to scan on a phone: one result-first comparison, one quiet
 * reference row, and short coverage copy for optional metrics.
 */

export function SignalResultSummary({
  currentLabel = "Last 28 days",
  currentValue,
  change,
}: {
  currentLabel?: string;
  currentValue: string;
  change: string;
}) {
  return (
    <div className="signal-result">
      <div className="signal-result__current">
        <strong className="data-value">{currentValue}</strong>
        <span className="machine-label">{currentLabel}</span>
      </div>
      <div className="signal-result__change">
        <strong className="data-value">{change}</strong>
        <span className="machine-label">Change</span>
      </div>
    </div>
  );
}

export function SignalReference({
  label = "Prior 28 days",
  value,
}: {
  label?: string;
  value: string;
}) {
  return (
    <dl className="signal-reference">
      <div>
        <dt className="machine-label">{label}</dt>
        <dd className="data-value">{value}</dd>
      </div>
    </dl>
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
