import { describe, expect, it } from "vitest";
import type { CrewAwardBlockRecord } from "./awards.js";
import type { CrewMember, CrewSharedRun, CrewWeekRecapRun } from "./types.js";
import {
  crewWeekRecap,
  crewWeekRecapRunsFrom,
  isCrewRecapCurrent,
  lastClosedCrewWeek,
  type CrewWeekRecapBeat,
} from "./weekRecap.js";

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
      "performances",
      "build",
      "change",
    ]);

    expect(beat(recap!.beats, "participation")).toMatchObject({
      everyoneRan: true,
      activeRunners: 2,
      rosterSize: 2,
    });
    expect(
      beat(recap!.beats, "performances")!.items.find((item) => item.kind === "longestRun"),
    ).toMatchObject({ kind: "longestRun", runId: "b", value: 12, activityType: "long" });
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
      "performances",
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

  it("omits a performance rather than choosing between a tie", () => {
    const recap = recapOf([
      run("a", "zack", "2026-08-12", { distanceMiles: 6, durationSeconds: 3000 }),
      run("b", "drew", "2026-08-13", { distanceMiles: 6, durationSeconds: 3000 }),
    ]);
    // Distance, pace, weekly totals and the two days all tie, so there is
    // nothing the week can honestly single out.
    expect(beat(recap!.beats, "performances")).toBeUndefined();
  });

  it("shows every qualifying performance instead of stopping at four", () => {
    const recap = recapOf([
      run("long", "drew", "2026-08-12", { distanceMiles: 12, durationSeconds: 6600, activityType: "long" }),
      // Fastest qualifying pace: 7:30 /mi. Also the week's fastest verified 5K.
      run("quick", "zack", "2026-08-13", {
        distanceMiles: 4,
        durationSeconds: 1800,
        best5kSeconds: 1290,
      }),
      run("slow", "zack", "2026-08-13", { distanceMiles: 3, durationSeconds: 1900 }),
      run("third", "drew", "2026-08-13", { distanceMiles: 2.5, durationSeconds: 1500 }),
    ]);
    const items = beat(recap!.beats, "performances")!.items;

    expect(items.map((item) => item.kind)).toEqual([
      "best5k",
      "bestPace",
      "longestRun",
      "mostMiles",
      "mostTimeRunning",
      "biggestCrewDay",
      "mostRunnersDay",
    ]);
    expect(items[0]).toMatchObject({ value: 1290, runId: "quick" });
    expect(items[1]).toMatchObject({ value: 450, runId: "quick" });
    expect(items.find((item) => item.kind === "mostMiles")).toMatchObject({
      value: 14.5,
      runner: { displayName: "Drew" },
      localDate: null,
    });
    expect(items.find((item) => item.kind === "mostTimeRunning")).toMatchObject({
      value: 8100,
      runner: { displayName: "Drew" },
      localDate: null,
    });
    expect(items.find((item) => item.kind === "biggestCrewDay")).toMatchObject({
      value: 12,
      runner: null,
      runCount: 1,
      localDate: "2026-08-12",
    });
    expect(items.find((item) => item.kind === "mostRunnersDay")).toMatchObject({
      value: 2,
      runner: null,
      localDate: "2026-08-13",
    });
  });

  it("adds competitive weekly totals without inventing a winner on ties", () => {
    const recap = recapOf([
      run("z1", "zack", "2026-08-11", { distanceMiles: 4, durationSeconds: 2400 }),
      run("z2", "zack", "2026-08-13", { distanceMiles: 4, durationSeconds: 2300 }),
      run("z3", "zack", "2026-08-15", { distanceMiles: 2, durationSeconds: 1400 }),
      run("d1", "drew", "2026-08-12", { distanceMiles: 9, durationSeconds: 5200 }),
      run("d2", "drew", "2026-08-14", { distanceMiles: 5, durationSeconds: 3200 }),
    ]);
    const items = beat(recap!.beats, "performances")!.items;

    expect(items.find((item) => item.kind === "mostMiles")).toMatchObject({
      value: 14,
      runner: { displayName: "Drew" },
    });
    expect(items.find((item) => item.kind === "mostRuns")).toMatchObject({
      value: 3,
      runner: { displayName: "Zack" },
    });
    expect(items.find((item) => item.kind === "mostTimeRunning")).toMatchObject({
      value: 8400,
      runner: { displayName: "Drew" },
    });
  });

  it("compares each runner with their own prior-week mileage", () => {
    const recap = recapOf([
      run("z-now", "zack", "2026-08-12", { distanceMiles: 12, durationSeconds: 6000 }),
      run("d-now", "drew", "2026-08-13", { distanceMiles: 15, durationSeconds: 7600 }),
      run("z-prev", "zack", "2026-08-05", { distanceMiles: 5, durationSeconds: 2500 }),
      run("d-prev", "drew", "2026-08-06", { distanceMiles: 12, durationSeconds: 6200 }),
    ]);
    expect(
      beat(recap!.beats, "performances")!.items.find(
        (item) => item.kind === "biggestMileageIncrease",
      ),
    ).toMatchObject({
      value: 7,
      runner: { displayName: "Zack" },
      localDate: null,
    });
  });

  it("keeps crew-day facts alongside the individual competition", () => {
    const recap = recapOf([
      run("big", "drew", "2026-08-12", { distanceMiles: 14, durationSeconds: 7000, best5kSeconds: 1400 }),
      run("a", "zack", "2026-08-13", { distanceMiles: 3, durationSeconds: 1700 }),
      run("b", "drew", "2026-08-13", { distanceMiles: 3, durationSeconds: 1750 }),
      run("c", "zack", "2026-08-13", { distanceMiles: 2.5, durationSeconds: 1500 }),
    ]);
    const kinds = beat(recap!.beats, "performances")!.items.map((item) => item.kind);
    expect(kinds).toContain("biggestCrewDay");
    expect(kinds).toContain("mostRunnersDay");
    expect(kinds).not.toContain("mostActiveDay");
  });

  it("names the day with the most distinct runners, not the most raw activities", () => {
    const recap = recapOf([
      // Zack runs twice Thursday; that is still one runner.
      run("za", "zack", "2026-08-13", { distanceMiles: 5, durationSeconds: 2500 }),
      run("zb", "zack", "2026-08-13", { distanceMiles: 2, durationSeconds: 1200 }),
      // Two different runners show up Friday.
      run("zc", "zack", "2026-08-14", { distanceMiles: 3, durationSeconds: 1700 }),
      run("d", "drew", "2026-08-14", { distanceMiles: 3, durationSeconds: 1750 }),
    ]);
    expect(
      beat(recap!.beats, "performances")!.items.find((item) => item.kind === "mostRunnersDay"),
    ).toMatchObject({ value: 2, localDate: "2026-08-14", runner: null });
  });

  it("qualifies the best pace exactly as the Fastest Avg. Pace award does", () => {
    const recap = recapOf([
      run("long", "drew", "2026-08-12", { distanceMiles: 9, durationSeconds: 4500 }),
      // Faster, but under two miles: not a qualifying pace.
      run("sprint", "zack", "2026-08-13", { distanceMiles: 1.5, durationSeconds: 480 }),
      // Faster still, but Cross Training has no pace to rank.
      run("ride", "zack", "2026-08-14", {
        activityType: "cross",
        distanceMiles: 8,
        durationSeconds: 1200,
      }),
    ]);
    const pace = beat(recap!.beats, "performances")!.items.find(
      (item) => item.kind === "bestPace",
    );
    expect(pace).toMatchObject({ runId: "long", value: 500 });
  });

  it("never claims a most-runners day from single-run days", () => {
    const recap = recapOf([
      run("a", "zack", "2026-08-12", { distanceMiles: 3 }),
      run("b", "drew", "2026-08-13", { distanceMiles: 4 }),
    ]);
    expect(
      beat(recap!.beats, "performances")!.items.some((item) => item.kind === "mostRunnersDay"),
    ).toBe(false);
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
      best5kSeconds: 1290,
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
        // The one field issue #186 added, carried across explicitly. Every
        // other new-looking field on a shared run still has to be dropped.
        best5kSeconds: 1290,
        crewBuildRow: 5,
        crewBuildColumnStart: 2,
      },
    ]);
  });

  it("reads a shared run with no 5K as having none, never as zero", () => {
    const shared = {
      id: "run-2",
      localRunId: "local-2",
      userId: "zack",
      displayName: "Zack",
      accentColor: null,
      runnerIcon: ICON,
      localDate: "2026-08-12",
      activityType: "easy",
      distanceMiles: 4,
      durationSeconds: 2000,
      createdAt: "2026-08-12T12:00:00Z",
      updatedAt: "2026-08-12T12:00:00Z",
      buildRow: null,
      buildColumnStart: null,
      crewBuildRow: null,
      crewBuildColumnStart: null,
      crewBuildPlacedAt: null,
      propsCount: 0,
      viewerHasPropped: false,
    } satisfies CrewSharedRun;
    expect(crewWeekRecapRunsFrom([shared])[0].best5kSeconds).toBeNull();
  });
});

describe("the week's fastest 5K", () => {
  it("names the smallest source-verified 5K and the runner who ran it", () => {
    const recap = recapOf([
      run("slower", "zack", "2026-08-11", { distanceMiles: 6, best5kSeconds: 1400 }),
      run("faster", "drew", "2026-08-12", { distanceMiles: 6, best5kSeconds: 1290 }),
    ]);
    const best5k = beat(recap!.beats, "performances")!.items.find(
      (item) => item.kind === "best5k",
    );
    expect(best5k).toMatchObject({ value: 1290, runId: "faster", localDate: "2026-08-12" });
    expect(best5k!.runner?.displayName).toBe("Drew");
  });

  it("is absent for a week whose runs carry no verified 5K", () => {
    // Every one of these could produce a plausible-looking estimate from
    // duration and distance. None of them does.
    const recap = recapOf([
      run("a", "zack", "2026-08-11", { distanceMiles: 3.1, durationSeconds: 1500 }),
      run("b", "drew", "2026-08-12", { distanceMiles: 8, durationSeconds: 4000 }),
    ]);
    expect(
      beat(recap!.beats, "performances")!.items.some((item) => item.kind === "best5k"),
    ).toBe(false);
  });

  it("ignores an unusable value rather than presenting it", () => {
    for (const best5kSeconds of [0, -60, Number.NaN, Number.POSITIVE_INFINITY]) {
      const recap = recapOf([
        run("a", "zack", "2026-08-11", { distanceMiles: 6, best5kSeconds }),
      ]);
      expect(
        beat(recap!.beats, "performances")!.items.some((item) => item.kind === "best5k"),
      ).toBe(false);
    }
  });

  it("omits the beat on an exact tie rather than picking a winner", () => {
    // The rest of the page still has answers; only the 5K is tied, and only
    // the 5K disappears.
    const recap = recapOf([
      run("a", "zack", "2026-08-11", { distanceMiles: 6, durationSeconds: 3000, best5kSeconds: 1290 }),
      run("b", "drew", "2026-08-12", { distanceMiles: 7, durationSeconds: 3400, best5kSeconds: 1290 }),
    ]);
    const items = beat(recap!.beats, "performances")!.items;
    expect(items.some((item) => item.kind === "best5k")).toBe(false);
    expect(items.map((item) => item.kind)).toEqual([
      "bestPace",
      "longestRun",
      "mostMiles",
      "mostTimeRunning",
      "biggestCrewDay",
    ]);
  });
});