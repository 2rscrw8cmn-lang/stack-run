import { describe, expect, it } from "vitest";
import {
  canPlaceCrewAwardBlock,
  crewAwardLandingOptions,
  deriveCrewBuildWithAwards,
} from "./crewBuild.js";
import type { CrewAwardBlockRecord } from "./awards.js";
import type { CrewBuildRun } from "./types.js";

function run(id: string, values: Partial<CrewBuildRun> = {}): CrewBuildRun {
  return {
    id,
    userId: "runner-a",
    displayName: "Runner A",
    accentColor: null,
    localDate: "2026-08-10",
    activityType: "easy",
    distanceMiles: 3,
    durationSeconds: 2400,
    createdAt: "2026-08-10T12:00:00Z",
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildRotated: false,
    crewBuildPlacedAt: null,
    ...values,
  };
}

function award(id: string, values: Partial<CrewAwardBlockRecord> = {}): CrewAwardBlockRecord {
  return {
    id,
    crewId: "crew-1",
    weekStart: "2026-08-03",
    awardType: "zone2",
    winnerUserId: "runner-b",
    resultValue: 92,
    sourceSharedRunId: null,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildRotated: false,
    crewBuildPlacedAt: null,
    createdAt: "2026-08-10T01:00:00Z",
    ...values,
  };
}

describe("Crew Special Blocks in the shared tower", () => {
  it("occupies exactly one square tower unit while adding zero miles", () => {
    const model = deriveCrewBuildWithAwards(
      [run("run", { distanceMiles: 5, crewBuildRow: 0, crewBuildColumnStart: 1 })],
      [award("award", { crewBuildRow: 0, crewBuildColumnStart: 7 })],
      "runner-b",
    );

    expect(model.blocks.map((block) => block.kind)).toEqual(["run", "award"]);
    const awardBlock = model.blocks.find((block) => block.kind === "award");
    expect(awardBlock).toMatchObject({ width: 1, height: 1, rotated: false });
    expect(model.placedMiles).toBe(5);
    expect(model.placedCount).toBe(1);
    expect(model.placedAwardCount).toBe(1);
  });

  it("lets a one-unit award support a later run through real overlap", () => {
    const model = deriveCrewBuildWithAwards(
      [run("upper", { crewBuildRow: 1, crewBuildColumnStart: 3 })],
      [award("base", { crewBuildRow: 0, crewBuildColumnStart: 3 })],
    );

    expect(model.blocks.map((block) => `${block.kind}:${block.id}`)).toEqual([
      "run:upper",
      "award:base",
    ]);
    expect(model.readyRuns).toEqual([]);
  });

  it("lets a run support an award and exposes it only to the winner as READY", () => {
    const model = deriveCrewBuildWithAwards(
      [run("base", { crewBuildRow: 0, crewBuildColumnStart: 1 })],
      [
        award("placed", { crewBuildRow: 1, crewBuildColumnStart: 1 }),
        award("ready", { winnerUserId: "runner-b" }),
        award("other", { winnerUserId: "runner-c" }),
      ],
      "runner-b",
    );

    expect(model.blocks.some((block) => block.kind === "award" && block.id === "placed")).toBe(true);
    expect(model.viewerReadyAwards.map((item) => item.id)).toEqual(["ready"]);
    expect(model.readyAwardCount).toBe(2);
  });

  it("offers all sixteen unit anchors for a one-unit award", () => {
    const model = deriveCrewBuildWithAwards(
      [run("base", { crewBuildRow: 0, crewBuildColumnStart: 1 })],
      [award("other", { crewBuildRow: 0, crewBuildColumnStart: 5 })],
    );
    const moving = award("moving", { awardType: "miles" });
    const options = crewAwardLandingOptions(moving, model.blocks);

    expect(options).toHaveLength(16);
    expect(options.find((option) => option.columnStart === 1)?.row).toBe(1);
    expect(options.find((option) => option.columnStart === 5)?.row).toBe(1);
    expect(options.find((option) => option.columnStart === 16)?.row).toBe(0);
  });

  it("uses a one-cell collision/support footprint at placement time", () => {
    const model = deriveCrewBuildWithAwards(
      [run("base", { crewBuildRow: 0, crewBuildColumnStart: 3 })],
      [],
    );
    const moving = award("moving", { awardType: "miles" });
    const option = crewAwardLandingOptions(moving, model.blocks)
      .find((candidate) => candidate.columnStart === 3);

    expect(option).toMatchObject({ row: 1, columnStart: 3, columnEnd: 3 });
    expect(canPlaceCrewAwardBlock(moving, option!, model.blocks)).toBe(true);
  });
});
