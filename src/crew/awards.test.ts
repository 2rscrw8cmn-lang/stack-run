import { describe, expect, it } from "vitest";
import {
  crewFeatureAwardForWeek,
  deriveCrewAwardWeek,
  type CrewAwardMetricRun,
} from "./awards";

function metricRun(id: string, values: Partial<CrewAwardMetricRun> = {}): CrewAwardMetricRun {
  return {
    id,
    userId: "a",
    localDate: "2026-08-10",
    activityType: "easy",
    distanceMiles: 3,
    durationSeconds: 1800,
    createdAt: "2026-08-10T12:00:00Z",
    zone2Percent: null,
    targetPercent: null,
    levelUpPercent: null,
    steadySeconds: null,
    ...values,
  };
}

describe("Crew weekly awards", () => {
  it("rotates the Feature block every week from the build-start week", () => {
    expect(crewFeatureAwardForWeek("2026-08-04", "2026-08-03")).toBe("longHaul");
    expect(crewFeatureAwardForWeek("2026-08-04", "2026-08-10")).toBe("steady");
    expect(crewFeatureAwardForWeek("2026-08-04", "2026-08-17")).toBe("onTarget");
    expect(crewFeatureAwardForWeek("2026-08-04", "2026-08-24")).toBe("levelUp");
    expect(crewFeatureAwardForWeek("2026-08-04", "2026-08-31")).toBe("longHaul");
  });

  it("publishes the four standard leaders plus the current Feature leader", () => {
    const week = deriveCrewAwardWeek([
      metricRun("a1", { userId: "a", distanceMiles: 4, durationSeconds: 2000, zone2Percent: 91, targetPercent: 100 }),
      metricRun("a2", { userId: "a", distanceMiles: 5, durationSeconds: 2500 }),
      metricRun("b1", { userId: "b", distanceMiles: 8, durationSeconds: 3600, zone2Percent: 94, targetPercent: 98 }),
      metricRun("b2", { userId: "b", distanceMiles: 2, durationSeconds: 900 }),
    ], "2026-08-03", "2026-08-10");

    expect(week.featureType).toBe("steady");
    expect(week.leaders.find((item) => item.awardType === "miles")?.userId).toBe("b");
    expect(week.leaders.find((item) => item.awardType === "zone2")?.userId).toBe("b");
    expect(week.leaders.find((item) => item.awardType === "pace")?.userId).toBe("b");
    expect(week.leaders.find((item) => item.awardType === "runs")?.userId).toBe("b");
    // Steady is intentionally absent until a verified within-run variability
    // metric exists; the UI shows "No qualifier yet" rather than inventing it.
    expect(week.leaders.some((item) => item.awardType === "steady")).toBe(false);
  });
});
