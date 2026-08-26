import type { TrainingSignals } from "../../domain/trends.js";
import { DetailSection } from "./TrendDetailShared.js";

export function ConsistencyDetail({ signals }: { signals: TrainingSignals }) {
  const { consistency } = signals;
  if (consistency.percentage === null) return <p className="signal-detail__empty">The plan has not asked for a run yet.</p>;
  return (
    <DetailSection title="Plan weeks">
      <ol className="consistency-grid" aria-label="Plan-week completion">
        {consistency.weeks.map((week) => (
          <li key={week.weekNumber} className="consistency-grid__week">
            <span className="consistency-grid__number">Week {week.weekNumber}</span>
            <span className="consistency-grid__ratio">{week.completed}/{week.due}</span>
            <span className="consistency-grid__status">
              {week.missed === 0 ? "All due runs complete" : `${week.missed} missed`}
              {week.extraRuns > 0 ? ` · ${week.extraRuns} extra` : ""}
            </span>
          </li>
        ))}
      </ol>
    </DetailSection>
  );
}

