import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CREW_EMBLEM } from "../../crew/emblem.js";
import type {
  CrewDashboardData,
  CrewMember,
  CrewSharedRun,
} from "../../crew/types.js";
import type { RaceCrewController } from "../../crew/useRaceCrew.js";
import { TodayCrewRecap } from "./TodayCrewRecap.js";

const ICON = { head: 0, face: 0, body: 0, flair: 0, background: 0 };

/** Monday of the week after the recapped Monday–Sunday week (Aug 10–16). */
const MONDAY_AFTER = "2026-08-17";
const MONDAY_AFTER_ROLLOVER = new Date("2026-08-17T10:00:00Z");

function member(userId: string, displayName: string): CrewMember {
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
  overrides: Partial<CrewSharedRun> = {},
): CrewSharedRun {
  return {
    id,
    localRunId: `local-${id}`,
    userId,
    displayName: userId === "zack" ? "Zack" : "Drew",
    accentColor: null,
    runnerIcon: ICON,
    localDate,
    activityType: "easy",
    distanceMiles: 5,
    durationSeconds: 2700,
    createdAt: `${localDate}T12:00:00Z`,
    updatedAt: `${localDate}T12:00:00Z`,
    buildRow: null,
    buildColumnStart: null,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildRotated: false,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
    ...overrides,
  };
}

function controller(
  runs: CrewSharedRun[],
  overrides: { sharedRunsAvailable?: boolean; buildStartDate?: string } = {},
): RaceCrewController {
  const dashboard: CrewDashboardData = {
    members: [member("zack", "Zack"), member("drew", "Drew")],
    summaries: [],
    runs,
    miniBuildRuns: [],
    crewBuildRuns: [],
    sharedRunsAvailable: overrides.sharedRunsAvailable ?? true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    propNotifications: [],
    loadedAt: `${MONDAY_AFTER}T08:00:00Z`,
  };
  return {
    status: "signed-in",
    account: {
      profile: { id: "zack", displayName: "Zack" },
      crew: {
        id: "crew-1",
        name: "Night Shift",
        buildStartDate: overrides.buildStartDate ?? "2026-06-01",
        emblem: DEFAULT_CREW_EMBLEM,
      },
    },
    crewData: dashboard,
  } as unknown as RaceCrewController;
}

const WEEK_RUNS = [
  run("a", "zack", "2026-08-10", { distanceMiles: 5, durationSeconds: 2700 }),
  run("b", "drew", "2026-08-12", {
    distanceMiles: 12,
    durationSeconds: 7200,
    activityType: "long",
    crewBuildRow: 4,
    crewBuildColumnStart: 1,
    crewBuildRotated: false,
  }),
  run("c", "zack", "2026-08-15", { distanceMiles: 4, durationSeconds: 2100 }),
];

describe("Today Crew Week Recap", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("states the closed week's headline facts and opens the fuller recap", async () => {
    const user = userEvent.setup();
    render(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today={MONDAY_AFTER}
        now={MONDAY_AFTER_ROLLOVER}
      />,
    );

    const module = screen.getByRole("heading", { level: 2 }).closest("section")!;
    expect(within(module).getByText(/Crew Week Recap · Aug 10 – Aug 16/)).toBeInTheDocument();
    expect(within(module).getByText("21.0 mi")).toBeInTheDocument();
    // Compact machine line, including what the week added to the tower.
    expect(within(module).getByText(/3 RUNS · 2 RUNNERS · \+1 BLOCK/)).toBeInTheDocument();
    // The teaser shows the week's own blocks rather than an illustration.
    expect(
      within(module).getByRole("img", { name: /1 block this week added 12.0 miles/ }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View recap →" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("TOGETHER")).toBeInTheDocument();
    expect(within(dialog).getByText("Night Shift · Week Recap")).toBeInTheDocument();
  });

  it("holds the Monday recap until 06:00 Eastern", () => {
    const { rerender } = render(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today={MONDAY_AFTER}
        now={new Date("2026-08-17T09:59:59Z")}
      />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();

    rerender(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today={MONDAY_AFTER}
        now={MONDAY_AFTER_ROLLOVER}
      />,
    );
    expect(screen.getByText(/Crew Week Recap/)).toBeInTheDocument();
  });

  it("stays off Today until the week has closed, and ages out after three days", () => {
    const { rerender } = render(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today="2026-08-16"
        now={new Date("2026-08-16T16:00:00Z")}
      />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();

    rerender(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today="2026-08-19"
        now={new Date("2026-08-19T16:00:00Z")}
      />,
    );
    expect(screen.getByText(/Crew Week Recap/)).toBeInTheDocument();

    rerender(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today="2026-08-20"
        now={new Date("2026-08-20T16:00:00Z")}
      />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();
  });

  it("can be dismissed, and stays dismissed for that crew's week", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today={MONDAY_AFTER}
        now={MONDAY_AFTER_ROLLOVER}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss Crew Week Recap" }));
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();

    unmount();
    render(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS)}
        today="2026-08-18"
        now={new Date("2026-08-18T16:00:00Z")}
      />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();
  });

  it("shows nothing for a week the crew did not run, and nothing without a crew", () => {
    const { rerender } = render(
      <TodayCrewRecap
        crew={controller([run("late", "zack", MONDAY_AFTER)])}
        today={MONDAY_AFTER}
        now={MONDAY_AFTER_ROLLOVER}
      />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();

    rerender(
      <TodayCrewRecap
        crew={null}
        today={MONDAY_AFTER}
        now={MONDAY_AFTER_ROLLOVER}
      />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();
  });

  it("shows nothing for a crew whose Build start date did not arrive", () => {
    const crew = controller(WEEK_RUNS);
    // The one field the week has to be windowed against.
    delete (crew.account!.crew as unknown as Record<string, unknown>).buildStartDate;
    render(
      <TodayCrewRecap crew={crew} today={MONDAY_AFTER} now={MONDAY_AFTER_ROLLOVER} />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();
  });

  it("renders the owner-review recap on a preview host with no crew at all", async () => {
    const user = userEvent.setup();
    // jsdom serves localhost, which is a preview review host.
    window.history.replaceState({}, "", "/?demo=recap");

    // Saturday, and no crew: neither would produce a live recap.
    render(<TodayCrewRecap crew={null} today="2026-08-22" />);

    expect(screen.getByText(/RECAP DEMO · FAKE CREW DATA/)).toBeInTheDocument();
    expect(screen.getByText(/Crew Week Recap · Sep 7 – Sep 13/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "View recap →" }));
    expect(within(screen.getByRole("dialog")).getByText("TOGETHER")).toBeInTheDocument();
  });

  it("shows nothing while shared runs are unavailable, rather than a recap missing runs", () => {
    render(
      <TodayCrewRecap
        crew={controller(WEEK_RUNS, { sharedRunsAvailable: false })}
        today={MONDAY_AFTER}
        now={MONDAY_AFTER_ROLLOVER}
      />,
    );
    expect(screen.queryByText(/Crew Week Recap/)).not.toBeInTheDocument();
  });
});
