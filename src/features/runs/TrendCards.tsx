import { TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { ProgressBar } from "../../components/ui/ProgressBar";
import { Section } from "../../components/ui/Section";
import { TrendColumns } from "../../components/charts/TrendColumns";
import { TrendLine } from "../../components/charts/TrendLine";
import { formatMiles } from "../../domain/distance";
import type { RunLog, TrainingPlan } from "../../domain/types";
import {
  describeDirection,
  DIRECTION_WORD,
  PHYSIOLOGICAL_SIGNIFICANCE,
  selectTrainingTrends,
} from "../../domain/trends";

interface TrendCardsProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  today: string;
  /** Opens the full Training Trends view, which every card is a way into. */
  onViewTrends: () => void;
}

interface Card {
  key: string;
  title: string;
  /** The one number this card is about, already formatted. */
  value: string;
  /** A short phrase under the number: a period, a direction, a count. */
  note: string;
  /** The drawing, when there is enough to draw. Always `aria-hidden`. */
  chart: ReactNode | null;
}

function pace(secondsPerMile: number): string {
  return `${Math.floor(secondsPerMile / 60)}:${String(Math.round(secondsPerMile) % 60).padStart(2, "0")} /mi`;
}

/**
 * Training Trends at the top of Runs, one measure per card.
 *
 * Runs is where a runner comes to look at what they have actually done, so the
 * trends belong on it rather than behind a link on it — the answer to "is this
 * working" should be visible on arrival. The cards are a swipeable row rather
 * than a stack because five of them stacked would push the run list off the
 * screen, and the list is still what this tab is for.
 *
 * Each card is a real button into the full view: the strip is a summary, and
 * the numbers behind it, the tables and the ranges all still live in the
 * sheet. Nothing here is stored or computed twice — every value comes from
 * `selectTrainingTrends`, the same selector the sheet reads.
 */
export function TrendCards({ plan, runLogs, today, onViewTrends }: TrendCardsProps) {
  const { weeklyMileage, longRuns, consistency, easyPace, easyHeartRate } =
    selectTrainingTrends(plan, runLogs, today);

  // Every card is a reading of actual runs, and consistency would otherwise
  // open a runner's first visit with a 0%. Nothing recorded, nothing to read.
  if (runLogs.length === 0) {
    return null;
  }

  const cards: Card[] = [];

  /**
   * The most recent week that actually has miles in it, which early on a
   * Monday is last week rather than this one. A card leading with `0 mi`
   * because the week is two days old says nothing about the training.
   */
  const latestWeek = [...weeklyMileage].reverse().find((week) => week.miles > 0);
  if (latestWeek) {
    // The current week is still filling up, so its direction is read from the
    // weeks that have finished.
    const direction = describeDirection(
      weeklyMileage
        .filter((week) => !week.isCurrentWeek)
        .map((week) => ({ date: week.startDate, value: week.miles })),
    );
    cards.push({
      key: "weekly-mileage",
      title: "Weekly mileage",
      value: `${formatMiles(latestWeek.miles)} mi`,
      note: `Week ${latestWeek.weekNumber}${latestWeek.isCurrentWeek ? " so far" : ""}${
        direction ? ` · ${DIRECTION_WORD[direction]}` : ""
      }`,
      chart:
        weeklyMileage.length > 1 ? (
          <TrendColumns
            columns={weeklyMileage.map((week) => ({
              label: String(week.weekNumber),
              value: week.miles,
              isPartial: week.isCurrentWeek,
            }))}
            formatValue={(value) => formatMiles(value)}
          />
        ) : null,
    });
  }

  const lastLongRun = longRuns[longRuns.length - 1];
  if (lastLongRun) {
    const direction = describeDirection(longRuns);
    cards.push({
      key: "long-run",
      title: "Long run",
      value: `${formatMiles(lastLongRun.value)} mi`,
      note: `${longRuns.length} recorded${direction ? ` · ${DIRECTION_WORD[direction]}` : ""}`,
      chart:
        longRuns.length > 1 ? (
          <TrendLine
            points={longRuns}
            tone="long"
            formatValue={(value) => `${formatMiles(value)} mi`}
          />
        ) : null,
    });
  }

  if (consistency.percentage !== null) {
    cards.push({
      key: "consistency",
      title: "Consistency",
      value: `${consistency.percentage}%`,
      note: `${consistency.completed} of ${consistency.due} scheduled runs`,
      chart: (
        <ProgressBar
          value={consistency.completed}
          max={consistency.due}
          label="Scheduled runs completed so far"
        />
      ),
    });
  }

  const lastPace = easyPace.points[easyPace.points.length - 1];
  if (lastPace) {
    const direction = describeDirection(easyPace.points, PHYSIOLOGICAL_SIGNIFICANCE);
    cards.push({
      key: "easy-pace",
      title: "Easy pace",
      value: pace(lastPace.value),
      note: `${easyPace.points.length} Easy ${easyPace.points.length === 1 ? "run" : "runs"}${
        direction
          ? ` · ${direction === "falling" ? "getting quicker" : direction === "rising" ? "getting slower" : "holding steady"}`
          : ""
      }`,
      chart: easyPace.hasEnoughCoverage ? (
        <TrendLine points={easyPace.points} invert formatValue={pace} />
      ) : null,
    });
  }

  const lastHeartRate = easyHeartRate.points[easyHeartRate.points.length - 1];
  if (lastHeartRate) {
    const direction = describeDirection(
      easyHeartRate.points,
      PHYSIOLOGICAL_SIGNIFICANCE,
    );
    cards.push({
      key: "easy-heart-rate",
      title: "Easy heart rate",
      value: `${Math.round(lastHeartRate.value)} bpm`,
      note: `${easyHeartRate.points.length} Easy ${easyHeartRate.points.length === 1 ? "run" : "runs"} with HR${
        direction ? ` · ${DIRECTION_WORD[direction]}` : ""
      }`,
      chart: easyHeartRate.hasEnoughCoverage ? (
        <TrendLine
          points={easyHeartRate.points}
          tone="intervals"
          formatValue={(value) => `${Math.round(value)} bpm`}
        />
      ) : null,
    });
  }

  // Nothing measured yet is not an empty strip with five dashes in it.
  if (cards.length === 0) {
    return null;
  }

  return (
    <Section
      className="trend-cards"
      icon={<TrendingUp size={15} strokeWidth={2} />}
      title="Training Trends"
    >
      {/*
        A plain overflow-scrolling list: the swipe is the browser's, so it
        keeps momentum, snapping and every assistive gesture that comes with a
        real scroll container. The cards are focusable buttons, so tabbing
        through them scrolls the strip without it needing a tab stop of its own.
      */}
      <ul className="trend-cards__track">
        {cards.map((card) => (
          <li key={card.key} className="trend-cards__item">
            <button
              type="button"
              className="trend-cards__card"
              // The drawing is aria-hidden, so the name carries the fact.
              aria-label={`${card.title}, ${card.value}, ${card.note}. Open Training Trends.`}
              onClick={onViewTrends}
            >
              <span className="trend-cards__title">{card.title}</span>
              <span className="trend-cards__value">{card.value}</span>
              {card.chart && (
                // Hidden as a whole: the charts already are, and the
                // consistency meter would otherwise announce a second value
                // from inside the button that names it.
                <span className="trend-cards__chart" aria-hidden="true">
                  {card.chart}
                </span>
              )}
              <span className="trend-cards__note">{card.note}</span>
            </button>
          </li>
        ))}
      </ul>
    </Section>
  );
}
