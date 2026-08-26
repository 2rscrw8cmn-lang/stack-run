import { describe, expect, it } from "vitest";
import { emptyRejectionCounts, normalizeHistoricalActivities } from "./historicalActivity.js";
import {
  formatHistoricalCoverage,
  summarizeHistoricalCoverage,
} from "./historicalCoverage.js";
import { fixtureActivities, fixtureRide } from "./historicalFixtures.js";

const seenAt = "2026-08-15T12:00:00.000Z";

function fixtureHistory(runs: number) {
  return normalizeHistoricalActivities(
    [...fixtureActivities({ newest: "2026-08-15", runs, everyDays: 3 }), fixtureRide("2026-08-14")],
    { seenAt },
  );
}

describe("historical coverage", () => {
  it("reports the dataset a later phase would be reasoning over", () => {
    const { activities } = fixtureHistory(12);
    const summary = summarizeHistoricalCoverage(activities);

    expect(summary.total).toBe(12);
    expect(summary.latestDate).toBe("2026-08-15");
    expect(summary.earliestDate).toBe("2026-07-13");
    expect(summary.activeDays).toBe(12);
    expect(summary.sourceTypes).toEqual(["Run"]);
    expect(summary.totalMiles).toBeCloseTo(
      activities.reduce((total, activity) => total + activity.distanceMeters, 0) / 1609.344,
      6,
    );
  });

  it("counts each optional metric separately, because coverage is per field", () => {
    // The fixture gives every run a heart rate, every third run zones, every
    // second a training load and every fourth a cadence. A phase that wants an
    // HR-zone trend can see it has a third of the runs to work with.
    const { activities } = fixtureHistory(12);
    const byField = Object.fromEntries(
      summarizeHistoricalCoverage(activities).fields.map((field) => [field.field, field.present]),
    );

    expect(byField.averageHeartRate).toBe(12);
    expect(byField.hrZoneSeconds).toBe(4);
    expect(byField.trainingLoad).toBe(6);
    expect(byField.averageCadence).toBe(3);
    expect(byField.elevationGainMeters).toBe(12);
  });

  it("says zero coverage rather than dividing by no activities", () => {
    const summary = summarizeHistoricalCoverage([]);
    expect(summary.total).toBe(0);
    expect(summary.earliestDate).toBeNull();
    expect(summary.fields.every((field) => field.ratio === 0)).toBe(true);
    expect(formatHistoricalCoverage(summary)).toContain("activities: 0");
  });

  /**
   * The fixture summary itself. Printed here so the phase's engineering claim —
   * which optional metrics are actually populated — is readable from test
   * output rather than only from a type definition.
   */
  it("formats a summary that is safe to paste anywhere", () => {
    const { activities, rejected } = fixtureHistory(12);
    const report = formatHistoricalCoverage(summarizeHistoricalCoverage(activities), rejected);

    expect(report).toContain("activities: 12");
    expect(report).toContain("range: 2026-07-13 → 2026-08-15");
    expect(report).toContain("hrZoneSeconds: 4/12 (33%)");
    expect(report).toContain("rejected source rows: not-running=1");

    // Aggregates only: no activity name, id, start time or credential.
    for (const identifying of ["fixture-1", "Fixture run", "T06:", "key"]) {
      expect(report).not.toContain(identifying);
    }
  });

  it("says so plainly when nothing was rejected", () => {
    expect(formatHistoricalCoverage(summarizeHistoricalCoverage([]), emptyRejectionCounts()))
      .toContain("rejected source rows: none");
  });
});
