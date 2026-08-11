import { describe, expect, it } from "vitest";
import {
  canPlaceCrewBuildBlock,
  crewBuildBlocksOverlap,
  crewBuildContributorIds,
  crewBuildPlacementOptions,
  deriveCrewBuild,
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
    localDate: "2026-08-09",
    activityType: "easy",
    distanceMiles: 4,
    createdAt: "2026-08-09T12:00:00Z",
    crewBuildRow: null,
    crewBuildColumnStart: null,
    ...values,
  };
}

describe("collaborative Crew Build", () => {
  it("uses stored Crew coordinates and never auto-places an unplaced run", () => {
    const model = deriveCrewBuild([
      run("placed", "zack", { crewBuildRow: 3, crewBuildColumnStart: 4 }),
      run("ready", "drew", { localDate: "2026-08-10" }),
    ]);

    expect(model.blocks).toHaveLength(1);
    expect(model.blocks[0]).toMatchObject({ id: "placed", row: 3, columnStart: 4 });
    expect(model.readyRuns.map((item) => item.id)).toEqual(["ready"]);
    expect(model.readyRuns[0]).not.toHaveProperty("row");
    expect(model.readyRuns[0]).not.toHaveProperty("columnStart");
    expect(model.placedCount).toBe(1);
    expect(model.readyCount).toBe(1);
  });

  it("keeps personal Member Build coordinates completely independent", () => {
    const shared = run("a", "zack", { crewBuildRow: 2, crewBuildColumnStart: 3 });
    const withPersonalPlacement = {
      ...shared,
      buildRow: 99,
      buildColumnStart: 8,
    } as CrewBuildRun;

    expect(deriveCrewBuild([withPersonalPlacement]).blocks[0]).toMatchObject({
      row: 2,
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

  it("counts all shared miles and runs while only stored blocks occupy the tower", () => {
    const model = deriveCrewBuild([
      run("placed", "zack", {
        distanceMiles: 8,
        crewBuildRow: 0,
        crewBuildColumnStart: 1,
      }),
      run("ready", "drew", { distanceMiles: 5.5 }),
    ]);
    expect(model.milesBuilt).toBe(13.5);
    expect(model.runCount).toBe(2);
    expect(model.placedCount).toBe(1);
    expect(model.readyCount).toBe(1);
    expect(crewBuildContributorIds(model)).toEqual(["zack"]);
  });

  it("mirrors rectangular collision geometry on the client", () => {
    const placed = deriveCrewBuild([
      run("base", "drew", {
        distanceMiles: 5,
        activityType: "intervals",
        crewBuildRow: 1,
        crewBuildColumnStart: 2,
      }),
    ]).blocks;
    const moving = run("moving", "zack", { distanceMiles: 3, activityType: "long" });

    expect(canPlaceCrewBuildBlock(moving, { row: 1, columnStart: 1 }, placed)).toBe(false);
    expect(canPlaceCrewBuildBlock(moving, { row: 3, columnStart: 2 }, placed)).toBe(true);
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

    const moved = deriveCrewBuild([{ ...runs[0], crewBuildRow: 2, crewBuildColumnStart: 5 }, runs[1]]);
    expect(moved.blocks.find((block) => block.id === "mine")).toMatchObject({ row: 2, columnStart: 5 });
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
