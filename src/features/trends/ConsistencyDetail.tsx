import type { TrainingSignals } from "../../domain/trends";
import { SignalFacts } from "./TrendDetailShared";

export function ConsistencyDetail({ signals }: { signals: TrainingSignals }) {
  const { consistency } = signals;
  if (consistency.percentage === null) return <p className="signal-detail__empty">The plan has not asked for a run yet.</p>;
  return (
    <div className="signal-detail">
      <p className="signal-detail__note">Scheduled-workout completion; extras do not fill missed plan runs.</p>
      <SignalFacts facts={[
        { label: "Plan to date", value: `${consistency.percentage}%` },
        { label: "Completed", value: `${consistency.completed} of ${consistency.due}` },
        { label: "Current full-week streak", value: `${consistency.currentFullWeekStreak} ${consistency.currentFullWeekStreak === 1 ? "week" : "weeks"}` },
        { label: "Best full-week streak", value: `${consistency.bestFullWeekStreak} ${consistency.bestFullWeekStreak === 1 ? "week" : "weeks"}` },
      ]} />
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
    </div>
  );
}

