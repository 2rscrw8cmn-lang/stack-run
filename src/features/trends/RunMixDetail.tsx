import { DonutChart } from "../../components/charts/DonutChart";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
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
  cross: "var(--cross)",
};

export function RunMixDetail({ signals }: { signals: TrainingSignals }) {
  const { runMix } = signals;
  if (runMix.totalMiles <= 0) return <p className="signal-detail__empty">No actual miles were recorded in the last 4 weeks.</p>;
  const dominant = runMix.slices.reduce((best, slice) => slice.miles > best.miles ? slice : best, runMix.slices[0]);
  const runCount = runMix.slices.reduce((total, slice) => total + slice.runCount, 0);
  return (
    <div className="signal-detail">
      <p className="signal-detail__period machine-label">Last 4 weeks</p>
      <DonutChart
        size="large"
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
        { label: "Total", value: `${formatMiles(runMix.totalMiles)} mi` },
        { label: "Runs", value: String(runCount) },
        { label: "Largest share", value: `${WORKOUT_TYPE_LABEL[dominant.activityType]} · ${Math.round(dominant.share * 100)}%` },
      ]} />
    </div>
  );
}

