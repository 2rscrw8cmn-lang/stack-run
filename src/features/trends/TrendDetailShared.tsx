import type { ReactNode } from "react";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { formatDurationSeconds } from "../../domain/duration";
import { formatPace } from "../../domain/runs";
import type { RunLog } from "../../domain/types";

export interface SignalFact {
  label: string;
  value: string;
}

export function SignalFacts({ facts }: { facts: SignalFact[] }) {
  return (
    <dl className="signal-facts">
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="signal-detail__section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

export function TrendRunList({
  runs,
  onOpenRun,
  extra,
  empty,
}: {
  runs: RunLog[];
  onOpenRun: (runLogId: string) => void;
  extra?: (run: RunLog) => string | null;
  empty: string;
}) {
  if (runs.length === 0) return <p className="signal-detail__empty">{empty}</p>;
  return (
    <ul className="signal-run-list">
      {runs.map((run) => {
        const pace = formatPace(run.distanceMiles, run.durationSeconds);
        const extraValue = extra?.(run);
        return (
          <li key={run.id}>
            <button
              type="button"
              onClick={() => onOpenRun(run.id)}
              aria-label={`Open ${WORKOUT_TYPE_LABEL[run.activityType]} on ${formatDateLabel(run.completedDate)}, ${formatMiles(run.distanceMiles)} miles`}
            >
              <span>
                <strong>{formatDateLabel(run.completedDate, { month: "short", day: "numeric" })}</strong>
                <small>{WORKOUT_TYPE_LABEL[run.activityType]}</small>
              </span>
              <span>
                <strong>{formatMiles(run.distanceMiles)} mi</strong>
                <small>
                  {formatDurationSeconds(run.durationSeconds)}{pace ? ` · ${pace}` : ""}
                  {extraValue ? ` · ${extraValue}` : ""}
                </small>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
