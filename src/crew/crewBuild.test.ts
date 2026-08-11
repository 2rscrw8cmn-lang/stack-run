import { describe, expect, it } from "vitest";
import {
  CREW_BUILD_BLOCK_LIMIT,
  crewBuildContributorIds,
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
    ...values,
  };
}

/** A layout signature that ignores everything except where blocks landed. */
function layout(runs: CrewBuildRun[]): string {
  return deriveCrewBuild(runs)
    .blocks.map(
      (block) =>
        `${block.id}@${block.row}:${block.columnStart}+${block.width}x${block.height}`,
    )
    .join("|");
}

describe("Crew Build derivation", () => {
  it("turns every safe shared run into exactly one block", () => {
    const model = deriveCrewBuild([
      run("a", "zack", { createdAt: "2026-08-01T10:00:00Z" }),
      run("b", "drew", { createdAt: "2026-08-02T10:00:00Z" }),
      run("c", "zack", { createdAt: "2026-08-03T10:00:00Z" }),
    ]);

    expect(model.blocks.map((block) => block.id)).toEqual(["a", "b", "c"]);
    expect(model.blockCount).toBe(3);
    expect(new Set(model.blocks.map((block) => block.id)).size).toBe(3);
  });

  it("takes width from distance and height from activity type", () => {
    const model = deriveCrewBuild([
      run("short", "zack", { distanceMiles: 2.4, createdAt: "2026-08-01T00:00:00Z" }),
      run("mid", "zack", { distanceMiles: 4.9, createdAt: "2026-08-02T00:00:00Z" }),
      run("far", "zack", { distanceMiles: 7.9, createdAt: "2026-08-03T00:00:00Z" }),
      run("long", "zack", { distanceMiles: 8, createdAt: "2026-08-04T00:00:00Z" }),
      run("hard", "zack", {
        distanceMiles: 5,
        activityType: "intervals",
        createdAt: "2026-08-05T00:00:00Z",
      }),
      run("sim", "zack", {
        distanceMiles: 5,
        activityType: "simulation",
        createdAt: "2026-08-06T00:00:00Z",
      }),
      run("race", "zack", {
        distanceMiles: 13.1,
        activityType: "race",
        createdAt: "2026-08-07T00:00:00Z",
      }),
      run("easy-long", "zack", {
        distanceMiles: 9,
        activityType: "long",
        createdAt: "2026-08-08T00:00:00Z",
      }),
    ]);

    const byId = new Map(model.blocks.map((block) => [block.id, block] as const));
    expect(byId.get("short")!.width).toBe(1);
    expect(byId.get("mid")!.width).toBe(2);
    expect(byId.get("far")!.width).toBe(3);
    expect(byId.get("long")!.width).toBe(4);
    expect(byId.get("short")!.height).toBe(1);
    expect(byId.get("easy-long")!.height).toBe(1);
    expect(byId.get("hard")!.height).toBe(2);
    expect(byId.get("sim")!.height).toBe(2);
    expect(byId.get("race")!.height).toBe(3);
  });

  it("keeps the activity type on the block so color still means training type", () => {
    const model = deriveCrewBuild([
      run("a", "zack", { activityType: "intervals" }),
      run("b", "drew", { activityType: "long", createdAt: "2026-08-09T13:00:00Z" }),
    ]);

    expect(model.blocks.map((block) => block.activityType)).toEqual([
      "intervals",
      "long",
    ]);
    // Identity travels separately, so a member cue can never replace the color.
    expect(model.blocks.map((block) => block.userId)).toEqual(["zack", "drew"]);
  });

  it("orders contributions by createdAt then id, whatever order they arrive in", () => {
    const runs = [
      run("c", "zack", { createdAt: "2026-08-03T00:00:00Z" }),
      run("a", "drew", { createdAt: "2026-08-01T00:00:00Z" }),
      run("b2", "zack", { createdAt: "2026-08-02T00:00:00Z" }),
      // Same instant as b2: the shared-run id is the stable tie-breaker.
      run("b1", "drew", { createdAt: "2026-08-02T00:00:00Z" }),
    ];

    expect(deriveCrewBuild(runs).blocks.map((block) => block.id)).toEqual([
      "a",
      "b1",
      "b2",
      "c",
    ]);
  });

  it("produces an identical tower for the same run set in any query order", () => {
    const runs = [
      run("a", "zack", { createdAt: "2026-08-01T00:00:00Z", distanceMiles: 3.2 }),
      run("b", "drew", {
        createdAt: "2026-08-02T00:00:00Z",
        distanceMiles: 9,
        activityType: "long",
      }),
      run("c", "zack", {
        createdAt: "2026-08-03T00:00:00Z",
        distanceMiles: 5,
        activityType: "intervals",
      }),
      run("d", "drew", { createdAt: "2026-08-04T00:00:00Z", distanceMiles: 2 }),
      run("e", "zack", {
        createdAt: "2026-08-05T00:00:00Z",
        distanceMiles: 13.1,
        activityType: "race",
      }),
    ];

    const forwards = layout(runs);
    expect(layout([...runs].reverse())).toBe(forwards);
    expect(layout([runs[2], runs[0], runs[4], runs[1], runs[3]])).toBe(forwards);
  });

  it("ignores personal Member Build placement entirely", () => {
    const runs = [
      run("a", "zack", { createdAt: "2026-08-01T00:00:00Z" }),
      run("b", "drew", { createdAt: "2026-08-02T00:00:00Z" }),
    ];
    const withPersonalPlacement = runs.map((item) => ({
      ...item,
      // Fields the Member Build reads. The Crew Build must not see them, and
      // the derived model must not carry them either.
      buildRow: 9,
      buildColumnStart: 7,
    }));

    expect(layout(withPersonalPlacement as CrewBuildRun[])).toBe(layout(runs));
    for (const block of deriveCrewBuild(withPersonalPlacement as CrewBuildRun[]).blocks) {
      expect(block).not.toHaveProperty("buildRow");
      expect(block).not.toHaveProperty("buildColumnStart");
      expect(block.row).toBe(0);
    }
  });

  it("grows the tower when a later run is shared, without disturbing what is under it", () => {
    const existing = [
      run("a", "zack", { createdAt: "2026-08-01T00:00:00Z" }),
      run("b", "drew", { createdAt: "2026-08-02T00:00:00Z" }),
    ];
    const before = deriveCrewBuild(existing);
    const after = deriveCrewBuild([
      ...existing,
      run("c", "zack", { createdAt: "2026-08-03T00:00:00Z", distanceMiles: 6 }),
    ]);

    expect(after.blockCount).toBe(3);
    expect(after.blocks.slice(0, 2)).toEqual(before.blocks);
    expect(after.courses).toBeGreaterThanOrEqual(before.courses);
  });

  it("recomputes deterministically when a departed member's runs disappear", () => {
    const all = [
      run("a", "zack", { createdAt: "2026-08-01T00:00:00Z" }),
      run("b", "drew", { createdAt: "2026-08-02T00:00:00Z" }),
      run("c", "zack", { createdAt: "2026-08-03T00:00:00Z" }),
    ];
    const remaining = all.filter((item) => item.userId !== "drew");

    expect(layout(remaining)).toBe(layout([...remaining].reverse()));
    expect(deriveCrewBuild(remaining).blocks.map((block) => block.id)).toEqual([
      "a",
      "c",
    ]);
    expect(deriveCrewBuild(remaining).milesBuilt).toBeCloseTo(8, 5);
  });

  it("totals miles, blocks and contributing runners from the tower itself", () => {
    const model = deriveCrewBuild([
      run("a", "zack", { distanceMiles: 6.1, createdAt: "2026-08-01T00:00:00Z" }),
      run("b", "drew", { distanceMiles: 3.25, createdAt: "2026-08-02T00:00:00Z" }),
      run("c", "zack", { distanceMiles: 4, createdAt: "2026-08-03T00:00:00Z" }),
    ]);

    expect(model.milesBuilt).toBeCloseTo(13.35, 5);
    expect(model.blockCount).toBe(3);
    expect(crewBuildContributorIds(model)).toEqual(["zack", "drew"]);
    expect(model.courses).toBeGreaterThan(0);
  });

  it("is empty, honest and untruncated with no shared runs", () => {
    const model = deriveCrewBuild([]);
    expect(model.blocks).toEqual([]);
    expect(model.milesBuilt).toBe(0);
    expect(model.blockCount).toBe(0);
    expect(model.courses).toBe(0);
    expect(model.truncated).toBe(false);
  });

  it("builds a one-member crew's tower from that runner's runs alone", () => {
    const model = deriveCrewBuild([
      run("a", "zack", { createdAt: "2026-08-01T00:00:00Z" }),
      run("b", "zack", { createdAt: "2026-08-02T00:00:00Z" }),
    ]);
    expect(model.blockCount).toBe(2);
    expect(crewBuildContributorIds(model)).toEqual(["zack"]);
  });

  it("says so rather than quietly shortening the tower at the safety ceiling", () => {
    const runs = Array.from({ length: 5 }, (_, index) =>
      run(`run-${index}`, "zack", {
        createdAt: `2026-08-0${index + 1}T00:00:00Z`,
      }),
    );

    const bounded = deriveCrewBuild(runs, 3);
    expect(bounded.blockCount).toBe(3);
    expect(bounded.truncated).toBe(true);
    // The oldest contributions are kept, so the tower still reads bottom-up.
    expect(bounded.blocks.map((block) => block.id)).toEqual([
      "run-0",
      "run-1",
      "run-2",
    ]);
    expect(deriveCrewBuild(runs).truncated).toBe(false);
    expect(CREW_BUILD_BLOCK_LIMIT).toBeGreaterThan(runs.length);
  });

  it("carries no private field into the derived model", () => {
    const model = deriveCrewBuild([
      run("a", "zack", { createdAt: "2026-08-01T00:00:00Z" }),
    ]);

    expect(Object.keys(model.blocks[0]).sort()).toEqual([
      "activityType",
      "columnStart",
      "displayName",
      "distanceMiles",
      "height",
      "id",
      "localDate",
      "row",
      "userId",
      "width",
    ]);
  });

  it("never lets a block leave the eight-column grid", () => {
    const runs = Array.from({ length: 40 }, (_, index) =>
      run(`run-${index}`, index % 2 === 0 ? "zack" : "drew", {
        createdAt: `2026-08-${String((index % 28) + 1).padStart(2, "0")}T00:00:00Z`,
        distanceMiles: 1 + (index % 9),
        activityType: (["easy", "intervals", "long", "simulation", "race"] as const)[
          index % 5
        ],
      }),
    );

    for (const block of deriveCrewBuild(runs).blocks) {
      expect(block.columnStart).toBeGreaterThanOrEqual(1);
      expect(block.columnStart + block.width - 1).toBeLessThanOrEqual(8);
      expect(block.row).toBeGreaterThanOrEqual(0);
    }
  });
});
