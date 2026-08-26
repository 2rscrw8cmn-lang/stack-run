import { formatMiles } from "../../domain/distance.js";
import type { TodayContextReading } from "./todayModel.js";

interface TodayContextProps {
  readings: TodayContextReading[];
}

/**
 * Where this runner's training currently stands, in two or three facts.
 *
 * Not a dashboard and not a smaller Runner Snapshot. Its whole job is to stop
 * Today from being a screen about one day: a runner who has just been told their
 * plan says Rest should still be able to see, without leaving Home, roughly how
 * much they have been running lately.
 *
 * Every value carries its own window, because a mileage figure without one is
 * not a fact. Which readings appear — and which are suppressed because the
 * observation below already states them — is decided in `todayModel.ts`; this
 * renders the list it is handed and formats it.
 *
 * It is deliberately not a link. Runs is the place to inspect, and a tappable
 * strip here would invite a detour out of the screen that is meant to answer
 * what matters now.
 */
export function TodayContext({ readings }: TodayContextProps) {
  if (readings.length === 0) return null;

  return (
    <dl
      className="today-context"
      role="group"
      aria-label="Recent training"
      data-readings={readings.length}
    >
      {readings.map((reading) => (
        <div key={reading.key} className="today-context__reading" data-reading={reading.key}>
          <dd className="today-context__value data-value">
            {displayValue(reading)}
            <span className="today-context__unit">{UNIT[reading.key]}</span>
          </dd>
          <dt className="today-context__label machine-label">{reading.label}</dt>
        </div>
      ))}
    </dl>
  );
}

const UNIT: Record<TodayContextReading["key"], string> = {
  "last-28": "mi",
  frequency: "/wk",
  longest: "mi",
};

/** Miles read as miles do everywhere else; a rate keeps its one decimal. */
function displayValue(reading: TodayContextReading): string {
  return reading.key === "frequency"
    ? reading.value.toFixed(1)
    : formatMiles(reading.value);
}
