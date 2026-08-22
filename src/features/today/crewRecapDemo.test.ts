import { describe, expect, it } from "vitest";
import {
  crewRecapDemoData,
  crewRecapDemoVariant,
  CREW_RECAP_DEMO_TODAY,
} from "./crewRecapDemo";
import { isCrewRecapCurrent, lastClosedCrewWeek } from "../../crew/weekRecap";

const PREVIEW = "stack-run-git-issue-155-owner.vercel.app";

describe("Crew Week Recap owner review", () => {
  it("is preview-host-only and never enables on a production hostname", () => {
    expect(crewRecapDemoVariant({ hostname: PREVIEW, search: "?demo=recap" })).toBe("full");
    expect(crewRecapDemoVariant({ hostname: "localhost", search: "?demo=recap" })).toBe("full");
    expect(
      crewRecapDemoVariant({ hostname: "localhost", search: "?demo=recap-minimal" }),
    ).toBe("minimal");

    expect(crewRecapDemoVariant({ hostname: "stack.run", search: "?demo=recap" })).toBeNull();
    // A production Vercel alias has no `-git-` segment.
    expect(
      crewRecapDemoVariant({ hostname: "stack-run.vercel.app", search: "?demo=recap" }),
    ).toBeNull();
    expect(crewRecapDemoVariant({ hostname: PREVIEW, search: "" })).toBeNull();
    expect(crewRecapDemoVariant({ hostname: PREVIEW, search: "?demo=today" })).toBeNull();
  });

  it("puts its own date inside the recap's real Today window", () => {
    const week = lastClosedCrewWeek(CREW_RECAP_DEMO_TODAY);
    expect(week).toEqual({ weekStart: "2026-09-07", weekEnd: "2026-09-13" });
    expect(isCrewRecapCurrent(week, CREW_RECAP_DEMO_TODAY)).toBe(true);
  });

  it("exercises every beat, and still hides an unplaced Special Block", () => {
    const demo = crewRecapDemoData("full")!;
    expect(demo.recap.beats.map((beat) => beat.kind)).toEqual([
      "participation",
      "longestRun",
      "build",
      "specialBlocks",
      "change",
    ]);

    const participation = demo.recap.beats.find((beat) => beat.kind === "participation")!;
    expect(participation).toMatchObject({ everyoneRan: true, rosterSize: 4 });

    const special = demo.recap.beats.find((beat) => beat.kind === "specialBlocks")!;
    // The fixture includes a won-but-unplaced Fastest Avg. Pace block (D-080).
    expect(special.awards.map((award) => award.awardType)).toEqual(["longHaul", "miles"]);
  });

  it("gives the sparse case a real one-beat-short recap rather than a broken full one", () => {
    const demo = crewRecapDemoData("minimal")!;
    expect(demo.recap.totals).toEqual({
      miles: 3.1,
      runs: 1,
      durationSeconds: 1755,
      activeRunners: 1,
    });
    expect(demo.recap.beats.map((beat) => beat.kind)).toEqual([
      "participation",
      "longestRun",
    ]);
  });
});
