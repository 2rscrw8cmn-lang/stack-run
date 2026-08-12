import { describe, expect, it } from "vitest";
import type { CrewMember, CrewMiniBuildRun } from "./types";
import {
  deriveCrewMiniBuild,
  MEMBER_BUILD_BLOCK_LIMIT,
  orderedMiniBuildMembers,
} from "./miniBuild";

function run(
  id: string,
  localDate: string,
  distanceMiles: number,
  activityType: CrewMiniBuildRun["activityType"],
  userId = "runner-1",
  buildRow: number | null = 0,
  buildColumnStart: number | null = 1,
): CrewMiniBuildRun {
  return {
    id,
    userId,
    localDate,
    distanceMiles,
    activityType,
    buildRow,
    buildColumnStart,
  };
}

describe("Crew Mini Build derivation", () => {
  it.each([
    [2.99, 1],
    [3, 2],
    [4.99, 2],
    [5, 3],
    [7.99, 3],
    [8, 4],
  ])("maps %s miles to width %s", (miles, width) => {
    expect(deriveCrewMiniBuild([run("r", "2026-08-01", miles, "easy")], "runner-1").blocks[0].width)
      .toBe(width);
  });

  it.each([
    ["easy", 1],
    ["long", 1],
    ["intervals", 2],
    ["simulation", 2],
    ["race", 3],
  ] as const)("maps %s to height %s", (activityType, height) => {
    expect(deriveCrewMiniBuild([run("r", "2026-08-01", 4, activityType)], "runner-1").blocks[0].height)
      .toBe(height);
  });

  it("uses supplied coordinates regardless of query order and keeps activity semantics", () => {
    const runs = [
      run("c", "2026-08-03", 8, "long", "runner-1", 3, 5),
      run("a", "2026-08-01", 2, "easy", "runner-1", 0, 1),
      run("b", "2026-08-02", 5, "intervals", "runner-1", 1, 2),
    ];
    const first = deriveCrewMiniBuild(runs, "runner-1");
    const second = deriveCrewMiniBuild([...runs].reverse(), "runner-1");

    expect(second).toEqual(first);
    expect(first.blocks.map((block) => block.activityType)).toEqual([
      "easy",
      "intervals",
      "long",
    ]);
    expect(first.blocks.map(({ row, columnStart }) => ({ row, columnStart }))).toEqual([
      { row: 0, columnStart: 1 },
      { row: 1, columnStart: 2 },
      { row: 3, columnStart: 5 },
    ]);
  });

  it("keeps a full normal-cycle Build within a generous safety ceiling", () => {
    const runs = Array.from({ length: 80 }, (_, index) =>
      run(
        `run-${String(index).padStart(2, "0")}`,
        "2026-08-01",
        4,
        "easy",
        "runner-1",
        Math.floor(index / 4),
        (index % 4) * 2 + 1,
      ),
    );
    const model = deriveCrewMiniBuild(runs, "runner-1");

    expect(MEMBER_BUILD_BLOCK_LIMIT).toBeGreaterThanOrEqual(80);
    expect(model.sourceRunCount).toBe(80);
    expect(model.blocks).toHaveLength(80);
  });

  it("changes placement without auto-arranging the supplied Build", () => {
    const first = deriveCrewMiniBuild(
      [run("r", "2026-08-01", 4, "easy", "runner-1", 0, 1)],
      "runner-1",
    );
    const moved = deriveCrewMiniBuild(
      [run("r", "2026-08-01", 4, "easy", "runner-1", 7, 6)],
      "runner-1",
    );
    expect(first.blocks[0]).toMatchObject({ row: 0, columnStart: 1 });
    expect(moved.blocks[0]).toMatchObject({ row: 7, columnStart: 6 });
  });

  it("does not invent a position for a legacy unplaced shared run", () => {
    const model = deriveCrewMiniBuild(
      [run("unplaced", "2026-08-01", 4, "easy", "runner-1", null, null)],
      "runner-1",
    );
    expect(model).toEqual({ blocks: [], courses: 0, sourceRunCount: 0 });
  });

  it("returns an honest zero-run state and never invents blocks", () => {
    expect(deriveCrewMiniBuild([], "runner-1")).toEqual({
      blocks: [],
      courses: 0,
      sourceRunCount: 0,
    });
  });

  it("puts the current runner first without ranking the rest by miles", () => {
    const members: CrewMember[] = [
      { userId: "a", displayName: "A", role: "owner", joinedAt: "1", accentColor: null },
      { userId: "b", displayName: "B", role: "member", joinedAt: "2", accentColor: null },
      { userId: "c", displayName: "C", role: "member", joinedAt: "3", accentColor: null },
    ];
    expect(orderedMiniBuildMembers(members, "c").map((member) => member.userId)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("cannot carry private RunLog or personal placement fields into its output", () => {
    const unsafeInput = {
      ...run("safe-id", "2026-08-01", 5, "simulation"),
      averageHeartRate: 155,
      trainingLoad: 72,
      notes: "private",
      effort: "great",
      blockPlacements: [{ columnStart: 8, row: 99 }],
    };
    const serialized = JSON.stringify(deriveCrewMiniBuild([unsafeInput], "runner-1"));

    expect(serialized).not.toMatch(/heart|load|notes|effort|blockPlacements|private|99/i);
  });
});
