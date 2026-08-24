import { describe, expect, it } from "vitest";
import { crewBuildTotals } from "./crewTotals";
import type { CrewBuildBlock } from "./crewBuild";
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

/** A placed run block, reduced to the two fields the totals actually read. */
function placed(id: string): CrewBuildBlock {
  return { kind: "run", id } as CrewBuildBlock;
}

/** A placed Special Block, which is masonry but is not a run. */
function placedAward(id: string): CrewBuildBlock {
  return { kind: "award", id } as CrewBuildBlock;
}

describe("Crew Build totals (issue #137)", () => {
  it("reports nothing for a crew that has not run", () => {
    expect(crewBuildTotals([], [], 0)).toEqual({
      miles: 0,
      runs: 0,
      durationSeconds: 0,
      runners: 0,
    });
  });

  it("adds up the miles, runs and time the crew has built", () => {
    const runs = [
      run({ id: "a", distanceMiles: 4, durationSeconds: 2352 }),
      run({ id: "b", userId: "drew", distanceMiles: 8.1, durationSeconds: 4200 }),
      run({ id: "c", userId: "travis", distanceMiles: 5, durationSeconds: 1800 }),
    ];
    const totals = crewBuildTotals(runs, [placed("a"), placed("b"), placed("c")], 3);

    expect(totals.miles).toBeCloseTo(17.1, 5);
    expect(totals.runs).toBe(3);
    expect(totals.durationSeconds).toBe(8352);
  });

  /*
   * The row sits directly above the tower and describes it. A run that is
   * earned but not yet placed is owed to the crew, not built by it — it shows
   * up in Recent Crew Runs and in the runner's READY prompt instead.
   */
  it("leaves a run that has not been placed in the tower out of every figure", () => {
    const runs = [
      run({ id: "placed", distanceMiles: 4, durationSeconds: 2352 }),
      run({ id: "ready", userId: "drew", distanceMiles: 6, durationSeconds: 3000 }),
    ];
    const totals = crewBuildTotals(runs, [placed("placed")], 2);

    expect(totals.miles).toBe(4);
    expect(totals.runs).toBe(1);
    expect(totals.durationSeconds).toBe(2352);
  });

  /* Special Blocks are masonry too, but they are awards, not miles. */
  it("does not let a placed Special Block add to the run or mile counts", () => {
    const totals = crewBuildTotals(
      [run({ id: "a", distanceMiles: 4 })],
      [placed("a"), placedAward("award-1")],
      2,
    );

    expect(totals.runs).toBe(1);
    expect(totals.miles).toBe(4);
  });

  /*
   * Runners is the roster, not the contributors: a crew of seven where three
   * have run reads 7. It says who is in this crew, rather than restating the
   * activity the other three figures already carry.
   */
  it("counts every crew member, including those who have not built yet", () => {
    const totals = crewBuildTotals(
      [run({ id: "a", userId: "zack" }), run({ id: "b", userId: "zack" })],
      [placed("a"), placed("b")],
      7,
    );

    expect(totals.runs).toBe(2);
    expect(totals.runners).toBe(7);
  });

  it("still reports the roster for a crew whose tower is empty", () => {
    expect(crewBuildTotals([run({ id: "ready" })], [], 4).runners).toBe(4);
  });

  /* Cross Training records no distance (D-077) but is still a run and still time. */
  it("keeps a zero-distance Cross Training session in the run and time counts", () => {
    const totals = crewBuildTotals(
      [run({ id: "cross", activityType: "cross", distanceMiles: 0, durationSeconds: 1800 })],
      [placed("cross")],
      1,
    );

    expect(totals.miles).toBe(0);
    expect(totals.runs).toBe(1);
    expect(totals.durationSeconds).toBe(1800);
  });
});
