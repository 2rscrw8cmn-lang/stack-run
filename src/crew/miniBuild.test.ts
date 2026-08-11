import { describe, expect, it } from "vitest";
import type { CrewMember, CrewMiniBuildRun } from "./types";
import {
  deriveCrewMiniBuild,
  MINI_BUILD_RUN_LIMIT,
  orderedMiniBuildMembers,
} from "./miniBuild";

function run(
  id: string,
  localDate: string,
  distanceMiles: number,
  activityType: CrewMiniBuildRun["activityType"],
  userId = "runner-1",
): CrewMiniBuildRun {
  return { id, userId, localDate, distanceMiles, activityType };
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

  it("is deterministic regardless of query order and keeps activity semantics", () => {
    const runs = [
      run("c", "2026-08-03", 8, "long"),
      run("a", "2026-08-01", 2, "easy"),
      run("b", "2026-08-02", 5, "intervals"),
    ];
    const first = deriveCrewMiniBuild(runs, "runner-1");
    const second = deriveCrewMiniBuild([...runs].reverse(), "runner-1");

    expect(second).toEqual(first);
    expect(first.blocks.map((block) => block.activityType)).toEqual([
      "easy",
      "intervals",
      "long",
    ]);
  });

  it("uses only the newest bounded shared runs", () => {
    const runs = Array.from({ length: MINI_BUILD_RUN_LIMIT + 4 }, (_, index) =>
      run(
        `run-${String(index).padStart(2, "0")}`,
        `2026-08-${String(index + 1).padStart(2, "0")}`,
        4,
        "easy",
      ),
    );
    const model = deriveCrewMiniBuild(runs, "runner-1");

    expect(model.sourceRunCount).toBe(MINI_BUILD_RUN_LIMIT);
    expect(model.blocks).toHaveLength(MINI_BUILD_RUN_LIMIT);
    expect(model.blocks[0].id).toBe("run-04");
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
      { userId: "a", displayName: "A", role: "owner", joinedAt: "1" },
      { userId: "b", displayName: "B", role: "member", joinedAt: "2" },
      { userId: "c", displayName: "C", role: "member", joinedAt: "3" },
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
