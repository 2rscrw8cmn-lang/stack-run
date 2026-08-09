import { CircleCheck, Flame } from "lucide-react";
import type { BuildSummaryMetrics } from "../../domain/build";

interface BuildHeadingProps {
  metrics: BuildSummaryMetrics;
}

/**
 * What Build leads with.
 *
 * It used to be the word "Build" over a card of three equal numbers, which
 * told a runner opening the screen nothing they did not already know from the
 * tab they tapped. The miles are the number the whole tower is made of, so
 * they are the headline; runs and streak are the context beside it.
 */
export function BuildHeading({ metrics }: BuildHeadingProps) {
  return (
    <div className="build-heading">
      <h1 className="build-heading__hero">
        <span className="build-heading__value">{metrics.totalActualMiles}</span>{" "}
        <span className="build-heading__unit">
          {metrics.totalActualMiles === 1 ? "mile built" : "miles built"}
        </span>
      </h1>

      <dl className="build-heading__stats">
        <div className="build-heading__stat">
          <dt>
            <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />
            Runs Complete
          </dt>
          <dd>
            {metrics.completedRuns}
            <span className="build-heading__of"> / {metrics.plannedRuns}</span>
          </dd>
        </div>
        <div className="build-heading__stat">
          <dt>
            <Flame size={14} strokeWidth={2} aria-hidden="true" />
            Run Streak
          </dt>
          <dd>
            {metrics.currentStreak}
            <span className="build-heading__of">
              {" "}
              {metrics.currentStreak === 1 ? "day" : "days"}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  );
}
