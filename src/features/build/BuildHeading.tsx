import type { BuildSummaryMetrics } from "../../domain/build";

interface BuildHeadingProps {
  metrics: BuildSummaryMetrics;
}

/**
 * What Build leads with: one number, and then the tower.
 *
 * It used to be the word "Build" over a card of three equal figures, and then
 * — after UI-7 — the miles with Runs Complete and Run Streak beside them. Both
 * versions made the screen open on statistics. D-045 settles it: the miles are
 * what the tower is made of and are the only accumulated fact here; the runs
 * and the streak are Today's, Plan's and Trends' to report, and nothing takes
 * their place. Everything below this line is the object itself.
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
    </div>
  );
}
