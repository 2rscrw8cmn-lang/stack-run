import { describe, expect, it } from "vitest";
import { crewBuildTotals } from "./crewTotals";
import type { CrewBuildRun } from "./types";

function run(overrides: Partial<CrewBuildRun> = {}): CrewBuildRun {
  return {
    id: "run-1",
    userId: "zack",
    displayName: "Zack",
    accentColor: null,
    localDate: "2026-08-20",
    activityType: "easy",
    distanceMiles: 4,
    durationSeconds: 2352,
    source: "intervals",
    createdAt: "2026-08-20T12:00:00Z",
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildPlacedAt: null,
    ...overrides,
  };
}

describe("Crew Build totals (issue #137)", () => {
  it("reports nothing for a crew that has not run", () => {
    expect(crewBuildTotals([])).toEqual({
      miles: 0,
      runs: 0,
      durationSeconds: 0,
      contributors: 0,
    });
  });

  it("adds up the crew's miles, runs and time", () => {
    const totals = crewBuildTotals([
      run({ id: "a", distanceMiles: 4, durationSeconds: 2352 }),
      run({ id: "b", userId: "drew", distanceMiles: 8.1, durationSeconds: 4200 }),
      run({ id: "c", userId: "travis", distanceMiles: 5, durationSeconds: 1800 }),
    ]);

    expect(totals.miles).toBeCloseTo(17.1, 5);
    expect(totals.runs).toBe(3);
    expect(totals.durationSeconds).toBe(8352);
  });

  /*
   * The figure is contributors, not roster size: a crew of seven where three
   * have run reads 3, because that is what the tower above it is made of.
   */
  it("counts each contributing runner once, however many runs they logged", () => {
    const totals = crewBuildTotals([
      run({ id: "a", userId: "zack" }),
      run({ id: "b", userId: "zack" }),
      run({ id: "c", userId: "drew" }),
    ]);

    expect(totals.runs).toBe(3);
    expect(totals.contributors).toBe(2);
  });

  /*
   * The totals describe the crew's running, not the tower's masonry. A run
   * that is earned but not yet placed still counts — otherwise the stats row
   * would disagree with the recent-activity feed on the same screen.
   */
  it("counts a run that has not been placed in the tower yet", () => {
    const totals = crewBuildTotals([
      run({ id: "placed", crewBuildRow: 0, crewBuildColumnStart: 1 }),
      run({ id: "ready", userId: "drew", distanceMiles: 6 }),
    ]);

    expect(totals.miles).toBe(10);
    expect(totals.runs).toBe(2);
    expect(totals.contributors).toBe(2);
  });

  /* Cross Training records no distance (D-077) but is still a run and still time. */
  it("keeps a zero-distance Cross Training session in the run and time counts", () => {
    const totals = crewBuildTotals([
      run({ id: "cross", activityType: "cross", distanceMiles: 0, durationSeconds: 1800 }),
    ]);

    expect(totals.miles).toBe(0);
    expect(totals.runs).toBe(1);
    expect(totals.durationSeconds).toBe(1800);
  });
});
