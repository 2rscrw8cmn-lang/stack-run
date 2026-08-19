import { describe, expect, it } from "vitest";
import { GRID_COLUMNS } from "../domain/placement";
import {
  canPlaceCrewBuildBlock,
  CREW_BUILD_COLUMNS,
  crewBuildBlocksOverlap,
  crewBuildContributorIds,
  crewBuildFootprint,
  crewBuildLandingOptions,
  crewBuildPlacementOptions,
  deriveCrewBuild,
  isRecentCrewBuildPlacement,
} from "./crewBuild";
import type { CrewBuildRun } from "./types";

function run(
  id: string,
  userId: string,
  values: Partial<CrewBuildRun> = {},
): CrewBuildRun {
  return {
    id,
    userId,
    displayName: userId === "zack" ? "Zack" : "Drew",
    accentColor: null,
    localDate: "2026-08-09",
    activityType: "easy",
    distanceMiles: 4,
    durationSeconds: 2400,
    createdAt: "2026-08-09T12:00:00Z",
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildPlacedAt: null,
    ...values,
  };
}

describe("collaborative Crew Build", () => {
  it("uses stored Crew coordinates and never auto-places an unplaced run", () => {
    const model = deriveCrewBuild([
      run("placed", "zack", { crewBuildRow: 0, crewBuildColumnStart: 4 }),
      run("ready", "drew", { localDate: "2026-08-10" }),
    ]);

    expect(model.blocks).toHaveLength(1);
    expect(model.blocks[0]).toMatchObject({ id: "placed", row: 0, columnStart: 4 });
    expect(model.readyRuns.map((item) => item.id)).toEqual(["ready"]);
    expect(model.readyRuns[0]).not.toHaveProperty("row");
    expect(model.readyRuns[0]).not.toHaveProperty("columnStart");
    expect(model.placedCount).toBe(1);
    expect(model.readyCount).toBe(1);
  });

  it("keeps personal Member Build coordinates completely independent", () => {
    const shared = run("a", "zack", { crewBuildRow: 0, crewBuildColumnStart: 3 });
    const withPersonalPlacement = {
      ...shared,
      buildRow: 99,
      buildColumnStart: 8,
    } as CrewBuildRun;

    expect(deriveCrewBuild([withPersonalPlacement]).blocks[0]).toMatchObject({
      row: 0,
      columnStart: 3,
    });
    expect(deriveCrewBuild([withPersonalPlacement]).blocks[0]).not.toHaveProperty("buildRow");
  });

  it("orders READY contributions by local date, createdAt, then id", () => {
    const model = deriveCrewBuild([
      run("c", "zack", { localDate: "2026-08-11", createdAt: "2026-08-01T00:00:00Z" }),
      run("b", "zack", { localDate: "2026-08-10", createdAt: "2026-08-02T00:00:00Z" }),
      run("a", "zack", { localDate: "2026-08-10", createdAt: "2026-08-02T00:00:00Z" }),
      run("first", "zack", { localDate: "2026-08-10", createdAt: "2026-08-01T00:00:00Z" }),
    ]);
    expect(model.readyRuns.map((item) => item.id)).toEqual(["first", "a", "b", "c"]);
  });

  it("keeps width and height mappings identical to personal STACK", () => {
    const model = deriveCrewBuild([
      run("short", "zack", { distanceMiles: 2.9 }),
      run("mid", "zack", { distanceMiles: 3 }),
      run("far", "zack", { distanceMiles: 5 }),
      run("eight", "zack", { distanceMiles: 8 }),
      run("intervals", "zack", { activityType: "intervals" }),
      run("simulation", "zack", { activityType: "simulation" }),
      run("long", "zack", { activityType: "long" }),
      run("race", "zack", { activityType: "race" }),
    ]);
    const byId = new Map(model.readyRuns.map((item) => [item.id, item] as const));
    expect(["short", "mid", "far", "eight"].map((id) => byId.get(id)?.width)).toEqual([1, 2, 3, 4]);
    expect(["short", "long", "intervals", "simulation", "race"].map((id) => byId.get(id)?.height)).toEqual([1, 1, 2, 2, 3]);
  });

  it("counts only physically placed miles in the Crew Build hero", () => {
    const model = deriveCrewBuild([
      run("placed", "zack", {
        distanceMiles: 8,
        crewBuildRow: 0,
        crewBuildColumnStart: 1,
      }),
      run("ready", "drew", { distanceMiles: 5.5 }),
    ]);
    expect(model.placedMiles).toBe(8);
    expect(model.runCount).toBe(2);
    expect(model.placedCount).toBe(1);
    expect(model.readyCount).toBe(1);
    expect(crewBuildContributorIds(model)).toEqual(["zack"]);
  });

  it("excludes READY contributions from Miles Built", () => {
    const model = deriveCrewBuild([
      run("placed-three", "zack", {
        distanceMiles: 3,
        crewBuildRow: 0,
        crewBuildColumnStart: 1,
      }),
      run("ready-five", "zack", { distanceMiles: 5 }),
      run("placed-two", "drew", {
        distanceMiles: 2,
        crewBuildRow: 0,
        crewBuildColumnStart: 3,
      }),
    ]);

    expect(model.placedMiles).toBe(5);
    expect(model.readyRuns.map((item) => item.id)).toEqual(["ready-five"]);
  });

  it("marks placements from the last 24 hours as recent without animation", () => {
    const now = Date.parse("2026-08-12T12:00:00Z");
    expect(isRecentCrewBuildPlacement("2026-08-12T12:00:00Z", now)).toBe(true);
    expect(isRecentCrewBuildPlacement("2026-08-11T12:00:01Z", now)).toBe(true);
    expect(isRecentCrewBuildPlacement("2026-08-11T11:59:59Z", now)).toBe(false);
    expect(isRecentCrewBuildPlacement(null, now)).toBe(false);
  });

  it("mirrors rectangular collision geometry on the client", () => {
    const placed = deriveCrewBuild([
      run("base", "drew", {
        distanceMiles: 5,
        activityType: "intervals",
        crewBuildRow: 0,
        crewBuildColumnStart: 2,
      }),
    ]).blocks;
    const moving = run("moving", "zack", { distanceMiles: 3, activityType: "long" });

    expect(canPlaceCrewBuildBlock(moving, { row: 1, columnStart: 1 }, placed)).toBe(false);
    expect(canPlaceCrewBuildBlock(moving, { row: 2, columnStart: 2 }, placed)).toBe(true);
    expect(canPlaceCrewBuildBlock(moving, { row: 0, columnStart: 8 }, placed)).toBe(false);
    expect(canPlaceCrewBuildBlock(moving, { row: -1, columnStart: 1 }, placed)).toBe(false);
  });

  it("allows moving a block against its own old footprint but not a teammate", () => {
    const runs = [
      run("mine", "zack", { crewBuildRow: 0, crewBuildColumnStart: 1 }),
      run("theirs", "drew", { crewBuildRow: 0, crewBuildColumnStart: 3 }),
    ];
    const model = deriveCrewBuild(runs);
    expect(canPlaceCrewBuildBlock(runs[0], { row: 0, columnStart: 1 }, model.blocks)).toBe(true);
    expect(canPlaceCrewBuildBlock(runs[0], { row: 0, columnStart: 3 }, model.blocks)).toBe(false);

    expect(canPlaceCrewBuildBlock(runs[0], { row: 1, columnStart: 3 }, model.blocks)).toBe(true);
  });

  it("matches Personal Build support semantics, including supported bridges", () => {
    const baseRun = run("base", "drew", {
      distanceMiles: 3,
      crewBuildRow: 0,
      crewBuildColumnStart: 1,
    });
    const base = deriveCrewBuild([baseRun]).blocks;
    const bridge = run("bridge", "zack", { distanceMiles: 8 });

    expect(canPlaceCrewBuildBlock(bridge, { row: 0, columnStart: 3 }, base)).toBe(true);
    expect(canPlaceCrewBuildBlock(bridge, { row: 1, columnStart: 1 }, base)).toBe(true);
    expect(canPlaceCrewBuildBlock(bridge, { row: 2, columnStart: 1 }, base)).toBe(false);
  });

  it("allows a support-preserving move and rejects moving a support away", () => {
    const runs = [
      run("base", "drew", {
        distanceMiles: 3,
        crewBuildRow: 0,
        crewBuildColumnStart: 1,
      }),
      run("bridge", "zack", {
        distanceMiles: 8,
        crewBuildRow: 1,
        crewBuildColumnStart: 1,
      }),
      run("top", "drew", {
        distanceMiles: 3,
        crewBuildRow: 2,
        crewBuildColumnStart: 2,
      }),
    ];
    const blocks = deriveCrewBuild(runs).blocks;
    expect(canPlaceCrewBuildBlock(runs[1], { row: 1, columnStart: 2 }, blocks)).toBe(true);
    expect(canPlaceCrewBuildBlock(runs[1], { row: 0, columnStart: 5 }, blocks)).toBe(false);
  });

  it("offers only snapped, in-grid, collision-free client positions", () => {
    const base = deriveCrewBuild([
      run("base", "drew", { crewBuildRow: 0, crewBuildColumnStart: 1 }),
    ]);
    const moving = run("moving", "zack", { distanceMiles: 8 });
    const options = crewBuildPlacementOptions(moving, base.blocks, 2);
    expect(options).not.toContainEqual({ row: 0, columnStart: 1 });
    expect(options).toContainEqual({ row: 1, columnStart: 1 });
    expect(options.every((option) => option.columnStart <= 5)).toBe(true);
  });

  it("treats conflicting persisted coordinates defensively as READY", () => {
    const model = deriveCrewBuild([
      run("first", "zack", {
        createdAt: "2026-08-08T12:00:00Z",
        crewBuildRow: 0,
        crewBuildColumnStart: 1,
      }),
      run("conflict", "drew", {
        createdAt: "2026-08-09T12:00:00Z",
        crewBuildRow: 0,
        crewBuildColumnStart: 2,
      }),
    ]);
    expect(model.blocks.map((block) => block.id)).toEqual(["first"]);
    expect(model.readyRuns.map((item) => item.id)).toEqual(["conflict"]);
  });

  it("treats structurally unsupported persisted coordinates defensively as READY", () => {
    const model = deriveCrewBuild([
      run("floating", "zack", {
        crewBuildRow: 2,
        crewBuildColumnStart: 1,
      }),
    ]);
    expect(model.blocks).toEqual([]);
    expect(model.readyRuns.map((item) => item.id)).toEqual(["floating"]);
  });

  it("uses half-open footprint overlap at touching edges", () => {
    expect(crewBuildBlocksOverlap(
      { row: 0, columnStart: 1, width: 2, height: 1 },
      { row: 0, columnStart: 3, width: 2, height: 1 },
    )).toBe(false);
    expect(crewBuildBlocksOverlap(
      { row: 0, columnStart: 1, width: 2, height: 2 },
      { row: 1, columnStart: 2, width: 1, height: 1 },
    )).toBe(true);
  });
});

describe("shared geometry reuse (issue #65)", () => {
  it("stacks on the exact same eight-column grid Personal Build uses", () => {
    expect(CREW_BUILD_COLUMNS).toBe(GRID_COLUMNS);
  });

  it("computes neighbour-aware top/right face visibility for connected blocks, like Personal Build", () => {
    // A wide block resting across two narrower ones: the narrow blocks' top
    // faces are covered where the wide one rests on them, and the interior
    // right face between them is covered too — Personal Build's exact rule.
    const model = deriveCrewBuild([
      run("left", "zack", { distanceMiles: 2.9, crewBuildRow: 0, crewBuildColumnStart: 1 }),
      run("right", "drew", { distanceMiles: 2.9, crewBuildRow: 0, crewBuildColumnStart: 2 }),
      run("bridge", "zack", { distanceMiles: 5, crewBuildRow: 1, crewBuildColumnStart: 1 }),
    ]);
    const byId = new Map(model.blocks.map((block) => [block.id, block] as const));

    expect(byId.get("left")?.topFace).toEqual([false]);
    expect(byId.get("right")?.topFace).toEqual([false]);
    // "bridge" is 5mi -> 3 columns wide, one flag per column it spans.
    expect(byId.get("bridge")?.topFace).toEqual([true, true, true]);
    // The two ground blocks abut each other, so neither draws a right face
    // where they touch.
    expect(byId.get("left")?.rightFace).toEqual([false]);
  });

  it("reports a void under a block that bridges an opening, like Personal Build", () => {
    const model = deriveCrewBuild([
      run("support", "zack", { distanceMiles: 2.9, crewBuildRow: 0, crewBuildColumnStart: 1 }),
      run("bridge", "drew", { distanceMiles: 5, crewBuildRow: 1, crewBuildColumnStart: 1 }),
    ]);
    // "bridge" is 3 wide (5mi -> width 3) sitting on "support" (1 wide);
    // columns 2-3 at row 0 are open ground under the bridge.
    expect(model.voids).toContainEqual({ row: 0, column: 2 });
    expect(model.voids).toContainEqual({ row: 0, column: 3 });
    expect(model.voids).not.toContainEqual({ row: 0, column: 1 });
  });

  it("paints later courses over earlier ones via depth, like Personal Build", () => {
    const model = deriveCrewBuild([
      run("ground", "zack", { crewBuildRow: 0, crewBuildColumnStart: 1 }),
      run("upper", "drew", { crewBuildRow: 1, crewBuildColumnStart: 1 }),
    ]);
    const byId = new Map(model.blocks.map((block) => [block.id, block] as const));
    expect(byId.get("upper")!.depth).toBeGreaterThan(byId.get("ground")!.depth);
  });

  it("offers one gravity-computed landing per column, exactly like Personal Build's placementOptions", () => {
    const base = deriveCrewBuild([
      run("base", "drew", { distanceMiles: 2.9, crewBuildRow: 0, crewBuildColumnStart: 1 }),
    ]);
    const moving = run("moving", "zack", { distanceMiles: 2.9 });
    const options = crewBuildLandingOptions(moving, base.blocks);

    // One landing per column a 1-wide block fits in, never a floating row.
    expect(options).toHaveLength(8);
    // Column 1 is occupied at row 0, so a new block there rests on top of it.
    expect(options[0]).toMatchObject({ row: 1, columnStart: 1 });
    // Every other column is still open ground.
    expect(options[1]).toMatchObject({ row: 0, columnStart: 2 });
  });

  it("never offers a landing that fails Crew's own support/collision validation", () => {
    const model = deriveCrewBuild([
      run("a", "zack", { distanceMiles: 8, crewBuildRow: 0, crewBuildColumnStart: 1 }),
      run("b", "drew", { distanceMiles: 2.9, crewBuildRow: 1, crewBuildColumnStart: 1 }),
    ]);
    const moving = run("moving", "travis", { distanceMiles: 5 });
    const options = crewBuildLandingOptions(moving, model.blocks);

    for (const option of options) {
      expect(canPlaceCrewBuildBlock(moving, option, model.blocks)).toBe(true);
    }
  });
});

describe("crewBuildFootprint", () => {
  it("grows a Cross Training block's height with duration, capped at 2", () => {
    const short = run("short", "zack", { activityType: "cross", durationSeconds: 20 * 60 });
    const long = run("long", "zack", { activityType: "cross", durationSeconds: 45 * 60 });

    expect(crewBuildFootprint(short).height).toBe(1);
    expect(crewBuildFootprint(long).height).toBe(2);
  });

  it("leaves every other activity type's fixed height alone", () => {
    expect(crewBuildFootprint(run("a", "zack", { activityType: "intervals" })).height).toBe(2);
    expect(crewBuildFootprint(run("a", "zack", { activityType: "race" })).height).toBe(3);
  });
});
