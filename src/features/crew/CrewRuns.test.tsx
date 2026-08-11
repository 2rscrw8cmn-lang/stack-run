import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import type {
  CrewDashboardData,
  CrewMember,
  CrewMemberSummary,
  CrewSharedRun,
} from "../../crew/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import type { RunLog } from "../../domain/types";
import { RunsScreen } from "../runs/RunsScreen";

const plan = loadSeedPlan();
const TODAY = "2026-08-10";

const members: CrewMember[] = [
  { userId: "zack", displayName: "Zack", role: "owner", joinedAt: "2026-08-01T00:00:00Z" },
  { userId: "drew", displayName: "Drew", role: "member", joinedAt: "2026-08-02T00:00:00Z" },
  { userId: "travis", displayName: "Travis", role: "member", joinedAt: "2026-08-03T00:00:00Z" },
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
    localDate,
    activityType: "easy",
    distanceMiles: 4,
    durationSeconds: 2352,
    createdAt: `${localDate}T14:00:00Z`,
    updatedAt: `${localDate}T14:00:00Z`,
    buildRow: 0,
    buildColumnStart: 1,
    propsCount: 0,
    viewerHasPropped: false,
    ...values,
  };
}

function dashboard(overrides: Partial<CrewDashboardData> = {}): CrewDashboardData {
  const runs = [
    sharedRun("new", "drew", "2026-08-09", {
      activityType: "long",
      distanceMiles: 6.1,
      durationSeconds: 3522,
    }),
    sharedRun("old", "travis", "2026-08-08"),
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
    runs,
    miniBuildRuns: runs.map(({ id, userId, localDate, activityType, distanceMiles, buildRow, buildColumnStart }) => ({
      id,
      userId,
      localDate,
      activityType,
      distanceMiles,
      buildRow,
      buildColumnStart,
    })),
    sharedRunsAvailable: true,
    propsAvailable: true,
    loadedAt: "2026-08-10T14:00:00Z",
    ...overrides,
  };
}

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
      profile: { id: "zack", displayName: "Zack" },
      crew: {
        id: "crew-1",
        ownerUserId: "zack",
        name: "OUC Half Crew",
        raceName: "Half Marathon",
        raceDate: "2026-12-05",
        raceDistanceMiles: 13.1,
      },
      role: "owner",
      members,
      invites: [],
    },
    pendingInvite: null,
    latestInviteUrl: null,
    projectionError: null,
    crewData: dashboard(),
    crewDataStatus: "ready",
    crewDataError: null,
    propsPendingRunIds: [],
    propsErrors: {},
    createAccount: action,
    signIn: action,
    signOut: action,
    saveDisplayName: action,
    createCrew: action,
    createInvite: action,
    revokeInvite: action,
    joinPendingInvite: action,
    leaveCrew: action,
    removeMember: action,
    refreshCrewData: action,
    toggleProps: action,
    clearMessage: vi.fn(),
    ...overrides,
  };
}

function personalRun(): RunLog {
  return {
    id: "private-run",
    workoutId: null,
    completedDate: "2026-08-09",
    activityType: "easy",
    distanceMiles: 5,
    durationSeconds: 2700,
    effort: "great",
    notes: "Private personal note",
    createdAt: "2026-08-09T12:00:00Z",
    updatedAt: "2026-08-09T12:00:00Z",
    importedMetrics: { averageHeartRate: 155, trainingLoad: 72 },
  };
}

async function openCrew(crew = controller(), runLogs: RunLog[] = [personalRun()]) {
  const user = userEvent.setup();
  render(
    <RunsScreen
      plan={plan}
      runLogs={runLogs}
      today={TODAY}
      raceCrew={crew}
      onOpenAccountCrew={vi.fn()}
    />,
  );
  await user.click(screen.getByRole("tab", { name: "Crew" }));
  return user;
}

describe("Runs You / Crew context", () => {
  it("defaults to You, preserves personal Runs, and switches locally with tab semantics", async () => {
    const user = userEvent.setup();
    render(
      <RunsScreen plan={plan} runLogs={[personalRun()]} today={TODAY} raceCrew={controller()} />,
    );

    expect(screen.getByRole("tab", { name: "You" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("heading", { name: "Training Signals" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Recent Runs" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Run" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Crew" }));
    expect(screen.queryByRole("heading", { name: "Training Signals" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Log Run" })).not.toBeInTheDocument();
    expect(screen.getByText("OUC Half Crew")).toBeInTheDocument();

    const crewTab = screen.getByRole("tab", { name: "Crew" });
    crewTab.focus();
    await user.keyboard("{ArrowLeft}");
    expect(screen.getByRole("tab", { name: "You" })).toHaveFocus();
    expect(screen.getByRole("heading", { name: "Training Signals" })).toBeInTheDocument();
  });

  it("shows the intentional signed-out state", async () => {
    const signedOut = controller({ status: "signed-out", account: null, crewData: null });
    await openCrew(signedOut, []);
    expect(screen.getByText("Sign in to see your crew.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account & Crew" })).toBeInTheDocument();
  });

  it("shows the intentional no-crew state", async () => {
    const noCrew = controller({
      account: {
        profile: { id: "zack", displayName: "Zack" },
        crew: null,
        role: null,
        members: [],
        invites: [],
      },
      crewData: null,
    });
    await openCrew(noCrew, []);
    expect(screen.getByText("Join or create a crew to train with friends.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account & Crew" })).toBeInTheDocument();
  });

  it("shows a retryable unavailable state when Supabase is not configured", async () => {
    await openCrew(
      controller({
        configured: false,
        status: "unconfigured",
        account: null,
        crewData: null,
      }),
      [],
    );
    expect(screen.getByText("Crew data unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();
  });

  it("keeps You usable when the Crew query fails", async () => {
    const user = await openCrew(
      controller({ crewData: null, crewDataStatus: "error", crewDataError: "Network down" }),
    );
    expect(screen.getByText("Crew data unavailable")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try Again" })).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "You" }));
    expect(screen.getByRole("heading", { name: "Recent Runs" })).toBeInTheDocument();
    expect(screen.queryByText("Private personal note")).not.toBeInTheDocument();
  });

  it("keeps comparisons available when only shared-run/Mini Build loading fails", async () => {
    await openCrew(
      controller({
        crewData: dashboard({
          runs: [],
          miniBuildRuns: [],
          sharedRunsAvailable: false,
          propsAvailable: false,
        }),
      }),
    );

    expect(screen.getByRole("list", { name: "Weekly Miles comparison" })).toBeInTheDocument();
    expect(screen.getByText("Recent crew runs unavailable.")).toBeInTheDocument();
    expect(screen.getByText("Mini Builds unavailable.")).toBeInTheDocument();
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
          }),
        }),
        [],
      );

      const comparison = screen.getByRole("list", {
        name: "Weekly Miles comparison",
      });
      expect(within(comparison).getAllByRole("listitem")).toHaveLength(memberCount);
      expect(within(comparison).getAllByText("0 MI")).toHaveLength(memberCount);
    },
  );

  it("shows crew identity, member count, one-member encouragement, and empty runs", async () => {
    const solo = members.slice(0, 1);
    await openCrew(
      controller({
        account: {
          ...controller().account!,
          members: solo,
        },
        crewData: dashboard({ members: solo, summaries: [summary("zack")], runs: [] }),
      }),
      [],
    );

    expect(
      screen.getByText("Dec 5 · Half Marathon · 13.1 MI · 1 runner"),
    ).toBeInTheDocument();
    expect(screen.getByText("Invite your crew to start comparing training.")).toBeInTheDocument();
    expect(screen.getByText("No crew runs yet.")).toBeInTheDocument();
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

    await user.click(screen.getByRole("tab", { name: "Consistency" }));
    expect(screen.getByText("88%")).toBeInTheDocument();
    expect(screen.getByText("14 / 16")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("12 / 16")).toBeInTheDocument();
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("0%")).not.toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Miles Built" }));
    rows = within(
      screen.getByRole("list", { name: "Miles Built comparison" }),
    ).getAllByRole("listitem");
    expect(rows.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Drew"),
      expect.stringContaining("Zack"),
      expect.stringContaining("Travis"),
    ]);
    expect(screen.queryByRole("combobox", { name: "Comparison metric" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh crew data" })).toHaveTextContent("");
  });

  it("shows recent crew runs newest first and derives pace", async () => {
    await openCrew();
    const runButtons = screen.getAllByRole("button", { name: /Open crew-safe run detail/ });
    expect(runButtons[0]).toHaveAccessibleName(expect.stringContaining("Sunday, August 9"));
    expect(runButtons[1]).toHaveAccessibleName(expect.stringContaining("Saturday, August 8"));
    expect(runButtons[0]).toHaveTextContent("9:37 /mi");
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

  it("renders stable member-ordered Mini Builds from activity-colored shared blocks", async () => {
    await openCrew();
    const rail = screen.getByRole("list", { name: "Crew Mini Builds" });
    const cards = within(rail).getAllByRole("listitem");

    expect(cards).toHaveLength(3);
    expect(cards[0]).toHaveTextContent("Zack");
    expect(cards[0]).toHaveTextContent("You");
    expect(cards[0]).toHaveTextContent("122.0 MI BUILT");
    expect(cards[0]).toHaveTextContent("No blocks yet.");
    expect(cards[1]).toHaveTextContent("Drew");
    expect(cards[1].querySelector('rect[data-type="long"]')).toBeInTheDocument();
    expect(cards[1]).toHaveAttribute("data-member-color");
    expect(screen.getByText("Each runner's shared Build.")).toBeInTheDocument();
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

    const build = within(screen.getByRole("dialog", { name: "Member Build" }));
    expect(build.getByText("Drew")).toBeInTheDocument();
    expect(build.getByText(/140\.0/)).toBeInTheDocument();
    const block = build.getByRole("button", {
      name: /Open Drew's Intervals on Friday, August 7, 5 miles/,
    });
    expect(block.closest("li")).toHaveAttribute("data-row", "6");
    expect(block.closest("li")).toHaveAttribute("data-column-start", "4");

    await user.click(block);
    expect(screen.getByRole("dialog", { name: "Run Detail" })).toBeInTheDocument();
    expect(screen.getByText("5 MI")).toBeInTheDocument();
  });

  it("keeps Member Build cards keyboard reachable and opens with Enter", async () => {
    const user = await openCrew();
    const card = screen.getByRole("button", { name: "Open Zack's Build" });
    card.focus();
    expect(card).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Member Build" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Member Build" })).not.toBeInTheDocument();
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
