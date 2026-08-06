import { Card } from "../../components/ui/Card";
import type { BuildSummaryMetrics } from "../../domain/build";

interface BuildMetricsProps {
  metrics: BuildSummaryMetrics;
}

export function BuildMetrics({ metrics }: BuildMetricsProps) {
  return (
    <Card className="build-metrics">
      <dl className="build-metrics__list">
        <div className="build-metrics__metric">
          <dt>Runs Complete</dt>
          <dd>
            {metrics.completedRuns}
            <span className="build-metrics__of"> / {metrics.plannedRuns}</span>
          </dd>
        </div>
        <div className="build-metrics__metric">
          <dt>Total Miles</dt>
          <dd>{metrics.totalActualMiles}</dd>
        </div>
        <div className="build-metrics__metric">
          <dt>Run Streak</dt>
          <dd>{metrics.currentStreak}</dd>
        </div>
      </dl>
    </Card>
  );
}
