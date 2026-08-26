import { VERIFIED_RUNNING_TYPES } from "../connected/intervals.js";
import { historicalDistanceMiles } from "./historicalMeasures.js";
import type { HistoricalActivity, HistoricalRejection } from "./historicalActivity.js";

/**
 * What the historical dataset actually contains, for engineering.
 *
 * Every later STACK Next phase has to answer the same question before it can
 * promise a trend: *is this metric actually populated on this runner's runs?*
 * `docs/INTERVALS_DATA_STRATEGY.md` makes coverage a rule rather than a
 * courtesy — HR-zone summaries disclose or omit weak coverage, an easy-pace
 * trend needs four comparable runs — and none of that is answerable from a
 * type definition, because an optional field is optional in the source too.
 *
 * This is a summary, not a screen. It counts, it names no activity, and it
 * carries no run name, date-time, id or credential, so a coverage report is
 * safe to print in test output or paste into a phase document.
 */

export interface HistoricalFieldCoverage {
  field: string;
  present: number;
  total: number;
  /** 0–1. Zero activities is zero coverage rather than a divide by zero. */
  ratio: number;
}

export interface HistoricalCoverageSummary {
  total: number;
  earliestDate: string | null;
  latestDate: string | null;
  /** Distinct calendar days with at least one activity. */
  activeDays: number;
  totalMiles: number;
  sourceTypes: string[];
  fields: HistoricalFieldCoverage[];
}

/** The optional Tier 1 metrics whose presence a later phase has to check. */
const OPTIONAL_FIELDS: { field: string; present: (activity: HistoricalActivity) => boolean }[] = [
  { field: "name", present: (a) => a.name !== null },
  { field: "startTimeLocal", present: (a) => a.startTimeLocal !== null },
  { field: "movingTimeSeconds", present: (a) => a.movingTimeSeconds !== null },
  { field: "elapsedTimeSeconds", present: (a) => a.elapsedTimeSeconds !== null },
  { field: "averageHeartRate", present: (a) => a.averageHeartRate !== null },
  { field: "maxHeartRate", present: (a) => a.maxHeartRate !== null },
  { field: "hrZoneSeconds", present: (a) => a.hrZoneSeconds !== null },
  { field: "elevationGainMeters", present: (a) => a.elevationGainMeters !== null },
  { field: "averageCadence", present: (a) => a.averageCadence !== null },
  { field: "trainingLoad", present: (a) => a.trainingLoad !== null },
  { field: "sourceUpdatedAt", present: (a) => a.sourceUpdatedAt !== null },
];

export function summarizeHistoricalCoverage(
  activities: readonly HistoricalActivity[],
): HistoricalCoverageSummary {
  const dates = activities.map((activity) => activity.startDateLocal).sort();
  return {
    total: activities.length,
    earliestDate: dates[0] ?? null,
    latestDate: dates[dates.length - 1] ?? null,
    activeDays: new Set(dates).size,
    totalMiles: activities
      .filter((activity) => VERIFIED_RUNNING_TYPES.has(activity.sourceType))
      .reduce((total, activity) => total + historicalDistanceMiles(activity), 0),
    sourceTypes: [...new Set(activities.map((activity) => activity.sourceType))].sort(),
    fields: OPTIONAL_FIELDS.map(({ field, present }) => {
      const count = activities.filter(present).length;
      return {
        field,
        present: count,
        total: activities.length,
        ratio: activities.length === 0 ? 0 : count / activities.length,
      };
    }),
  };
}

function percent(ratio: number): string {
  return `${Math.round(ratio * 100)}%`;
}

/**
 * The coverage summary as plain text, for test output and the development
 * diagnostic. Aggregates only — nothing here identifies a single activity.
 */
export function formatHistoricalCoverage(
  summary: HistoricalCoverageSummary,
  rejected?: Record<HistoricalRejection, number>,
): string {
  const lines = [
    `activities: ${summary.total}`,
    `range: ${summary.earliestDate ?? "—"} → ${summary.latestDate ?? "—"}`,
    `active days: ${summary.activeDays}`,
    `total miles: ${summary.totalMiles.toFixed(1)}`,
    `source types: ${summary.sourceTypes.join(", ") || "—"}`,
    "optional field coverage:",
    ...summary.fields.map(
      (field) => `  ${field.field}: ${field.present}/${field.total} (${percent(field.ratio)})`,
    ),
  ];
  if (rejected) {
    const reasons = Object.entries(rejected).filter(([, count]) => count > 0);
    lines.push(
      `rejected source rows: ${reasons.length === 0 ? "none" : reasons.map(([reason, count]) => `${reason}=${count}`).join(", ")}`,
    );
  }
  return lines.join("\n");
}
