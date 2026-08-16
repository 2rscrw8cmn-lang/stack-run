import { windowRangeLabel } from "./signalFormatting";
import type {
  SignalWindow,
  SignalWindowCoverage,
} from "../../signals/trainingSignal";

/**
 * The two parts every signal detail shares: the windows it used, and how much
 * of them carried the metric. Both are the difference between a number and a
 * checkable number, which is the standard these sheets are held to.
 */

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
 * How much of each window carried the metric.
 *
 * Stated rather than implied, because a total assembled from 8 of 12 runs is a
 * different fact from one assembled from 12 of 12, and the difference is
 * invisible in the total itself.
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
      {coverage.currentPresent} of {coverage.currentTotal}{" "}
      {coverage.currentTotal === 1 ? "run" : "runs"} in the last 28 days carried{" "}
      {metric}, and {coverage.baselinePresent} of {coverage.baselineTotal} in the
      28 before. Runs without it are left out rather than counted as zero.
    </p>
  );
}
