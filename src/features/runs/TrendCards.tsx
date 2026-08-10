import { TrendingUp } from "lucide-react";
import { Section } from "../../components/ui/Section";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatMiles } from "../../domain/distance";
import {
  meanValues,
  selectTrainingSignals,
  type TrainingSignalId,
} from "../../domain/trends";
import type { RunLog, TrainingPlan } from "../../domain/types";
import { paceLabel } from "../trends/trendFormatting";

interface TrendCardsProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  today: string;
  onOpenSignal: (signal: TrainingSignalId) => void;
}

interface SignalCard {
  id: TrainingSignalId;
  title: string;
  value: string;
  note: string;
}

function signed(value: number, suffix: string): string {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value)}${suffix}`;
}

/** Seven factual summaries, each opening only its own focused detail. */
export function TrendCards({ plan, runLogs, today, onOpenSignal }: TrendCardsProps) {
  if (runLogs.length === 0) return null;
  const signals = selectTrainingSignals(plan, runLogs, today);
  const cards: SignalCard[] = [];

  const latestWeek = [...signals.weeklyMileage].reverse().find((week) => week.actualMiles > 0);
  if (latestWeek) {
    const index = signals.weeklyMileage.indexOf(latestWeek);
    const baseline = meanValues(
      signals.weeklyMileage
        .slice(0, index)
        .filter((week) => !week.isPartial && week.actualMiles > 0)
        .slice(-4)
        .map((week) => week.actualMiles),
    );
    const delta = baseline === null ? null : Number((latestWeek.actualMiles - baseline).toFixed(1));
    cards.push({
      id: "weekly-mileage",
      title: "Weekly Mileage",
      value: `${formatMiles(latestWeek.actualMiles)} mi`,
      note: delta === null
        ? `Week ${latestWeek.weekNumber}${latestWeek.isPartial ? " so far" : ""}`
        : `${signed(delta, "")} mi vs 4wk avg${latestWeek.isPartial ? " · so far" : ""}`,
    });
  }

  const latestLong = signals.longRuns.at(-1);
  if (latestLong) {
    const prior = signals.longRuns.at(-2);
    const delta = prior ? Number((latestLong.value - prior.value).toFixed(1)) : null;
    cards.push({
      id: "long-run",
      title: "Long Run",
      value: `${formatMiles(latestLong.value)} mi`,
      note: delta === null ? "Most recent" : `${signed(delta, "")} mi from last`,
    });
  }

  const latestEasy = signals.easyRuns.at(-1);
  if (latestEasy) {
    const comparison = signals.recentEasy && signals.previousEasy
      ? Math.round(signals.previousEasy.medianPace - signals.recentEasy.medianPace)
      : null;
    cards.push({
      id: "easy-pace",
      title: "Easy Pace",
      value: paceLabel(signals.recentEasy?.medianPace ?? latestEasy.paceSecondsPerMile),
      note: comparison === null
        ? `${signals.easyRuns.length} Easy ${signals.easyRuns.length === 1 ? "run" : "runs"}`
        : comparison === 0
          ? "Same as previous 4"
          : `${Math.abs(comparison)} sec ${comparison > 0 ? "quicker" : "slower"} vs previous 4`,
    });
  }

  const zoneTotal = signals.heartRateZones.zoneSeconds.reduce((sum, seconds) => sum + seconds, 0);
  if (zoneTotal > 0) {
    const dominantSeconds = Math.max(...signals.heartRateZones.zoneSeconds);
    const dominantIndex = signals.heartRateZones.zoneSeconds.indexOf(dominantSeconds);
    cards.push({
      id: "hr-zones",
      title: "HR Zones",
      value: `${Math.round((dominantSeconds / zoneTotal) * 100)}% Zone ${dominantIndex + 1}`,
      note: `${signals.heartRateZones.coveredRuns} runs with HR zones`,
    });
  }

  if (signals.hasUsefulTrainingLoad) {
    const valued = signals.trainingLoad.filter((week) => week.total !== null);
    const latest = valued.at(-1)!;
    const index = signals.trainingLoad.indexOf(latest);
    const baseline = meanValues(
      signals.trainingLoad
        .slice(0, index)
        .filter((week) => !week.isPartial && week.total !== null)
        .slice(-4)
        .map((week) => week.total!),
    );
    const change = baseline === null || baseline === 0
      ? null
      : Math.round(((latest.total! - baseline) / baseline) * 100);
    cards.push({
      id: "training-load",
      title: "Training Load",
      value: String(latest.total),
      note: change === null ? `Week ${latest.weekNumber}` : `${signed(change, "%")} vs 4wk avg`,
    });
  }

  if (signals.consistency.percentage !== null) {
    cards.push({
      id: "consistency",
      title: "Consistency",
      value: `${signals.consistency.percentage}%`,
      note: `${signals.consistency.completed} of ${signals.consistency.due} completed`,
    });
  }

  if (signals.runMix.totalMiles > 0 && signals.runMix.slices.length > 0) {
    const dominant = signals.runMix.slices.reduce((best, slice) => slice.miles > best.miles ? slice : best, signals.runMix.slices[0]);
    cards.push({
      id: "run-mix",
      title: "Run Mix",
      value: `${Math.round(dominant.share * 100)}% ${WORKOUT_TYPE_LABEL[dominant.activityType]}`,
      note: "Last 4 weeks",
    });
  }

  if (cards.length === 0) return null;
  return (
    <Section className="trend-cards" icon={<TrendingUp size={15} strokeWidth={2} />} title="Training Signals">
      <ul className="trend-cards__grid">
        {cards.map((card) => (
          <li key={card.id}>
            <button
              type="button"
              className="trend-cards__card data-module"
              data-signal={card.id}
              aria-label={`${card.title}, ${card.value}, ${card.note}. Open ${card.title} detail.`}
              onClick={() => onOpenSignal(card.id)}
            >
              <span className="trend-cards__title machine-label">{card.title}</span>
              <span className="trend-cards__value data-value">{card.value}</span>
              <span className="trend-cards__note">{card.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
