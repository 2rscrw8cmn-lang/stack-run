import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RaceCrewController } from "../crew/useRaceCrew";
import { DEFAULT_CREW_EMBLEM } from "../crew/emblem";
import type { CrewDashboardData, LoadedCrewAccount, RaceCrew } from "../crew/types";

const action = vi.fn(async () => undefined);

const members = [
  { userId: "zack", displayName: "Zack", role: "owner" as const, joinedAt: "2026-08-01T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  { userId: "drew", displayName: "Drew", role: "member" as const, joinedAt: "2026-08-02T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
];

const raceCrew: RaceCrew = {
  id: "crew-1",
  ownerUserId: "zack",
  name: "OUC Race Crew",
  crewType: "race",
  raceName: "Half Marathon",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  buildStartDate: "2026-08-01",
  emblem: DEFAULT_CREW_EMBLEM,
};

const account: LoadedCrewAccount = {
  profile: {
    id: "zack",
    displayName: "Zack",
    accentColor: null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    propsSeenAt: "2026-08-04T12:00:00Z",
  },
  memberships: [{ crew: raceCrew, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
  crew: raceCrew,
  role: "owner",
  members,
  invites: [],
  takenAccentColors: [],
};

const crewData: CrewDashboardData = {
  members,
  summaries: [],
  runs: [],
  miniBuildRuns: [],
  crewBuildRuns: [],
  sharedRunsAvailable: true,
  sharedRunsTruncated: false,
  propsAvailable: true,
  propNotifications: [],
  loadedAt: "2026-08-04T12:00:00Z",
};

function controller(overrides: Partial<RaceCrewController> = {}): RaceCrewController {
  return {
    configured: true,
    unavailableReason: null,
    status: "signed-in",
    busy: false,
    error: null,
    message: null,
    email: "zack@example.test",
    account,
    pendingInvite: null,
    latestInviteUrl: null,
    projectionError: null,
    crewData,
    crewDataStatus: "ready",
    crewDataError: null,
    propsPendingRunIds: [],
    propsErrors: {},
    unreadPropNotifications: [],
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
    placeCrewBuildBlock: vi.fn(async () => true),
    clearCrewBuildPlacementError: vi.fn(),
    clearMessage: vi.fn(),
    ...overrides,
  };
}

/** Flipped between renders to move the account in and out of a crew. */
let current: RaceCrewController = controller();

vi.mock("../crew/useRaceCrew", () => ({
  useRaceCrew: () => current,
}));

const { App } = await import("./App");

const signedOut = controller({ status: "signed-out", account: null, crewData: null });
const noCrew = controller({
  account: { ...account, crew: null, role: null, members: [], invites: [] },
  crewData: null,
});

function navLabels() {
  return within(screen.getByRole("navigation", { name: "Primary" }))
    .getAllByRole("button")
    .map((tab) => tab.textContent);
}

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("stack.onboarding.v1", JSON.stringify({
    version: 1,
    introSeen: true,
    coreTourCompleted: true,
    crewTourSeen: true,
  }));
  current = controller();
});

describe("The runner's icon in the app header", () => {
  /**
   * The mark stands beside the gear as the account affordance — the same icon
   * this runner's crewmates see. It is a button, not decoration, so it needs a
   * real name; the icon itself stays decorative inside it.
   */
  it("shows the signed-in runner's icon next to Settings", () => {
    render(<App />);
    const runner = screen.getByRole("button", { name: /^Zack\. Account & Crew\.$/ });
    expect(runner.querySelector(".runner-icon")).not.toBeNull();
    expect(runner.querySelector(".runner-icon")).toHaveAttribute("aria-hidden", "true");
    // It joins the existing header row rather than adding one.
    expect(runner.closest(".app-shell__header-row")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("rings the runner's icon when a teammate's Props are unread", () => {
    const unread = [
      {
        id: "run-1:drew",
        runId: "run-1",
        runLocalDate: "2026-08-04",
        runActivityType: "long" as const,
        runDistanceMiles: 6.1,
        actorUserId: "drew",
        actorDisplayName: "Drew",
        actorAccentColor: null,
        actorRunnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
        createdAt: "2026-08-05T00:00:00Z",
      },
    ];
    current = controller({
      crewData: { ...crewData, propNotifications: unread },
      unreadPropNotifications: unread,
    });
    render(<App />);
    const runner = screen.getByRole("button", { name: /New Props received\.$/ });
    expect(runner).toHaveAttribute("data-unread", "true");
  });

  it("shows no runner mark when nobody is signed in", () => {
    current = signedOut;
    render(<App />);
    expect(screen.queryByRole("button", { name: /Account & Crew\.$/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Settings" })).toBeInTheDocument();
  });

  it("opens Account & Crew directly, and closes back to the app rather than into Settings", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: /^Zack\. Account & Crew\.$/ }));
    expect(await screen.findByRole("heading", { name: "Account & Crew" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    // Opened from the header, so dismissing it does not strand the runner in
    // Settings — a sheet they never asked for.
    expect(screen.queryByRole("heading", { name: "Settings" })).not.toBeInTheDocument();
  });
});

describe("Crew as a conditional destination", () => {
  it("offers five destinations in order to an active crew member", () => {
    render(<App />);
    expect(navLabels()).toEqual(["Today", "Build", "Runs", "Crew", "Plan"]);
  });

  it("offers the original four destinations to a runner with no crew", () => {
    current = noCrew;
    render(<App />);
    expect(navLabels()).toEqual(["Today", "Build", "Runs", "Plan"]);
  });

  it("offers the original four destinations when signed out", () => {
    current = signedOut;
    render(<App />);
    expect(navLabels()).toEqual(["Today", "Build", "Runs", "Plan"]);
  });

  it("opens the Crew destination from the Crew tab", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Crew" }));
    expect(screen.getByRole("button", { name: "Crew" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("heading", { level: 1, name: "OUC Race Crew" })).toBeInTheDocument();
    expect(screen.getByText("Crew Build")).toBeInTheDocument();
  });

  it("introduces Crew once for a member who has not seen it", async () => {
    localStorage.setItem("stack.onboarding.v1", JSON.stringify({
      version: 1,
      introSeen: true,
      coreTourCompleted: true,
      crewTourSeen: false,
    }));
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Crew" }));
    expect(screen.getByRole("dialog", { name: "Crew" })).toHaveTextContent(
      "You place the blocks you earn",
    );
    await user.click(screen.getByRole("button", { name: "Got It" }));
    await user.click(screen.getByRole("button", { name: "Runs" }));
    await user.click(screen.getByRole("button", { name: "Crew" }));
    expect(screen.queryByRole("dialog", { name: "Crew" })).not.toBeInTheDocument();
  });

  it("leaves Runs personal, with no crew context and no second crew surface", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Runs" }));
    expect(screen.queryByRole("tablist", { name: "Runs context" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "You" })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Crew" })).not.toBeInTheDocument();
    expect(screen.queryByText("Crew Build")).not.toBeInTheDocument();
    expect(screen.queryByText("Recent Crew Runs")).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Member Builds" })).not.toBeInTheDocument();
    expect(screen.getByText("Nothing recorded yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log Run" })).toBeInTheDocument();
  });

  it("falls back to Runs when membership disappears while Crew is open", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Crew" }));
    expect(screen.getByText("Crew Build")).toBeInTheDocument();

    await act(async () => {
      current = noCrew;
      rerender(<App />);
      await Promise.resolve();
    });

    expect(navLabels()).toEqual(["Today", "Build", "Runs", "Plan"]);
    expect(screen.getByRole("button", { name: "Runs" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Log Run" })).toBeInTheDocument();
    expect(screen.queryByText("Crew Build")).not.toBeInTheDocument();
  });

  it("falls back to Runs on sign-out, and restores Crew on sign-in", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<App />);

    await user.click(screen.getByRole("button", { name: "Crew" }));
    await act(async () => {
      current = signedOut;
      rerender(<App />);
      await Promise.resolve();
    });
    expect(navLabels()).toEqual(["Today", "Build", "Runs", "Plan"]);
    expect(screen.getByRole("button", { name: "Runs" })).toHaveAttribute("aria-current", "page");

    current = controller();
    rerender(<App />);
    expect(navLabels()).toEqual(["Today", "Build", "Runs", "Crew", "Plan"]);
    // The invalid selection was not remembered: signing back in restores the
    // destination, not the screen the user was thrown off.
    expect(screen.getByRole("button", { name: "Runs" })).toHaveAttribute("aria-current", "page");
  });
});
