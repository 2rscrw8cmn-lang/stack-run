import { DonutChart } from "../../components/charts/DonutChart";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import type { RunActivityType } from "../../domain/types";
import type { TrainingSignals } from "../../domain/trends";
import { SignalFacts } from "./TrendDetailShared";

const ACTIVITY_COLOR: Record<RunActivityType, string> = {
  easy: "var(--easy)",
  intervals: "var(--intervals)",
  simulation: "var(--simulation)",
  long: "var(--long)",
  race: "var(--race)",
};

export function RunMixDetail({ signals }: { signals: TrainingSignals }) {
  const { runMix } = signals;
  if (runMix.totalMiles <= 0) return <p className="signal-detail__empty">No actual miles were recorded in the last 4 weeks.</p>;
  const dominant = runMix.slices.reduce((best, slice) => slice.miles > best.miles ? slice : best, runMix.slices[0]);
  return (
    <div className="signal-detail">
      <p className="signal-detail__intro">
        Actual miles by STACK activity type, {formatDateLabel(runMix.startDate, { month: "short", day: "numeric" })} through {formatDateLabel(runMix.endDate, { month: "short", day: "numeric" })}.
      </p>
      <DonutChart
        label="Last 4 weeks run mix"
        centerValue={`${Math.round(dominant.share * 100)}%`}
        centerLabel={WORKOUT_TYPE_LABEL[dominant.activityType]}
        segments={runMix.slices.map((slice) => ({
          label: WORKOUT_TYPE_LABEL[slice.activityType],
          value: slice.miles,
          valueLabel: `${formatMiles(slice.miles)} mi · ${slice.runCount} ${slice.runCount === 1 ? "run" : "runs"}`,
          color: ACTIVITY_COLOR[slice.activityType],
        }))}
      />
      <SignalFacts facts={[
        { label: "Actual miles", value: `${formatMiles(runMix.totalMiles)} mi` },
        { label: "Largest share", value: `${WORKOUT_TYPE_LABEL[dominant.activityType]} · ${Math.round(dominant.share * 100)}%` },
      ]} />
      <p className="signal-detail__footnote">Scheduled and extra runs are grouped by what the run was. Extra is not an activity type.</p>
    </div>
  );
}

