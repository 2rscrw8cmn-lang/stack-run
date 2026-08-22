import { describe, expect, it } from "vitest";
import type { CrewAwardBlockRecord } from "./awards";
import type { CrewMember, CrewSharedRun, CrewWeekRecapRun } from "./types";
import {
  crewWeekRecap,
  crewWeekRecapRunsFrom,
  isCrewRecapCurrent,
  lastClosedCrewWeek,
  type CrewWeekRecapBeat,
} from "./weekRecap";

const ICON = { head: 0, face: 0, body: 0, flair: 0, background: 0 };

/** The closed week every test below tells the story of. */
const WEEK = { weekStart: "2026-08-10", weekEnd: "2026-08-16" };

function member(userId: string, displayName = userId): CrewMember {
  return {
    userId,
    role: userId === "zack" ? "owner" : "member",
    joinedAt: "2026-06-01T00:00:00Z",
    displayName,
    accentColor: null,
    runnerIcon: ICON,
  };
}

function run(
  id: string,
  userId: string,
  localDate: string,
  overrides: Partial<CrewWeekRecapRun> = {},
): CrewWeekRecapRun {
  return {
    id,
    userId,
    displayName: userId === "zack" ? "Zack" : "Drew",
    accentColor: null,
    runnerIcon: ICON,
    localDate,
    activityType: "easy",
    distanceMiles: 3,
    durationSeconds: 1800,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    ...overrides,
  };
}

function award(overrides: Partial<CrewAwardBlockRecord> = {}): CrewAwardBlockRecord {
  return {
    id: "award-1",
    crewId: "crew-1",
    weekStart: WEEK.weekStart,
    awardType: "miles",
    winnerUserId: "drew",
    resultValue: 21.4,
    sourceSharedRunId: null,
    crewBuildRow: 3,
    crewBuildColumnStart: 1,
    crewBuildPlacedAt: "2026-08-18T10:00:00Z",
    createdAt: "2026-08-17T00:00:00Z",
    ...overrides,
  };
}

function recapOf(
  runs: CrewWeekRecapRun[],
  overrides: {
    members?: CrewMember[];
    awards?: CrewAwardBlockRecord[];
    buildStartDate?: string;
  } = {},
) {
  return crewWeekRecap({
    crewId: "crew-1",
    crewName: "Night Shift",
    buildStartDate: overrides.buildStartDate ?? "2026-06-01",
    members: overrides.members ?? [member("zack", "Zack"), member("drew", "Drew")],
    runs,
    awards: overrides.awards,
    week: WEEK,
  });
}

function beat<K extends CrewWeekRecapBeat["kind"]>(
  beats: readonly CrewWeekRecapBeat[],
  kind: K,
): Extract<CrewWeekRecapBeat, { kind: K }> | undefined {
  return beats.find((item) => item.kind === kind) as
    | Extract<CrewWeekRecapBeat, { kind: K }>
    | undefined;
}

describe("crew recap week window", () => {
  it("recaps the Monday–Sunday week that has closed, not the one being run", () => {
    expect(lastClosedCrewWeek("2026-08-17")).toEqual(WEEK);
    expect(lastClosedCrewWeek("2026-08-19")).toEqual(WEEK);
    expect(lastClosedCrewWeek("2026-08-16")).toEqual({
      weekStart: "2026-08-03",
      weekEnd: "2026-08-09",
    });
  });

  it("is a limited-time module: Monday through Wednesday, then it ages out", () => {
    expect(isCrewRecapCurrent(WEEK, "2026-08-16")).toBe(false);
    expect(isCrewRecapCurrent(WEEK, "2026-08-17")).toBe(true);
    expect(isCrewRecapCurrent(WEEK, "2026-08-19")).toBe(true);
    expect(isCrewRecapCurrent(WEEK, "2026-08-20")).toBe(false);
  });
});

describe("crew week recap", () => {
  it("tells the whole story from one closed week of shared runs", () => {
    const recap = recapOf([
      run("a", "zack", "2026-08-10", { distanceMiles: 5, durationSeconds: 2700 }),
      run("b", "drew", "2026-08-12", {
        distanceMiles: 12,
        durationSeconds: 7200,
        activityType: "long",
        crewBuildRow: 4,
        crewBuildColumnStart: 1,
      }),
      run("c", "zack", "2026-08-15", { distanceMiles: 4, durationSeconds: 2100 }),
      // Last week, for the change beat.
      run("prev", "zack", "2026-08-05", { distanceMiles: 10, durationSeconds: 3600 }),
      // Outside the week entirely.
      run("next", "drew", "2026-08-17", { distanceMiles: 99 }),
    ]);

    expect(recap).not.toBeNull();
    expect(recap!.totals).toEqual({
      miles: 21,
      runs: 3,
      durationSeconds: 12000,
      activeRunners: 2,
    });
    expect(recap!.beats.map((item) => item.kind)).toEqual([
      "participation",
      "longestRun",
      "build",
      "change",
    ]);

    expect(beat(recap!.beats, "participation")).toMatchObject({
      everyoneRan: true,
      activeRunners: 2,
      rosterSize: 2,
    });
    expect(beat(recap!.beats, "longestRun")).toMatchObject({
      runId: "b",
      distanceMiles: 12,
      activityType: "long",
    });
    expect(beat(recap!.beats, "build")).toMatchObject({
      blocksPlaced: 1,
      milesPlaced: 12,
      courses: 1,
    });
    expect(beat(recap!.beats, "change")).toEqual({
      kind: "change",
      previousMiles: 10,
      deltaMiles: 11,
    });
  });

  it("is deterministic: the same week produces the same recap for both members", () => {
    const runs = [
      run("a", "zack", "2026-08-10", { crewBuildRow: 2, crewBuildColumnStart: 3 }),
      run("b", "drew", "2026-08-11", { distanceMiles: 8, crewBuildRow: 3, crewBuildColumnStart: 1 }),
      run("c", "drew", "2026-08-13", { distanceMiles: 2 }),
    ];
    const first = recapOf(runs);
    // The same facts arriving in a different read order.
    const second = recapOf([runs[2], runs[0], runs[1]]);
    expect(second).toEqual(first);
  });

  it("returns nothing for a week with no shared running, rather than a recap of zero", () => {
    expect(recapOf([run("a", "zack", "2026-08-04")])).toBeNull();
  });

  it("still produces a truthful minimal recap from a single run", () => {
    const recap = recapOf([run("a", "zack", "2026-08-12", { distanceMiles: 3.1 })]);
    expect(recap!.totals).toEqual({
      miles: 3.1,
      runs: 1,
      durationSeconds: 1800,
      activeRunners: 1,
    });
    // One runner out of two is honest participation; nothing else has evidence.
    expect(recap!.beats.map((item) => item.kind)).toEqual([
      "participation",
      "longestRun",
    ]);
    expect(beat(recap!.beats, "participation")).toMatchObject({
      everyoneRan: false,
      activeRunners: 1,
      rosterSize: 2,
    });
  });

  it("never claims everyone ran when part of the roster sat the week out", () => {
    const recap = recapOf([run("a", "zack", "2026-08-12")], {
      members: [member("zack"), member("drew"), member("sam")],
    });
    expect(beat(recap!.beats, "participation")).toMatchObject({
      everyoneRan: false,
      activeRunners: 1,
      rosterSize: 3,
    });
  });

  it("omits the longest run rather than choosing between a tie", () => {
    const recap = recapOf([
      run("a", "zack", "2026-08-12", { distanceMiles: 6 }),
      run("b", "drew", "2026-08-13", { distanceMiles: 6 }),
    ]);
    expect(beat(recap!.beats, "longestRun")).toBeUndefined();
  });

  it("counts a week's block by the run's own date, and rebases the slice on its lowest course", () => {
    const recap = recapOf([
      run("a", "zack", "2026-08-10", { crewBuildRow: 40, crewBuildColumnStart: 1 }),
      run("b", "drew", "2026-08-11", { crewBuildRow: 41, crewBuildColumnStart: 3 }),
      // Placed in the tower, but run before this week: not this week's growth.
      run("old", "drew", "2026-08-03", { crewBuildRow: 39, crewBuildColumnStart: 1 }),
    ]);
    const build = beat(recap!.beats, "build")!;
    expect(build.blocksPlaced).toBe(2);
    expect(build.courses).toBe(2);
    expect(
      build.slice.map((block) => [block.id, block.row, block.columnStart, block.height]),
    ).toEqual([
      ["a", 0, 1, 1],
      ["b", 1, 3, 1],
    ]);
  });

  it("draws the slice with the tower's own footprints, not flat one-course bricks", () => {
    const recap = recapOf([
      run("intervals", "zack", "2026-08-12", {
        activityType: "intervals",
        distanceMiles: 6,
        crewBuildRow: 0,
        crewBuildColumnStart: 1,
      }),
    ]);
    const build = beat(recap!.beats, "build")!;
    expect(build.slice[0]).toMatchObject({ width: 3, height: 2 });
    expect(build.courses).toBe(2);
  });

  it("omits the build beat when this week's blocks are all still unplaced", () => {
    const recap = recapOf([run("a", "zack", "2026-08-12")]);
    expect(beat(recap!.beats, "build")).toBeUndefined();
  });

  it("reports only Special Blocks already standing in the Crew Build", () => {
    const recap = recapOf([run("a", "zack", "2026-08-12")], {
      awards: [
        award({ id: "placed", awardType: "miles" }),
        // Won, not yet placed: D-080 keeps that the winner's own prompt.
        award({ id: "ready", awardType: "runs", crewBuildRow: null, crewBuildColumnStart: null }),
        // A different week's block.
        award({ id: "other-week", weekStart: "2026-08-03" }),
      ],
    });
    const special = beat(recap!.beats, "specialBlocks")!;
    expect(special.awards.map((item) => item.id)).toEqual(["placed"]);
    expect(special.awards[0]).toMatchObject({ awardType: "miles", resultValue: 21.4 });
    expect(special.awards[0].winner?.displayName).toBe("Drew");
  });

  it("omits week-over-week when the previous week predates the Crew's Build window", () => {
    const recap = recapOf(
      [
        run("a", "zack", "2026-08-12"),
        run("prev", "zack", "2026-08-05", { distanceMiles: 9 }),
      ],
      { buildStartDate: "2026-08-08" },
    );
    expect(beat(recap!.beats, "change")).toBeUndefined();
  });

  it("omits week-over-week when the previous week has no running to compare against", () => {
    const recap = recapOf([run("a", "zack", "2026-08-12")]);
    expect(beat(recap!.beats, "change")).toBeUndefined();
  });

  it("has nothing to say about a week that closed before the Crew's Build start", () => {
    expect(
      recapOf([run("a", "zack", "2026-08-12")], { buildStartDate: "2026-09-01" }),
    ).toBeNull();
  });
});

describe("crewWeekRecapRunsFrom", () => {
  it("drops every shared-run field a weekly story has no business telling", () => {
    const shared: CrewSharedRun = {
      id: "run-1",
      localRunId: "local-1",
      userId: "zack",
      displayName: "Zack",
      accentColor: "sky",
      runnerIcon: ICON,
      localDate: "2026-08-12",
      activityType: "easy",
      distanceMiles: 4,
      durationSeconds: 2000,
      source: "intervals",
      createdAt: "2026-08-12T12:00:00Z",
      updatedAt: "2026-08-12T12:00:00Z",
      buildRow: 2,
      buildColumnStart: 4,
      buildWidth: 2,
      buildHeight: 1,
      crewBuildRow: 5,
      crewBuildColumnStart: 2,
      crewBuildPlacedAt: "2026-08-13T09:00:00Z",
      averageHeartRate: 148,
      maxHeartRate: 176,
      manualHeartRate: 150,
      propsCount: 3,
      viewerHasPropped: true,
    };

    expect(crewWeekRecapRunsFrom([shared])).toEqual([
      {
        id: "run-1",
        userId: "zack",
        displayName: "Zack",
        accentColor: "sky",
        runnerIcon: ICON,
        localDate: "2026-08-12",
        activityType: "easy",
        distanceMiles: 4,
        durationSeconds: 2000,
        source: "intervals",
        crewBuildRow: 5,
        crewBuildColumnStart: 2,
      },
    ]);
  });
});
