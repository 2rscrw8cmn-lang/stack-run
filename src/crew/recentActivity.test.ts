import { describe, expect, it } from "vitest";
import type { CrewSharedRun } from "./types";
import { selectRecentCrewActivity } from "./recentActivity";

function run(id: string, userId: string, localDate: string): CrewSharedRun {
  return {
    id,
    localRunId: `local-${id}`,
    userId,
    displayName: userId,
    accentColor: null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    localDate,
    activityType: "easy",
    distanceMiles: 3.2,
    durationSeconds: 1800,
    createdAt: `${localDate}T12:00:00Z`,
    updatedAt: `${localDate}T12:00:00Z`,
    buildRow: null,
    buildColumnStart: null,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
  };
}

describe("Today Crew Activity", () => {
  it("shows at most two teammate runs from today and yesterday", () => {
    const selected = selectRecentCrewActivity([
      run("self", "zack", "2026-08-12"),
      run("today", "drew", "2026-08-12"),
      run("yesterday", "drew", "2026-08-11"),
      run("old", "drew", "2026-08-09"),
    ], "zack", "2026-08-12");
    expect(selected.map((item) => item.id)).toEqual(["today", "yesterday"]);
  });
});
