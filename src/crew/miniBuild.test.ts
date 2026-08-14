import { describe, expect, it } from "vitest";
import type { CrewMember, CrewMiniBuildRun } from "./types";
import {
  deriveCrewMiniBuild,
  faceCulledMiniBuildTower,
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
    expect(model).toEqual({ blocks: [], courses: 0, sourceRunCount: 0, totalMiles: 0 });
  });

  it("returns an honest zero-run state and never invents blocks", () => {
    expect(deriveCrewMiniBuild([], "runner-1")).toEqual({
      blocks: [],
      courses: 0,
      sourceRunCount: 0,
      totalMiles: 0,
    });
  });

  it("totals mileage from the exact displayed blocks, including runs from before Crew Build start", () => {
    // deriveCrewMiniBuild has no notion of a Crew Build start date at all: it
    // sums whatever sanitized Personal Build blocks it is given, whether they
    // predate the Crew or not, so the tower and the printed total can never
    // disagree.
    const runs = [
      run("before-crew-start", "2026-06-01", 3.2, "easy", "runner-1", 0, 1),
      run("after-crew-start", "2026-08-05", 6.1, "long", "runner-1", 1, 1),
    ];
    const model = deriveCrewMiniBuild(runs, "runner-1");

    expect(model.totalMiles).toBeCloseTo(9.3, 5);
    expect(model.blocks).toHaveLength(2);
  });

  it("shows zero total miles for an empty Member Build", () => {
    expect(deriveCrewMiniBuild([], "runner-1").totalMiles).toBe(0);
  });

  it("puts the current runner first without ranking the rest by miles", () => {
    const members: CrewMember[] = [
      { userId: "a", displayName: "A", role: "owner", joinedAt: "1", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, extra: 0 } },
      { userId: "b", displayName: "B", role: "member", joinedAt: "2", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, extra: 0 } },
      { userId: "c", displayName: "C", role: "member", joinedAt: "3", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, extra: 0 } },
    ];
    expect(orderedMiniBuildMembers(members, "c").map((member) => member.userId)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("culls faces between adjoining blocks the same way Personal/Crew Build do", () => {
    // Two width-1 blocks side by side on the ground, one stacked on top of
    // the left one: the shared edges must not draw, exactly like a real
    // tower's neighbour-aware faces.
    const model = deriveCrewMiniBuild(
      [
        run("left", "2026-08-01", 2, "easy", "runner-1", 0, 1),
        run("right", "2026-08-01", 2, "easy", "runner-1", 0, 2),
        run("stacked", "2026-08-01", 2, "easy", "runner-1", 1, 1),
      ],
      "runner-1",
    );
    const tower = faceCulledMiniBuildTower(model);
    const left = tower.blocks.find((block) => block.id === "left")!;
    const right = tower.blocks.find((block) => block.id === "right")!;
    const stacked = tower.blocks.find((block) => block.id === "stacked")!;

    // The left block's top is covered by "stacked" and its right edge abuts
    // "right", so neither face should draw.
    expect(left.topFace).toEqual([false]);
    expect(left.rightFace).toEqual([false]);
    // "right" has open sky above and open air to its right (column 3 empty).
    expect(right.topFace).toEqual([true]);
    expect(right.rightFace).toEqual([true]);
    // "stacked" sits on top with nothing above or beside it.
    expect(stacked.topFace).toEqual([true]);
    expect(stacked.rightFace).toEqual([true]);
    expect(tower.courses).toBe(model.courses);
    expect(tower.voids).toEqual([]);
  });

  it("reports a void where the skyline has grown past an empty cell", () => {
    const model = deriveCrewMiniBuild(
      [
        run("tall", "2026-08-01", 8, "long", "runner-1", 0, 5),
        run("bridge", "2026-08-02", 8, "long", "runner-1", 1, 1),
      ],
      "runner-1",
    );
    const tower = faceCulledMiniBuildTower(model);
    expect(tower.voids.length).toBeGreaterThan(0);
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
