import { describe, expect, it } from "vitest";
import {
  canPlaceCrewAwardBlock,
  crewAwardLandingOptions,
  deriveCrewBuildWithAwards,
} from "./crewBuild";
import type { CrewAwardBlockRecord } from "./awards";
import type { CrewBuildRun } from "./types";

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
    crewBuildPlacedAt: null,
    createdAt: "2026-08-10T01:00:00Z",
    ...values,
  };
}

describe("Crew Special Blocks in the shared tower", () => {
  it("occupies real tower cells while adding zero miles", () => {
    const model = deriveCrewBuildWithAwards(
      [run("run", { distanceMiles: 5, crewBuildRow: 0, crewBuildColumnStart: 1 })],
      [award("award", { crewBuildRow: 0, crewBuildColumnStart: 4 })],
      "runner-b",
    );

    expect(model.blocks.map((block) => block.kind)).toEqual(["run", "award"]);
    expect(model.placedMiles).toBe(5);
    expect(model.placedCount).toBe(1);
    expect(model.placedAwardCount).toBe(1);
  });

  it("lets an award support a later run", () => {
    const model = deriveCrewBuildWithAwards(
      [run("upper", { crewBuildRow: 1, crewBuildColumnStart: 2 })],
      [award("base", { crewBuildRow: 0, crewBuildColumnStart: 1 })],
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

  it("computes the lowest valid award options against both award and run rectangles", () => {
    const model = deriveCrewBuildWithAwards(
      [run("base", { crewBuildRow: 0, crewBuildColumnStart: 1 })],
      [award("other", { crewBuildRow: 0, crewBuildColumnStart: 3 })],
    );
    const moving = award("moving", { awardType: "miles" });
    const options = crewAwardLandingOptions(moving, model.blocks);

    expect(options).toHaveLength(7);
    expect(options.find((option) => option.columnStart === 1)?.row).toBe(1);
    expect(options.find((option) => option.columnStart === 7)?.row).toBe(0);
  });

  it("lets a Special Block fill the lowest valid cavity beneath a wider Special Block", () => {
    const model = deriveCrewBuildWithAwards(
      [
        run("left-support", {
          distanceMiles: 2.9,
          activityType: "intervals",
          crewBuildRow: 0,
          crewBuildColumnStart: 1,
        }),
        run("cavity-support", {
          distanceMiles: 3,
          crewBuildRow: 0,
          crewBuildColumnStart: 2,
        }),
      ],
      [award("bridge", {
        awardType: "longHaul",
        crewBuildRow: 2,
        crewBuildColumnStart: 1,
      })],
    );
    const moving = award("moving", { awardType: "miles" });
    const option = crewAwardLandingOptions(moving, model.blocks)
      .find((candidate) => candidate.columnStart === 2);

    expect(option).toMatchObject({ row: 1, columnStart: 2, columnEnd: 3 });
    expect(canPlaceCrewAwardBlock(moving, option!, model.blocks)).toBe(true);
  });
});
