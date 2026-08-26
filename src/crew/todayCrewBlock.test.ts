import { describe, expect, it } from "vitest";
import { readyCrewBlockForLocalRun, type CrewContributionFact } from "./todayCrewBlock.js";

const runs: CrewContributionFact[] = [
  { id: "shared-1", localRunId: "local-1", userId: "zack", crewBuildRow: null },
  { id: "shared-2", localRunId: "local-2", userId: "zack", crewBuildRow: 3 },
  { id: "shared-3", localRunId: "local-1", userId: "drew", crewBuildRow: null },
];

describe("Today's Crew block prompt", () => {
  it("returns the viewer's own unplaced contribution for that run", () => {
    expect(readyCrewBlockForLocalRun(runs, "zack", "local-1")).toBe("shared-1");
  });

  it("stays quiet once the block is standing in the shared tower", () => {
    expect(readyCrewBlockForLocalRun(runs, "zack", "local-2")).toBeNull();
  });

  it("never offers a teammate's block, even for the same local run id", () => {
    expect(readyCrewBlockForLocalRun(runs, "travis", "local-1")).toBeNull();
  });

  it("stays quiet for a run that never became a shared contribution", () => {
    expect(readyCrewBlockForLocalRun(runs, "zack", "local-9")).toBeNull();
  });

  it("stays quiet with no crew data and no signed-in runner", () => {
    expect(readyCrewBlockForLocalRun(undefined, "zack", "local-1")).toBeNull();
    expect(readyCrewBlockForLocalRun(runs, undefined, "local-1")).toBeNull();
  });
});
