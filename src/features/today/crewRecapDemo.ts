import { DEFAULT_CREW_EMBLEM, type CrewEmblem } from "../../crew/emblem";
import type { CrewMember, CrewWeekRecapRun } from "../../crew/types";
import { crewWeekRecap, type CrewWeekRecap } from "../../crew/weekRecap";
import { isPreviewReviewHost } from "./todayDemo";

/**
 * Owner review for the Crew Week Recap.
 *
 * The recap is only on Today for three days after a Crew week closes, and only
 * for a Crew that actually ran that week. That is correct product behaviour and
 * a genuinely awkward thing to review: on any other day of the week, or from an
 * account with no crewmates, there is nothing to look at.
 *
 * This is the same in-memory overlay `?demo=today` already provides, aimed at
 * the recap. It is preview-host-only, it carries its own fake crew, roster,
 * week and awards, and it never reads or writes a real Crew, a real account or
 * localStorage. Its recap is produced by the real `crewWeekRecap` derivation,
 * so what the reviewer sees is the shipping code's output — only the facts
 * going in are invented.
 */

interface DemoLocation {
  hostname: string;
  search: string;
}

export type CrewRecapDemoVariant = "full" | "minimal";

/**
 * A Tuesday, two days after the demo week closed, so the module is inside its
 * own Today window. Deliberately not `TODAY_DEMO_DATE` — that is a Thursday,
 * by which point a real recap has correctly aged off Today.
 */
export const CREW_RECAP_DEMO_TODAY = "2026-09-15";
const DEMO_WEEK = { weekStart: "2026-09-07", weekEnd: "2026-09-13" };

export function crewRecapDemoVariant(
  location?: DemoLocation | null,
): CrewRecapDemoVariant | null {
  const current =
    location ?? (typeof window === "undefined" ? null : window.location);
  if (!current || !isPreviewReviewHost(current)) return null;
  const demo = new URLSearchParams(current.search).get("demo");
  if (demo === "recap") return "full";
  if (demo === "recap-minimal") return "minimal";
  return null;
}

const ICONS = [
  { head: 1, face: 2, body: 1, flair: 0, background: 2 },
  { head: 3, face: 1, body: 2, flair: 1, background: 0 },
  { head: 0, face: 3, body: 0, flair: 2, background: 3 },
  { head: 2, face: 0, body: 3, flair: 0, background: 1 },
];

const ROSTER: readonly {
  userId: string;
  displayName: string;
  accentColor: CrewMember["accentColor"];
}[] = [
  { userId: "demo-1", displayName: "Zack", accentColor: "sky" },
  { userId: "demo-2", displayName: "Priya", accentColor: "magenta" },
  { userId: "demo-3", displayName: "Marcus", accentColor: "mint" },
  { userId: "demo-4", displayName: "Elena", accentColor: "vermilion" },
];

function members(count: number): CrewMember[] {
  return ROSTER.slice(0, count).map((entry, index) => ({
    userId: entry.userId,
    role: index === 0 ? "owner" : "member",
    joinedAt: "2026-06-01T00:00:00Z",
    displayName: entry.displayName,
    accentColor: entry.accentColor,
    runnerIcon: ICONS[index],
  }));
}

function run(
  id: string,
  memberIndex: number,
  localDate: string,
  fields: Pick<CrewWeekRecapRun, "activityType" | "distanceMiles" | "durationSeconds"> &
    Partial<Pick<CrewWeekRecapRun, "crewBuildRow" | "crewBuildColumnStart" | "source">>,
): CrewWeekRecapRun {
  const entry = ROSTER[memberIndex];
  return {
    id,
    userId: entry.userId,
    displayName: entry.displayName,
    accentColor: entry.accentColor,
    runnerIcon: ICONS[memberIndex],
    localDate,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    ...fields,
  };
}

/**
 * A four-runner week with every beat present, and the sparse counterpart.
 *
 * `minimal` is the case the acceptance criteria care about and the harder one
 * to catch in the wild: one run, one runner, nothing placed, no previous week.
 * It should read as a short true recap rather than a broken full one.
 */
function demoRuns(variant: CrewRecapDemoVariant): CrewWeekRecapRun[] {
  if (variant === "minimal") {
    return [
      run("m1", 0, "2026-09-09", {
        activityType: "easy",
        distanceMiles: 3.1,
        durationSeconds: 1755,
        source: "intervals",
      }),
    ];
  }

  return [
    // The recapped week, laid out as the tower would really pack it: three
    // courses, no empty course, every block resting on something.
    run("w1", 0, "2026-09-07", {
      activityType: "easy",
      distanceMiles: 4.2,
      durationSeconds: 2280,
      source: "intervals",
      crewBuildRow: 6,
      crewBuildColumnStart: 1,
    }),
    run("w2", 1, "2026-09-08", {
      activityType: "intervals",
      distanceMiles: 6.1,
      durationSeconds: 3120,
      source: "intervals",
      crewBuildRow: 6,
      crewBuildColumnStart: 3,
    }),
    run("w3", 3, "2026-09-09", {
      activityType: "cross",
      distanceMiles: 0,
      durationSeconds: 2700,
      source: "intervals",
      crewBuildRow: 6,
      crewBuildColumnStart: 6,
    }),
    // The one hand-logged run of the week, so its brick carries issue #129's
    // asterisk and the rest do not.
    run("w4", 2, "2026-09-09", {
      activityType: "easy",
      distanceMiles: 3.5,
      durationSeconds: 1980,
      source: "manual",
      crewBuildRow: 6,
      crewBuildColumnStart: 7,
    }),
    run("w5", 0, "2026-09-11", {
      activityType: "easy",
      distanceMiles: 4.6,
      durationSeconds: 2760,
      source: "intervals",
      crewBuildRow: 7,
      crewBuildColumnStart: 1,
    }),
    run("w6", 1, "2026-09-12", {
      activityType: "long",
      distanceMiles: 13.1,
      durationSeconds: 7440,
      source: "intervals",
      crewBuildRow: 8,
      crewBuildColumnStart: 1,
    }),
    // Earned, not yet placed: it counts in the week's totals and not in the
    // tower, which is exactly the distinction the Build beat draws.
    run("w7", 2, "2026-09-13", {
      activityType: "easy",
      distanceMiles: 4.4,
      durationSeconds: 2460,
      source: "intervals",
    }),
    // The week before, so week-over-week has something defensible to say.
    run("p1", 0, "2026-09-02", {
      activityType: "easy",
      distanceMiles: 4,
      durationSeconds: 2220,
      source: "intervals",
    }),
    run("p2", 1, "2026-09-04", {
      activityType: "long",
      distanceMiles: 10.5,
      durationSeconds: 6000,
      source: "intervals",
    }),
    run("p3", 3, "2026-09-05", {
      activityType: "easy",
      distanceMiles: 3.2,
      durationSeconds: 1860,
      source: "intervals",
    }),
  ];
}

export interface CrewRecapDemo {
  recap: CrewWeekRecap;
  emblem: CrewEmblem;
  today: string;
}

/**
 * The fake recap, built by the real derivation.
 *
 * Null would mean the fixture itself stopped producing a recap, which is worth
 * seeing as "nothing rendered" rather than being papered over here.
 */
export function crewRecapDemoData(
  variant: CrewRecapDemoVariant,
): CrewRecapDemo | null {
  const roster = members(variant === "minimal" ? 3 : 4);
  const recap = crewWeekRecap({
    crewId: "demo-crew",
    crewName: variant === "minimal" ? "Slow Week RC" : "Night Shift",
    buildStartDate: variant === "minimal" ? "2026-09-07" : "2026-06-01",
    members: roster,
    runs: demoRuns(variant),
    awards:
      variant === "minimal"
        ? []
        : [
          {
            id: "demo-award-miles",
            crewId: "demo-crew",
            weekStart: DEMO_WEEK.weekStart,
            awardType: "miles",
            winnerUserId: "demo-2",
            resultValue: 19.2,
            sourceSharedRunId: null,
            crewBuildRow: 9,
            crewBuildColumnStart: 6,
            crewBuildPlacedAt: "2026-09-14T18:00:00Z",
            createdAt: "2026-09-14T00:00:00Z",
          },
          {
            id: "demo-award-long",
            crewId: "demo-crew",
            weekStart: DEMO_WEEK.weekStart,
            awardType: "longHaul",
            winnerUserId: "demo-2",
            resultValue: 13.1,
            sourceSharedRunId: null,
            crewBuildRow: 9,
            crewBuildColumnStart: 1,
            crewBuildPlacedAt: "2026-09-14T18:05:00Z",
            createdAt: "2026-09-14T00:00:00Z",
          },
          // Won but not yet placed: it must NOT appear in the recap (D-080).
          {
            id: "demo-award-unplaced",
            crewId: "demo-crew",
            weekStart: DEMO_WEEK.weekStart,
            awardType: "pace",
            winnerUserId: "demo-3",
            resultValue: 447,
            sourceSharedRunId: null,
            crewBuildRow: null,
            crewBuildColumnStart: null,
            crewBuildPlacedAt: null,
            createdAt: "2026-09-14T00:00:00Z",
          },
        ],
    week: DEMO_WEEK,
  });

  return recap
    ? { recap, emblem: DEFAULT_CREW_EMBLEM, today: CREW_RECAP_DEMO_TODAY }
    : null;
}
