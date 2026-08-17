import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { DEFAULT_CREW_EMBLEM, decodeCrewEmblem } from "../../crew/emblem";
import type {
  CrewDashboardData,
  CrewMember,
  CrewMemberSummary,
  CrewSharedRun,
  RaceCrew,
} from "../../crew/types";
import { CrewScreen } from "./CrewScreen";

const TODAY = "2026-08-10";

const members: CrewMember[] = [
  { userId: "zack", displayName: "Zack", role: "owner", joinedAt: "2026-08-01T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  { userId: "drew", displayName: "Drew", role: "member", joinedAt: "2026-08-02T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  { userId: "travis", displayName: "Travis", role: "member", joinedAt: "2026-08-03T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
];

function summary(
  userId: string,
  values: Partial<CrewMemberSummary> = {},
): CrewMemberSummary {
  return {
    userId,
    displayName: members.find((member) => member.userId === userId)?.displayName ?? "Runner",
    weekStart: "2026-08-10",
    weeklyMiles: 0,
    longestRun28dMiles: 0,
    consistencyCompleted: 0,
    consistencyDue: 0,
    milesBuilt: 0,
    updatedAt: "2026-08-10T14:00:00Z",
    ...values,
  };
}

function sharedRun(
  id: string,
  userId: string,
  localDate: string,
  values: Partial<CrewSharedRun> = {},
): CrewSharedRun {
  return {
    id,
    userId,
    displayName: members.find((member) => member.userId === userId)?.displayName ?? "Runner",
    accentColor: members.find((member) => member.userId === userId)?.accentColor ?? null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    localDate,
    activityType: "easy",
    distanceMiles: 4,
    durationSeconds: 2352,
    createdAt: `${localDate}T14:00:00Z`,
    updatedAt: `${localDate}T14:00:00Z`,
    buildRow: 0,
    buildColumnStart: 1,
    crewBuildRow: 0,
    crewBuildColumnStart: 1,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
    ...values,
  };
}

function dashboard(overrides: Partial<CrewDashboardData> = {}): CrewDashboardData {
  const runs = overrides.runs ?? [
    sharedRun("new", "drew", "2026-08-09", {
      activityType: "long",
      distanceMiles: 6.1,
      durationSeconds: 3522,
    }),
    sharedRun("old", "travis", "2026-08-08", { crewBuildColumnStart: 4 }),
  ];
  return {
    members,
    summaries: [
      summary("zack", {
        weeklyMiles: 18.4,
        longestRun28dMiles: 9,
        consistencyCompleted: 14,
        consistencyDue: 16,
        milesBuilt: 122,
      }),
      summary("drew", {
        weeklyMiles: 16.2,
        longestRun28dMiles: 11,
        consistencyCompleted: 12,
        consistencyDue: 16,
        milesBuilt: 140,
      }),
      summary("travis", {
        weeklyMiles: 14.8,
        longestRun28dMiles: 8,
        consistencyCompleted: 0,
        consistencyDue: 0,
        milesBuilt: 98,
      }),
    ],
    // Both derived views default to the same safe rows the loader builds them
    // from, so a test that changes the runs changes every view of them.
    miniBuildRuns: runs.map(({ id, userId, localDate, activityType, distanceMiles, buildRow, buildColumnStart }) => ({
      id,
      userId,
      localDate,
      activityType,
      distanceMiles,
      buildRow,
      buildColumnStart,
    })),
    crewBuildRuns: runs.map(({ id, userId, displayName, accentColor, localDate, activityType, distanceMiles, createdAt, crewBuildRow, crewBuildColumnStart, crewBuildPlacedAt }) => ({
      id,
      userId,
      displayName,
      accentColor,
      localDate,
      activityType,
      distanceMiles,
      createdAt,
      crewBuildRow,
      crewBuildColumnStart,
      crewBuildPlacedAt,
    })),
    sharedRunsAvailable: true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    propNotifications: [],
    loadedAt: "2026-08-10T14:00:00Z",
    ...overrides,
    runs,
  };
}

const crewOne: RaceCrew = {
  id: "crew-1",
  ownerUserId: "zack",
  name: "OUC Half Crew",
  crewType: "race",
  raceName: "Half Marathon",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  buildStartDate: "2026-08-01",
  emblem: DEFAULT_CREW_EMBLEM,
};

/** A second crew, so the switcher has something to switch between. */
const crewTwo: RaceCrew = {
  id: "crew-2",
  ownerUserId: "drew",
  name: "Trail Crew",
  crewType: "race",
  raceName: "Ridge 50K",
  raceDate: "2027-04-10",
  raceDistanceMiles: 31,
  buildStartDate: "2026-11-01",
  emblem: decodeCrewEmblem("E2-14.2-4.6-5.3")!,
};

/** A Run Club counterpart: no race fields, so the header and comparisons swap accordingly. */
const runClub: RaceCrew = {
  id: "crew-3",
  ownerUserId: "zack",
  name: "Thursday Run Club",
  crewType: "club",
  raceName: null,
  raceDate: null,
  raceDistanceMiles: null,
  buildStartDate: "2026-08-01",
  emblem: decodeCrewEmblem("E2-8.4-0.1-9.1")!,
};

function controller(overrides: Partial<RaceCrewController> = {}): RaceCrewController {
  const action = vi.fn(async () => undefined);
  return {
    configured: true,
    unavailableReason: null,
    status: "signed-in",
    busy: false,
    error: null,
    message: null,
    email: "zack@example.test",
    account: {
      profile: {
        id: "zack",
        displayName: "Zack",
        accentColor: null,
        runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
        propsSeenAt: "2026-08-10T14:00:00Z",
      },
      memberships: [{ crew: crewOne, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
      crew: crewOne,
      role: "owner",
      members,
      invites: [],
      takenAccentColors: [],
    },
    pendingInvite: null,
    latestInviteUrl: null,
    projectionError: null,
    crewData: dashboard(),
    crewDataStatus: "ready",
    crewDataError: null,
    propsPendingRunIds: [],
    propsErrors: {},
    unreadPropNotifications: [],
    visiblePropNotifications: [],
    crewBuildPlacementPending: false,
    crewBuildPlacementError: null,
    createAccount: action,
    signIn: action,
    signOut: action,
    saveDisplayName: action,
    saveAccentColor: action,
    saveRunnerIcon: action,
    createCrew: action,
    updateCrew: vi.fn(async () => true),
    deleteCrew: vi.fn(async () => true),
    switchCrew: action,
    createInvite: action,
    resetInvite: action,
    joinPendingInvite: action,
    leaveCrew: action,
    removeMember: action,
    deleteRunContribution: action,
    refreshCrewData: action,
    toggleProps: action,
    markPropsSeen: action,
    dismissPropNotification: vi.fn(),
    placeCrewBuildBlock: vi.fn(async () => true),
    clearCrewBuildPlacementError: vi.fn(),
    clearMessage: vi.fn(),
    ...overrides,
  };
}

function openCrew(crew = controller()) {
  const user = userEvent.setup();
  render(<CrewScreen crew={crew} onOpenAccountCrew={vi.fn()} today={TODAY} />);
  return user;
}

describe("Crew destination states", () => {
  it("shows the intentional signed-out state", () => {
    openCrew(controller({ status: "signed-out", account: null, crewData: null }));
    expect(screen.getByText("Sign in to see your crew.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account & Crew" })).toBeInTheDocument();
  });

  it("shows the intentional no-crew state", () => {
    const noCrew = controller({
      account: {
        profile: {
          id: "zack",
          displayName: "Zack",
          accentColor: null,
          runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
          propsSeenAt: "2026-08-10T14:00:00Z",
        },
        memberships: [],
        crew: null,
        role: null,
        members: [],
        invites: [],
        takenAccentColors: [],
      },
      crewData: null,
    });
    openCrew(noCrew);
    expect(screen.getByText("Join or create a crew to train with friends.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account & Crew" })).toBeInTheDocument();
  });

  it("shows a retryable unavailable state when Supabase is not configured", () => {
    openCrew(
      controller({
        configured: false,
        status: "unconfigured",
        account: null,
        crewData: null,
      }),
    );
    expect(screen.getByText("Crew data unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("offers a retry when the crew query fails and leaves personal STACK alone", () => {
    openCrew(
      controller({ crewData: null, crewDataStatus: "error", crewDataError: "Network down" }),
    );
    expect(screen.getByText("Crew data unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
    expect(screen.getByText("Race Crew could not be reached. Personal STACK is unaffected.")).toBeInTheDocument();
  });

  it("keeps comparisons available when only shared-run loading fails", () => {
    openCrew(
      controller({
        crewData: dashboard({
          runs: [],
          miniBuildRuns: [],
          crewBuildRuns: [],
          sharedRunsAvailable: false,
          propsAvailable: false,
        }),
      }),
    );

    expect(screen.getByRole("list", { name: "Weekly Miles comparison" })).toBeInTheDocument();
    expect(screen.getByText("Crew Build unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Recent crew runs unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Member Builds unavailable.")).toBeInTheDocument();
  });
});

describe("Crew comparisons and runs", () => {
  it.each([2, 5, 10])(
    "keeps every zero-value member visible with a %s-runner crew",
    async (memberCount) => {
      const expandedMembers: CrewMember[] = Array.from(
        { length: memberCount },
        (_, index) => ({
          userId: index === 0 ? "zack" : `runner-${index}`,
          displayName: index === 0 ? "Zack" : `Runner ${index}`,
          role: index === 0 ? "owner" : "member",
          joinedAt: `2026-08-${String(index + 1).padStart(2, "0")}T00:00:00Z`,
          accentColor: null,
          runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
        }),
      );
      const expandedSummaries = expandedMembers.map((member) => ({
        ...summary(member.userId),
        displayName: member.displayName,
      }));

      await openCrew(
        controller({
          account: { ...controller().account!, members: expandedMembers },
          crewData: dashboard({
            members: expandedMembers,
            summaries: expandedSummaries,
            runs: [],
            crewBuildRuns: [],
          }),
        }),
      );

      const comparison = screen.getByRole("list", {
        name: "Weekly Miles comparison",
      });
      expect(within(comparison).getAllByRole("listitem")).toHaveLength(memberCount);
      expect(within(comparison).getAllByText("0 MI")).toHaveLength(memberCount);
    },
  );

  it("leads with crew identity, the race and a live countdown", () => {
    openCrew();

    expect(screen.getByRole("heading", { level: 1, name: "OUC Half Crew" })).toBeInTheDocument();
    expect(screen.getByText("Half Marathon · Dec 5 · 117 days to race")).toBeInTheDocument();
    // The crew name is stated once, not repeated by every module below it.
    expect(screen.getAllByText("OUC Half Crew")).toHaveLength(1);
  });

  it("leads a Run Club with a compact non-race context and no countdown", () => {
    openCrew(
      controller({
        account: {
          ...controller().account!,
          memberships: [{ crew: runClub, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
          crew: runClub,
        },
      }),
    );

    expect(screen.getByRole("heading", { level: 1, name: "Thursday Run Club" })).toBeInTheDocument();
    expect(screen.getByText("Building since Aug 1")).toBeInTheDocument();
    expect(screen.queryByText(/days to race|Race day|Race complete/)).not.toBeInTheDocument();
  });

  it("builds a one-member crew's tower and invites the rest", () => {
    const solo = members.slice(0, 1);
    const soloRun = sharedRun("solo", "zack", "2026-08-09", { distanceMiles: 5.5 });
    openCrew(
      controller({
        account: {
          ...controller().account!,
          members: solo,
        },
        crewData: dashboard({
          members: solo,
          summaries: [summary("zack")],
          runs: [soloRun],
          miniBuildRuns: [],
          crewBuildRuns: [
            {
              id: soloRun.id,
              userId: soloRun.userId,
              displayName: soloRun.displayName,
              accentColor: soloRun.accentColor,
              localDate: soloRun.localDate,
              activityType: soloRun.activityType,
              distanceMiles: soloRun.distanceMiles,
              createdAt: soloRun.createdAt,
              crewBuildRow: soloRun.crewBuildRow,
              crewBuildColumnStart: soloRun.crewBuildColumnStart,
              crewBuildPlacedAt: soloRun.crewBuildPlacedAt,
            },
          ],
        }),
      }),
    );

    expect(screen.getByText("miles built").parentElement).toHaveTextContent(/^5\.5/);
    expect(screen.queryByText("1 run · 1 runner")).not.toBeInTheDocument();
    expect(screen.getByText("Invite your crew to build together.")).toBeInTheDocument();
  });

  it("switches all four metrics, sorts descending, keeps ties stable, and marks You quietly", async () => {
    const user = await openCrew();
    const weeklyTab = screen.getByRole("tab", { name: "Weekly Miles" });

    let rows = within(
      screen.getByRole("list", { name: "Weekly Miles comparison" }),
    ).getAllByRole("listitem");
    expect(rows.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Zack"),
      expect.stringContaining("Drew"),
      expect.stringContaining("Travis"),
    ]);
    expect(within(rows[0]).getByText("You")).toBeInTheDocument();
    expect(rows[0].querySelector(".crew-comparison__bar")).toHaveStyle(
      "--crew-bar-value: 100%",
    );

    weeklyTab.focus();
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: "Longest Run" })).toHaveFocus();
    expect(screen.getByRole("tab", { name: "Longest Run" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    rows = within(
      screen.getByRole("list", { name: "Longest Run comparison" }),
    ).getAllByRole("listitem");
    expect(rows.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Drew"),
      expect.stringContaining("Zack"),
      expect.stringContaining("Travis"),
    ]);
    const metricTabs = screen.getByRole("tablist", { name: "Comparison metric" });
    expect(within(metricTabs).queryByText(/Miles|Long|Consist|Built/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Consistency" }));
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("· 14/16")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("· 12/16")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Miles Built" }));
    rows = within(
      screen.getByRole("list", { name: "Miles Built comparison" }),
    ).getAllByRole("listitem");
    expect(rows.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Drew"),
      expect.stringContaining("Travis"),
      expect.stringContaining("Zack"),
    ]);
    expect(screen.queryByRole("combobox", { name: "Comparison metric" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh crew data" })).toHaveTextContent("");
  });

  it("swaps Run Days in for Consistency on a Run Club, counting distinct days", async () => {
    const runs = [
      sharedRun("z1", "zack", "2026-08-01"),
      sharedRun("z2", "zack", "2026-08-05"),
      sharedRun("z3", "zack", "2026-08-09"),
      sharedRun("d1", "drew", "2026-08-09"),
    ];
    const user = await openCrew(
      controller({
        account: {
          ...controller().account!,
          memberships: [{ crew: runClub, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
          crew: runClub,
        },
        crewData: dashboard({ runs }),
      }),
    );

    const metricTabs = screen.getByRole("tablist", { name: "Comparison metric" });
    expect(within(metricTabs).queryByRole("tab", { name: "Consistency" })).not.toBeInTheDocument();
    expect(within(metricTabs).getByRole("tab", { name: "Run Days" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Run Days" }));
    const rows = within(
      screen.getByRole("list", { name: "Run Days comparison" }),
    ).getAllByRole("listitem");
    expect(rows.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Zack"),
      expect.stringContaining("Drew"),
      expect.stringContaining("Travis"),
    ]);
    expect(within(rows[0]).getByText("3")).toBeInTheDocument();
    expect(within(rows[0]).getByText("· 28D")).toBeInTheDocument();
    expect(within(rows[1]).getByText("1")).toBeInTheDocument();
    expect(within(rows[2]).getByText("0")).toBeInTheDocument();
  });

  it("shows recent crew runs newest first and derives pace", async () => {
    await openCrew();
    const runButtons = screen.getAllByRole("button", { name: /Open crew-safe run detail/ });
    expect(runButtons[0]).toHaveAccessibleName(expect.stringContaining("Sunday, August 9"));
    expect(runButtons[1]).toHaveAccessibleName(expect.stringContaining("Saturday, August 8"));
    expect(runButtons[0]).toHaveTextContent("9:37 /MI");
  });

  /**
   * One icon per card, and it is the runner's. The activity tile that used to
   * sit beside it is gone: what kind of run it was is carried by the item's
   * activity colour and the type word, not by a second badge.
   */
  it("leads each crew run card with the runner icon and no activity tile", async () => {
    await openCrew();
    const card = screen
      .getAllByRole("button", { name: /Open crew-safe run detail/ })[0]
      .closest("li");

    expect(card?.querySelectorAll(".runner-icon")).toHaveLength(1);
    expect(card?.querySelector(".crew-run-row__icon")).toBeNull();
    // The type is still named in the metadata, and typed on the item so the
    // left edge can carry its colour.
    expect(card).toHaveAttribute("data-type", "long");
    expect(card?.querySelector(".crew-run-row__activity")).toHaveTextContent("Long Run");
    // Distance, duration and pace all survive the compaction.
    expect(card).toHaveTextContent("9:37 /MI");
  });

  it("ranks Miles Built by communal placement rather than total shared mileage", async () => {
    const placedA = sharedRun("a-placed", "zack", "2026-08-09", {
      distanceMiles: 6,
      crewBuildColumnStart: 1,
    });
    const readyA = sharedRun("a-ready", "zack", "2026-08-10", {
      distanceMiles: 4,
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    const placedB = sharedRun("b-placed", "drew", "2026-08-09", {
      distanceMiles: 8,
      crewBuildColumnStart: 4,
    });
    const user = await openCrew(controller({
      crewData: dashboard({
        runs: [placedA, readyA, placedB],
        summaries: [
          summary("zack", { milesBuilt: 10 }),
          summary("drew", { milesBuilt: 8 }),
          summary("travis", { milesBuilt: 0 }),
        ],
      }),
    }));

    await user.click(screen.getByRole("tab", { name: "Miles Built" }));
    const rows = within(screen.getByRole("list", { name: "Miles Built comparison" }))
      .getAllByRole("listitem");
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/Drew.*8\.0 MI/),
      expect.stringMatching(/Zack.*6\.0 MI/),
      expect.stringMatching(/Travis.*0\.0 MI/),
    ]);
  });

  it("shows one binary Props action, count and pressed state while disabling self-Props", async () => {
    const toggleProps = vi.fn(async () => undefined);
    const crewRuns = [
      sharedRun("teammate", "drew", "2026-08-09", {
        propsCount: 3,
        viewerHasPropped: true,
      }),
      sharedRun("self", "zack", "2026-08-08", { propsCount: 2 }),
    ];
    const user = await openCrew(
      controller({
        crewData: dashboard({ runs: crewRuns }),
        toggleProps,
      }),
    );

    const removeProps = screen.getByRole("button", { name: "Remove Props from Drew" });
    expect(removeProps).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("3 Props")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Props.*Zack|Zack.*Props/i })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/2 Props. Props are for encouraging teammates/)).toBeInTheDocument();

    await user.click(removeProps);
    expect(toggleProps).toHaveBeenCalledWith("teammate");
  });

  it("renders stable member-ordered Member Builds from activity-colored shared blocks", async () => {
    await openCrew();
    const rail = screen.getByRole("list", { name: "Member Builds" });
    const cards = within(rail).getAllByRole("listitem");

    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Zack");
    expect(cards[0]).toHaveTextContent("You");
    // Zack has no miniBuildRuns in this fixture, so the tower is empty and
    // the mileage next to it must say the same thing rather than the
    // Crew-windowed comparison summary (122.0) attached to his card.
    expect(cards[0]).toHaveTextContent("0.0 MI BUILT");
    expect(cards[0]).toHaveTextContent("No blocks yet.");
    expect(cards[1]).toHaveTextContent("Drew");
    // Drew's only miniBuildRun ("new") is a 6.1mi long run, so the card
    // mileage must match that block, not his 140.0 comparison summary.
    expect(cards[1]).toHaveTextContent("6.1 MI BUILT");
    // Mileage and block count read together on one compact footer line,
    // rather than mileage sitting up in the identity row (issue #86).
    expect(cards[1]).toHaveTextContent("6.1 MI BUILT1 block");
    expect(cards[1].querySelector('rect[data-type="long"]')).toBeInTheDocument();
    expect(cards[1]).toHaveAttribute("data-member-color");
    expect(screen.queryByText("Each runner's own Build.")).not.toBeInTheDocument();
    // One construction grid per card: the outer card no longer draws its own
    // `technical-grid` background behind CrewMiniBuild's field grid.
    const card = screen.getByRole("button", { name: "Open Drew's Build" });
    expect(card.className).not.toMatch(/technical-grid/);
  });

  it("opens an exact read-only Member Build and resolves its block to crew-safe Run Detail", async () => {
    const exact = sharedRun("placed-run", "drew", "2026-08-07", {
      activityType: "intervals",
      distanceMiles: 5,
      buildRow: 6,
      buildColumnStart: 4,
    });
    const user = await openCrew(
      controller({
        crewData: dashboard({
          runs: [exact],
          miniBuildRuns: [{
            id: exact.id,
            userId: exact.userId,
            localDate: exact.localDate,
            activityType: exact.activityType,
            distanceMiles: exact.distanceMiles,
            buildRow: exact.buildRow,
            buildColumnStart: exact.buildColumnStart,
          }],
        }),
      }),
    );

    const card = screen.getByRole("button", { name: "Open Drew's Build" });
    expect(card).toBeInTheDocument();
    expect(card.querySelector('rect[data-row="6"][data-column-start="4"]')).toBeInTheDocument();
    await user.click(card);

    // The sheet is a member-focused profile, not a sheet titled only
    // "Member Build" (issue #87).
    const dialog = screen.getByRole("dialog", { name: "Crew Profile" });
    const build = within(dialog);
    expect(dialog.querySelector(".crew-member-profile__name")).toHaveTextContent("Drew");
    // The sheet's Member Build mileage must match its one displayed 5mi
    // block, not Drew's 140.0 Crew-windowed comparison summary.
    expect(dialog.querySelector(".crew-build__miles")).toHaveTextContent("5.0");
    const block = build.getByRole("button", {
      name: /Open Drew's Intervals on Friday, August 7, 5 miles/,
    });
    expect(block.closest("li")).toHaveAttribute("data-row", "6");
    expect(block.closest("li")).toHaveAttribute("data-column-start", "4");
    // The Build hero reuses Personal/Crew Build's own 3D brick primitive
    // rather than the old flat CSS-grid renderer.
    expect(block.querySelector(".placed-block__brick")).toBeInTheDocument();
    // Profiles keep the same viewing frame whether a member has one course
    // or a tall Build; the tower itself scrolls within that frame.
    expect(block.closest(".crew-build__stage")).toHaveStyle("--crew-build-visible-courses: 10");

    await user.click(block);
    expect(screen.getByRole("dialog", { name: "Run Detail" })).toBeInTheDocument();
    expect(screen.getByText("5 MI")).toBeInTheDocument();
  });

  it("matches Member Build mileage to its tower on both sides of Crew Build start while Crew comparison mileage stays Crew-windowed", async () => {
    const beforeCrewStart = sharedRun("before-crew-start", "drew", "2026-06-01", {
      activityType: "easy",
      distanceMiles: 3.2,
      buildRow: 0,
      buildColumnStart: 1,
      // Predates the Crew's Build start date, so it never landed on the
      // communal tower — only on Drew's own sanitized Personal Build.
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    const afterCrewStart = sharedRun("after-crew-start", "drew", "2026-08-09", {
      activityType: "long",
      distanceMiles: 6.1,
      buildRow: 1,
      buildColumnStart: 1,
      crewBuildRow: 0,
      crewBuildColumnStart: 1,
    });
    const user = await openCrew(
      controller({
        crewData: dashboard({ runs: [beforeCrewStart, afterCrewStart] }),
      }),
    );

    const card = screen.getByRole("button", { name: "Open Drew's Build" });
    // The card's tower shows both blocks, so its mileage must total both —
    // not Drew's Crew-windowed comparison summary.
    expect(card).toHaveTextContent("9.3 MI BUILT");

    await user.click(card);
    const dialog = screen.getByRole("dialog", { name: "Crew Profile" });
    const sheet = within(dialog);
    expect(dialog.querySelector(".crew-build__miles")).toHaveTextContent("9.3");
    expect(sheet.getAllByRole("button", { name: /Open Drew's/ })).toHaveLength(2);
    await user.keyboard("{Escape}");

    // The Crew comparison metric is untouched: only the physically placed,
    // Crew-windowed block (6.1mi) counts there, so it legitimately differs
    // from the 9.3mi Member Build tower above.
    await user.click(screen.getByRole("tab", { name: "Miles Built" }));
    const rows = within(screen.getByRole("list", { name: "Miles Built comparison" })).getAllByRole(
      "listitem",
    );
    expect(rows).toEqual(
      expect.arrayContaining([expect.objectContaining({ textContent: expect.stringMatching(/Drew.*6\.1 MI/) })]),
    );
  });

  it("keeps Member Build cards keyboard reachable and opens with Enter", async () => {
    const user = await openCrew();
    const card = screen.getByRole("button", { name: "Open Zack's Build" });
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Crew Profile" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Crew Profile" })).not.toBeInTheDocument();
  });

  it("opens a member-focused Crew Profile with identity, a compact stat strip and recent runs", async () => {
    const user = await openCrew(
      controller({
        crewData: dashboard({
          summaries: [
            summary("zack", { weeklyMiles: 12.4, longestRun28dMiles: 9.1, consistencyCompleted: 3, consistencyDue: 4 }),
            summary("drew", { weeklyMiles: 6.1, longestRun28dMiles: 6.1 }),
            summary("travis", {}),
          ],
          runs: [
            sharedRun("zack-run", "zack", "2026-08-09", { activityType: "long", distanceMiles: 9.1 }),
          ],
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Open Zack's Build" }));
    const dialog = screen.getByRole("dialog", { name: "Crew Profile" });
    const profile = within(dialog);

    // Identity: icon + name + the current viewer's own subtle YOU marker.
    expect(dialog.querySelector(".crew-member-profile__name")).toHaveTextContent("Zack");
    expect(dialog.querySelector(".crew-member-profile__you")).toHaveTextContent("You");

    // The compact shared stat strip, Race Crew's Consistency slot included.
    expect(dialog.querySelector(".crew-member-profile__stats")).toHaveTextContent("This Week");
    expect(dialog.querySelector(".crew-member-profile__stats")).toHaveTextContent("Longest");
    expect(dialog.querySelector(".crew-member-profile__stats")).toHaveTextContent("Consistency");
    expect(dialog.querySelector(".crew-member-profile__stats")).toHaveTextContent("75%");
    expect(dialog.querySelector(".crew-member-profile__stats")).toHaveTextContent("3/4");
    expect(dialog.querySelector(".crew-member-profile__stats")).toHaveTextContent("Member Build");

    // Recent runs use the same compact Crew run-row language as the main feed.
    expect(profile.getByText("Long Run")).toBeInTheDocument();
  });

  it("shows Run Days instead of Consistency in a Run Club's Crew Profile", async () => {
    const user = await openCrew(
      controller({
        account: {
          ...controller().account!,
          memberships: [{ crew: runClub, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
          crew: runClub,
        },
      }),
    );

    await user.click(screen.getByRole("button", { name: "Open Zack's Build" }));
    const dialog = screen.getByRole("dialog", { name: "Crew Profile" });
    expect(dialog.querySelector(".crew-member-profile__stats")).toHaveTextContent("Run Days");
    expect(dialog.querySelector(".crew-member-profile__stats")).not.toHaveTextContent("Consistency");
  });

  it("keeps run detail and Props as sibling controls inside one compact card", async () => {
    await openCrew();
    const runButton = screen.getAllByRole("button", { name: /Open crew-safe run detail/ })[0];
    const propsButton = screen.getByRole("button", { name: "Give Props to Drew" });
    const card = runButton.closest("li");

    expect(card).toContainElement(propsButton);
    expect(runButton).not.toContainElement(propsButton);
    expect(propsButton.querySelector(".lucide-thumbs-up")).toBeInTheDocument();
    expect(card?.querySelector(".lucide-sparkles")).not.toBeInTheDocument();
  });

  it("never presents a false zero when Props data is unavailable", async () => {
    const user = await openCrew(
      controller({ crewData: dashboard({ propsAvailable: false }) }),
    );
    await user.click(screen.getAllByRole("button", { name: /Open crew-safe run detail/ })[0]);
    const detail = within(screen.getByRole("dialog", { name: "Run Detail" }));

    expect(detail.getAllByText("Props unavailable").length).toBeGreaterThan(0);
    expect(detail.queryByText("0 crew members")).not.toBeInTheDocument();
    expect(detail.queryByRole("button", { name: /Give Props|Remove Props/ })).not.toBeInTheDocument();
  });

  it("opens a crew-safe detail and never exposes personal/private fields", async () => {
    const unsafe = {
      ...sharedRun("unsafe", "drew", "2026-08-09", {
        activityType: "long",
        distanceMiles: 6.1,
        durationSeconds: 3522,
      }),
      averageHeartRate: 155,
      trainingLoad: 72,
      effort: "great",
      notes: "Private crew note",
      sourceActivityId: "intervals-secret-id",
    };
    const user = await openCrew(
      controller({ crewData: dashboard({ runs: [unsafe] }) }),
    );
    await user.click(screen.getByRole("button", { name: /Open crew-safe run detail/ }));

    const detail = within(screen.getByRole("dialog", { name: "Run Detail" }));
    expect(detail.getByText("Drew")).toBeInTheDocument();
    expect(detail.getByText("6.1 MI")).toBeInTheDocument();
    expect(detail.getByText("58:42")).toBeInTheDocument();
    expect(detail.getByText("9:37 /MI")).toBeInTheDocument();
    expect(detail.getByText("0 crew members")).toBeInTheDocument();
    expect(detail.getByRole("button", { name: "Give Props to Drew" })).toBeInTheDocument();
    expect(detail.queryByText(/heart|155|load|72|effort|great/i)).not.toBeInTheDocument();
    expect(detail.queryByText("Private crew note")).not.toBeInTheDocument();
    expect(detail.queryByText("intervals-secret-id")).not.toBeInTheDocument();
    expect(detail.queryByRole("button", { name: /Edit|Delete|Intervals/i })).not.toBeInTheDocument();
  });
});

describe("Shared Crew Build", () => {
  const buildRuns = [
    sharedRun("first", "zack", "2026-08-05", {
      distanceMiles: 4,
      createdAt: "2026-08-05T12:00:00Z",
      crewBuildRow: 0,
      crewBuildColumnStart: 1,
    }),
    sharedRun("second", "drew", "2026-08-06", {
      activityType: "long",
      distanceMiles: 8,
      createdAt: "2026-08-06T12:00:00Z",
      crewBuildRow: 0,
      crewBuildColumnStart: 3,
    }),
    sharedRun("third", "travis", "2026-08-07", {
      activityType: "intervals",
      distanceMiles: 5,
      createdAt: "2026-08-07T12:00:00Z",
      crewBuildRow: 1,
      crewBuildColumnStart: 1,
    }),
  ];

  function crewWithBuild(overrides: Partial<CrewDashboardData> = {}) {
    return controller({ crewData: dashboard({ runs: buildRuns, ...overrides }) });
  }

  it("leads with physically placed miles while keeping secondary totals hidden", () => {
    openCrew(crewWithBuild());

    expect(screen.getByText("Crew Build")).toBeInTheDocument();
    expect(screen.getByText("17.0")).toBeInTheDocument();
    expect(screen.getByText("miles built")).toBeInTheDocument();
    expect(screen.queryByText("3 runs · 3 runners")).not.toBeInTheDocument();
    expect(
      within(screen.getByRole("list", { name: "Crew Build blocks" })).getAllByRole(
        "listitem",
      ),
    ).toHaveLength(3);
  });

  it("draws every member's run into one tower in contribution order", () => {
    openCrew(crewWithBuild());
    const tower = screen.getByRole("list", { name: "Crew Build blocks" });
    const blocks = within(tower).getAllByRole("listitem");

    expect(blocks.map((block) => block.getAttribute("data-type"))).toEqual([
      "easy",
      "long",
      "intervals",
    ]);
    // The oldest contribution is on the ground; the tower grows upward.
    expect(blocks[0]).toHaveAttribute("data-row", "0");
  });

  it("colors the whole block by the runner's stable member accent, not activity type", () => {
    openCrew(crewWithBuild());
    const blocks = within(
      screen.getByRole("list", { name: "Crew Build blocks" }),
    ).getAllByRole("listitem");

    const colors = blocks.map((block) => block.getAttribute("data-member-color"));
    expect(colors.every(Boolean)).toBe(true);
    // Two runners, two accents.
    expect(blocks[0].getAttribute("data-member-color")).not.toBe(
      blocks[1].getAttribute("data-member-color"),
    );
    // Activity type is still on the run, but per issue #65 it no longer
    // drives the block's colour — the member accent does, set on the shared
    // brick primitive's `--piece-color`.
    expect(blocks[0].getAttribute("data-type")).toBe("easy");
    const brick = blocks[0].querySelector<HTMLElement>(".placed-block__brick");
    expect(brick?.style.getPropertyValue("--piece-color")).toBe(
      `var(--member-${blocks[0].getAttribute("data-member-color")})`,
    );
    // Colour is the whole of Crew ownership: no initial, no badge, nothing
    // stamped on the face. A Crew brick is as clean as a Personal one, and
    // the runner's identity lives in the legend instead.
    expect(blocks[0].querySelector(".placed-block__monogram")).toBeNull();
    // The visible face shows the mileage and nothing else. Zack's name still
    // reaches a screen reader through the block's hidden label.
    const face = blocks[0].querySelector(".placed-block__brick")?.textContent ?? "";
    expect(face).toBe("4");
    expect(blocks[0].querySelector(".visually-hidden")).toHaveTextContent("Zack");
  });

  /**
   * Issue #71's explicit boundary: the runner's icon belongs in the legend and
   * the identity UI around the tower, never stamped onto every brick. Blocks
   * stay member-colored with at most an initial.
   */
  it("keeps the Crew Build blocks clean and puts the runner icons in the legend", () => {
    openCrew(crewWithBuild());
    const tower = screen.getByRole("list", { name: "Crew Build blocks" });
    expect(tower.querySelectorAll(".runner-icon")).toHaveLength(0);

    const legend = screen.getByRole("list", { name: "Crew Build runners" });
    const entries = within(legend).getAllByRole("listitem");
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      // One icon per runner, decorative, beside a name that does the naming.
      const mark = entry.querySelector(".runner-icon");
      expect(mark).not.toBeNull();
      expect(mark).toHaveAttribute("aria-hidden", "true");
      expect(entry).toHaveAttribute("data-member-color");
      expect(entry.textContent).toMatch(/\S/);
    }
  });

  it("names each block for a screen reader without exposing its decoration", () => {
    openCrew(crewWithBuild());
    const block = screen.getByRole("button", { name: "Drew, Long Run, 8 miles, August 6" });

    expect(block).toBeInTheDocument();
    expect(block.querySelectorAll("[aria-hidden='true']").length).toBeGreaterThan(0);
    // One interactive target per block, not one per drawn face.
    expect(block.closest("li")?.querySelectorAll("button")).toHaveLength(1);
  });

  it("opens the crew-safe Run Detail for the tapped block, whoever ran it", async () => {
    const user = openCrew(crewWithBuild());
    await user.click(screen.getByRole("button", { name: "Drew, Long Run, 8 miles, August 6" }));

    const detail = within(screen.getByRole("dialog", { name: "Run Detail" }));
    expect(detail.getByText("Drew")).toBeInTheDocument();
    expect(detail.getByText("8 MI")).toBeInTheDocument();
    expect(detail.queryByRole("button", { name: /Edit|Delete|Intervals/i })).not.toBeInTheDocument();
  });

  it("activates a block from the keyboard", async () => {
    const user = openCrew(crewWithBuild());
    const block = screen.getByRole("button", {
      name: "Travis, Intervals, 5 miles, August 7",
    });
    block.focus();
    expect(block).toHaveFocus();

    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Run Detail" })).toBeInTheDocument();
  });

  it("lists the crew's runners as a compact legend rather than a leaderboard", () => {
    openCrew(crewWithBuild());
    const legend = within(screen.getByRole("list", { name: "Crew Build runners" }));

    expect(legend.getAllByRole("listitem")).toHaveLength(3);
    expect(legend.getByText("Zack")).toBeInTheDocument();
    expect(legend.getByText("Drew")).toBeInTheDocument();
  });

  it("ignores personal Member Build placement when building the shared tower", () => {
    const moved = buildRuns.map((item) => ({
      ...item,
      buildRow: 7,
      buildColumnStart: 6,
    }));
    openCrew(crewWithBuild({ runs: moved }));

    const blocks = within(
      screen.getByRole("list", { name: "Crew Build blocks" }),
    ).getAllByRole("listitem");
    expect(blocks[0]).toHaveAttribute("data-row", "0");
    expect(blocks[0]).toHaveAttribute("data-column-start", "1");
  });

  it("shows an honest empty field before the first shared run", () => {
    openCrew(controller({ crewData: dashboard({ runs: [] }) }));

    expect(screen.getByText("0.0")).toBeInTheDocument();
    expect(screen.queryByText("0 runs · 3 runners")).not.toBeInTheDocument();
    expect(screen.getByText("The first shared run earns the first Crew block.")).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Crew Build blocks" })).not.toBeInTheDocument();
  });

  it("says the Crew Build is unavailable rather than showing an empty tower", () => {
    openCrew(
      controller({
        crewData: dashboard({ runs: [], sharedRunsAvailable: false }),
      }),
    );

    expect(screen.getByText("Crew Build unavailable.")).toBeInTheDocument();
    expect(screen.queryByText("The first shared run earns the first Crew block.")).not.toBeInTheDocument();
  });

  it("says so quietly when the safe read hit its ceiling", () => {
    openCrew(crewWithBuild({ sharedRunsTruncated: true }));
    expect(screen.getByText("Showing 3 shared runs.")).toBeInTheDocument();
  });

  it("keeps the tower in a scrollable viewport rather than shrinking its blocks", () => {
    openCrew(crewWithBuild());
    const tower = screen.getByRole("list", { name: "Crew Build blocks" });

    expect(tower.parentElement).toHaveClass("crew-build__viewport");
    // The field is told how many courses to draw, so a tall tower keeps its
    // block size and scrolls instead of being squeezed into a fixed box.
    expect(Number(tower.style.getPropertyValue("--grid-courses"))).toBeGreaterThan(0);
  });

  it("shows the current runner's oldest READY contribution beside the Crew Build", () => {
    const ownOlder = sharedRun("own-older", "zack", "2026-08-08", {
      activityType: "long",
      distanceMiles: 8,
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    const ownNewer = sharedRun("own-newer", "zack", "2026-08-09", {
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    const teammate = sharedRun("teammate", "drew", "2026-08-07", {
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    openCrew(controller({ crewData: dashboard({ runs: [ownNewer, teammate, ownOlder] }) }));

    expect(screen.getByText("2 blocks ready")).toBeInTheDocument();
    expect(screen.queryByText("Long Run · 8 MI · Aug 8")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build Now" })).toBeInTheDocument();
    expect(screen.queryByText("0 built · 3 ready")).not.toBeInTheDocument();
    expect(screen.getByText("0.0")).toBeInTheDocument();
  });

  it("does not offer a placement action for another runner's READY block", () => {
    const teammate = sharedRun("teammate", "drew", "2026-08-07", {
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    openCrew(controller({ crewData: dashboard({ runs: [teammate] }) }));
    expect(screen.queryByText("0 built · 1 ready")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Place Block|Build Now/ })).not.toBeInTheDocument();
  });

  it("opens focused placement with a gravity-computed landing and confirms through the RPC", async () => {
    const place = vi.fn(async () => true);
    const ready = sharedRun("ready-own", "zack", "2026-08-08", {
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    const user = openCrew(controller({
      crewData: dashboard({ runs: [ready] }),
      placeCrewBuildBlock: place,
    }));

    await user.click(screen.getByRole("button", { name: "Place Block" }));
    expect(screen.getByRole("list", { name: "Choose a Crew Build position" })).toBeInTheDocument();
    // Gravity already picked a landing — flush against the left edge of empty
    // ground — the same Auto Place default Personal Build uses, with no row
    // to choose.
    expect(screen.getByText("Column 1")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(place).toHaveBeenCalledWith("ready-own", 0, 1);
    expect(screen.queryByRole("list", { name: "Choose a Crew Build position" })).not.toBeInTheDocument();
  });

  it("slides the hovering block sideways with the step controls, never offering a row to pick", async () => {
    const place = vi.fn(async () => true);
    const ready = sharedRun("ready-own", "zack", "2026-08-08", {
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    const user = openCrew(controller({
      crewData: dashboard({ runs: [ready] }),
      placeCrewBuildBlock: place,
    }));

    await user.click(screen.getByRole("button", { name: "Place Block" }));
    const tower = screen.getByRole("list", { name: "Choose a Crew Build position" });
    // One landing per column, none of them a choice of course.
    const slots = within(tower).getAllByRole("button", { name: /^Place Easy/ });
    expect(slots).toHaveLength(7);
    expect(slots[0]).toHaveAccessibleName("Place Easy block in columns 1 through 2");

    await user.click(screen.getByRole("button", { name: "Move block right" }));
    expect(screen.getByText("Column 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(place).toHaveBeenCalledWith("ready-own", 0, 2);
  });

  it("keeps a block READY, shows the specific server collision message, and recomputes a fresh landing to retry", async () => {
    const place = vi.fn(async () => false);
    const ready = sharedRun("ready-own", "zack", "2026-08-08", {
      crewBuildRow: null,
      crewBuildColumnStart: null,
    });
    const user = openCrew(controller({
      crewData: dashboard({ runs: [ready] }),
      placeCrewBuildBlock: place,
      crewBuildPlacementError: "That space was just taken. Choose another spot.",
    }));
    await user.click(screen.getByRole("button", { name: "Place Block" }));
    await user.click(screen.getByRole("button", { name: "Drop" }));
    expect(screen.getByText("That space was just taken. Choose another spot.")).toBeInTheDocument();
    // The block stays in hand with a freshly recomputed gravity landing —
    // "refresh, recompute, retry" per issue #65 — rather than stranded with
    // nothing to drop.
    expect(screen.getByText("Column 1")).toBeInTheDocument();
    expect(screen.queryByText("1 built · 0 ready")).not.toBeInTheDocument();
  });

  it("offers Move Block only for the current runner's placed Crew block", async () => {
    const own = sharedRun("own", "zack", "2026-08-08", {
      crewBuildRow: 0,
      crewBuildColumnStart: 1,
    });
    const teammate = sharedRun("theirs", "drew", "2026-08-09", {
      crewBuildRow: 0,
      crewBuildColumnStart: 3,
    });
    const user = openCrew(controller({ crewData: dashboard({ runs: [own, teammate] }) }));

    await user.click(screen.getByRole("button", { name: "Zack, Easy, 4 miles, August 8" }));
    expect(within(screen.getByRole("dialog", { name: "Run Detail" })).getByRole("button", { name: "Move Block" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Close" }));
    await user.click(screen.getByRole("button", { name: "Drew, Easy, 4 miles, August 9" }));
    expect(within(screen.getByRole("dialog", { name: "Run Detail" })).queryByRole("button", { name: "Move Block" })).not.toBeInTheDocument();
  });

  /**
   * The landing, per issue #76: Crew inherits Personal Build's, marks and
   * all, rather than growing one of its own.
   */
  it("lands the block this runner just placed, using Personal Build's own marks", async () => {
    const own = sharedRun("own", "zack", "2026-08-08", {
      crewBuildRow: 0,
      crewBuildColumnStart: 1,
    });
    const user = openCrew(controller({ crewData: dashboard({ runs: [own] }) }));

    await user.click(screen.getByRole("button", { name: "Zack, Easy, 4 miles, August 8" }));
    await user.click(screen.getByRole("button", { name: "Move Block" }));
    await user.click(screen.getByRole("button", { name: "Drop" }));

    const landed = document.querySelector('[data-just-placed="true"]');
    // The same attributes Personal Build's bricks wear, on the same shared
    // `.placed-block` class, so one stylesheet rule drops both towers.
    expect(landed).toHaveClass("placed-block");
    expect(landed).toHaveAttribute("data-impact", "light");
    expect(document.querySelector(".crew-build__ground")).toHaveAttribute(
      "data-impact",
      "light",
    );
  });

  it("leaves the shared tower standing on load, sync and refresh", () => {
    // Blocks other runners placed days ago, and this runner's own placed
    // blocks, arrive already built. A refresh must never rain the crew's
    // tower back down.
    openCrew(crewWithBuild());
    expect(document.querySelector("[data-just-placed]")).toBeNull();
    expect(document.querySelector("[data-impact]")).toBeNull();
  });

  it("holds a tall construction field open under a small tower", () => {
    openCrew(crewWithBuild());
    const stage = screen.getByRole("list", { name: "Crew Build blocks" }).closest(".crew-build__stage");
    // Issue #65: six courses read as a compressed table. The field now keeps
    // real sky above a short tower, the way the Build tab does.
    expect(stage).toHaveStyle("--crew-build-visible-courses: 10");
  });

  it("builds Crew blocks out of Personal Build's own tower grid and brick faces", () => {
    openCrew(crewWithBuild());
    const tower = screen.getByRole("list", { name: "Crew Build blocks" });

    // The grid is Personal Build's `.built-tower`, not a Crew lookalike —
    // that is what supplies the shared course height and the depth padding
    // the 3D faces overhang into.
    expect(tower).toHaveClass("built-tower");
    expect(Number(tower.style.getPropertyValue("--grid-columns"))).toBe(8);

    // The tower draws real 3D faces rather than flat cards.
    expect(
      tower.querySelectorAll(".placed-block__face--top").length,
    ).toBeGreaterThan(0);
    expect(
      tower.querySelectorAll(".placed-block__face--right").length,
    ).toBeGreaterThan(0);

    // ...and culls them per neighbour, not per block. "first" sits under
    // "third" and hard against "second", so it is fully enclosed and shows
    // neither face — which is what makes connected blocks read as one mass
    // instead of a stack of separate bricks.
    const enclosed = screen
      .getByRole("button", { name: "Zack, Easy, 4 miles, August 5" })
      .closest("li")!;
    expect(enclosed.querySelector(".placed-block__face--front")).toBeInTheDocument();
    expect(
      enclosed.querySelectorAll(
        ".placed-block__face--top, .placed-block__face--right",
      ),
    ).toHaveLength(0);
  });
});

describe("Switching between crews", () => {
  function inTwoCrews(overrides: Partial<RaceCrewController> = {}) {
    const base = controller(overrides);
    return controller({
      ...overrides,
      account: {
        ...base.account!,
        memberships: [
          { crew: crewOne, role: "owner", joinedAt: "2026-08-01T00:00:00Z" },
          { crew: crewTwo, role: "member", joinedAt: "2026-09-01T00:00:00Z" },
        ],
      },
    });
  }

  it("offers no crew-switch affordance to a runner with a single crew", () => {
    openCrew();
    expect(screen.queryByRole("button", { name: /Choose crew:/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "OUC Half Crew" })).toBeInTheDocument();
  });

  it("opens a compact picker from the active Crew identity and marks the one being viewed", async () => {
    const user = openCrew(inTwoCrews());
    expect(screen.queryByRole("dialog", { name: "Choose Crew" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Choose crew: OUC Half Crew" }));
    const picker = within(screen.getByRole("dialog", { name: "Choose Crew" }));
    const crews = within(picker.getByRole("list", { name: "Your crews" }));

    expect(crews.getByRole("button", { name: /OUC Half Crew.*Current/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(crews.getByRole("button", { name: "Trail Crew" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(picker.getByRole("list", { name: "Your crews" })).toHaveClass("crew-picker__list");
  });

  it("asks the controller for the crew picked and closes the picker", async () => {
    const switchCrew = vi.fn(async () => undefined);
    const user = openCrew(inTwoCrews({ switchCrew }));

    await user.click(screen.getByRole("button", { name: "Choose crew: OUC Half Crew" }));
    await user.click(screen.getByRole("button", { name: "Trail Crew" }));
    expect(switchCrew).toHaveBeenCalledWith("crew-2");
    expect(screen.queryByRole("dialog", { name: "Choose Crew" })).not.toBeInTheDocument();
  });

  it("shows the viewed crew's own emblem beside its name", () => {
    openCrew(inTwoCrews());
    expect(document.querySelectorAll(".crew-emblem")).toHaveLength(1);
  });
});

describe("Crew page polish (issue #93)", () => {
  it("draws a Member Build card's mini tower without a technical construction grid", () => {
    openCrew();
    const card = screen.getByRole("button", { name: "Open Drew's Build" });

    expect(card.querySelector(".crew-mini-build__grid")).toBeNull();
    expect(card.querySelector(".crew-mini-build__blocks rect")).toBeInTheDocument();
    expect(card.querySelector(".crew-mini-build__ground")).toBeInTheDocument();
  });

  it("sizes the mini Build field to the tower's own course count, not a fabricated floor", () => {
    // Drew's default run is a single ground-row block (row 0, height 1), so
    // an honest field is one course tall plus modest headroom — not the old
    // 5-course minimum that dwarfed a short tower.
    openCrew();
    const card = screen.getByRole("button", { name: "Open Drew's Build" });
    expect(card.querySelector(".crew-mini-build svg")).toHaveAttribute("viewBox", "0 0 80 16");
  });

  it("keeps a short Crew Profile Build in the same fixed-height frame", async () => {
    const user = await openCrew();
    await user.click(screen.getByRole("button", { name: "Open Drew's Build" }));

    const profile = screen.getByRole("dialog", { name: "Crew Profile" });
    expect(profile.querySelector(".crew-build__stage")).toHaveStyle(
      "--crew-build-visible-courses: 10",
    );
  });

  it("orders The Crew above Recent Crew Runs", () => {
    openCrew();
    const titles = screen.getAllByRole("heading", { level: 2 }).map((heading) => heading.textContent);
    const crewIndex = titles.indexOf("The Crew");
    const recentIndex = titles.indexOf("Recent Crew Runs");

    expect(crewIndex).toBeGreaterThanOrEqual(0);
    expect(recentIndex).toBeGreaterThan(crewIndex);
  });

  it("shows crew data freshness once, beside Refresh, not repeated below the comparisons", () => {
    vi.useFakeTimers();
    try {
      // An hour after the dashboard's default summaries were loaded: stale
      // enough to surface the label, without the warning threshold.
      vi.setSystemTime(new Date("2026-08-10T15:00:00Z"));
      openCrew();

      const refreshGroup = document.querySelector(".crew-view__refresh-group");
      expect(refreshGroup).not.toBeNull();
      expect(within(refreshGroup as HTMLElement).getByText(/Updated/)).toBeInTheDocument();
      expect(
        within(refreshGroup as HTMLElement).getByRole("button", { name: "Refresh crew data" }),
      ).toBeInTheDocument();

      // Exactly one freshness label on the page, and it is not the old
      // location under the comparison rows.
      expect(screen.getAllByText(/Updated/)).toHaveLength(1);
      expect(document.querySelector(".crew-comparison")?.textContent ?? "").not.toMatch(/Updated/);
    } finally {
      vi.useRealTimers();
    }
  });

  it("treats Member Profile → Run Detail as a reversible drill-down", async () => {
    const exact = sharedRun("placed-run", "drew", "2026-08-07", {
      activityType: "intervals",
      distanceMiles: 5,
      buildRow: 6,
      buildColumnStart: 4,
    });
    const user = openCrew(
      controller({
        crewData: dashboard({
          runs: [exact],
          miniBuildRuns: [{
            id: exact.id,
            userId: exact.userId,
            localDate: exact.localDate,
            activityType: exact.activityType,
            distanceMiles: exact.distanceMiles,
            buildRow: exact.buildRow,
            buildColumnStart: exact.buildColumnStart,
          }],
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Open Drew's Build" }));
    expect(screen.getByRole("dialog", { name: "Crew Profile" })).toBeInTheDocument();

    const profile = within(screen.getByRole("dialog", { name: "Crew Profile" }));
    await user.click(
      profile.getByRole("button", { name: /Open Drew's Intervals on Friday, August 7, 5 miles/ }),
    );

    // Run Detail is the only interactive dialog while it is open: Crew
    // Profile closes rather than stacking a second modal underneath it.
    expect(screen.getByRole("dialog", { name: "Run Detail" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Crew Profile" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    // Closing Run Detail restores the same member profile rather than
    // dropping all the way back to the main Crew page.
    expect(screen.queryByRole("dialog", { name: "Run Detail" })).not.toBeInTheDocument();
    const restored = screen.getByRole("dialog", { name: "Crew Profile" });
    expect(restored.querySelector(".crew-member-profile__name")).toHaveTextContent("Drew");
  });

  it("still closes back to the main Crew page when Run Detail opens from Recent Crew Runs", async () => {
    const user = openCrew();
    await user.click(screen.getAllByRole("button", { name: /Open crew-safe run detail/ })[0]);
    expect(screen.getByRole("dialog", { name: "Run Detail" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));

    expect(screen.queryByRole("dialog", { name: "Run Detail" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Crew Profile" })).not.toBeInTheDocument();
  });
});
