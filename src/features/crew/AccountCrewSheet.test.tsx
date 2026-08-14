import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { DEFAULT_CREW_EMBLEM } from "../../crew/emblem";
import type { LoadedCrewAccount, RaceCrew } from "../../crew/types";
import type { PersonalSyncController } from "../../personal-sync/types";
import { todayLocalDate } from "../../domain/dates";
import { AccountCrewSheet } from "./AccountCrewSheet";

const ownerCrew: RaceCrew = {
  id: "crew-1",
  ownerUserId: "owner-1",
  name: "OUC Race Crew",
  crewType: "race",
  raceName: "OUC Half Marathon",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  buildStartDate: "2026-08-01",
  emblem: DEFAULT_CREW_EMBLEM,
};

const ownerAccount: LoadedCrewAccount = {
  profile: { id: "owner-1", displayName: "Owner", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  memberships: [{ crew: ownerCrew, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
  crew: ownerCrew,
  role: "owner",
  members: [
    { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-08-01T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  ],
  invites: [],
  takenAccentColors: [],
};

const memberAccount: LoadedCrewAccount = {
  ...ownerAccount,
  profile: { id: "member-1", displayName: "Member", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  role: "member",
  members: [
    ...ownerAccount.members,
    { userId: "member-1", displayName: "Member", role: "member", joinedAt: "2026-08-02T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  ],
};

const runClubCrew: RaceCrew = {
  id: "crew-club",
  ownerUserId: "owner-1",
  name: "Thursday Run Club",
  crewType: "club",
  raceName: null,
  raceDate: null,
  raceDistanceMiles: null,
  buildStartDate: "2026-08-01",
  emblem: DEFAULT_CREW_EMBLEM,
};

const runClubOwnerAccount: LoadedCrewAccount = {
  ...ownerAccount,
  memberships: [{ crew: runClubCrew, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
  crew: runClubCrew,
};

function controller(
  overrides: Partial<RaceCrewController> = {},
): RaceCrewController {
  const action = vi.fn(async () => undefined);
  return {
    configured: true,
    unavailableReason: null,
    status: "signed-out",
    busy: false,
    error: null,
    message: null,
    email: null,
    account: null,
    pendingInvite: null,
    latestInviteUrl: null,
    projectionError: null,
    crewData: null,
    crewDataStatus: "idle",
    crewDataError: null,
    propsPendingRunIds: [],
    propsErrors: {},
    crewBuildPlacementPending: false,
    crewBuildPlacementError: null,
    createAccount: action,
    signIn: action,
    signOut: action,
    saveDisplayName: action,
    saveAccentColor: vi.fn(async () => undefined),
    saveRunnerIcon: vi.fn(async () => undefined),
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
    placeCrewBuildBlock: vi.fn(async () => true),
    clearCrewBuildPlacementError: vi.fn(),
    clearMessage: vi.fn(),
    ...overrides,
  };
}

function personalSync(
  overrides: Partial<PersonalSyncController> = {},
): PersonalSyncController {
  return {
    status: "ready",
    initialized: true,
    error: null,
    message: null,
    initialization: null,
    userId: "owner-1",
    pendingCandidates: [],
    recordMutation: vi.fn(),
    recordPendingCandidates: vi.fn(),
    initializeFromThisDevice: vi.fn(async () => undefined),
    deferInitialization: vi.fn(),
    syncNow: vi.fn(async () => undefined),
    resetAccount: vi.fn(async () => undefined),
    clearMessage: vi.fn(),
    ...overrides,
  };
}

/** Opens the Crew Settings sub-sheet for whichever crew is active, from the hub. */
async function openCrewSettings(user: ReturnType<typeof userEvent.setup>, crewName: string | RegExp) {
  const list = within(screen.getByRole("list", { name: "Your crews" }));
  await user.click(list.getByRole("button", { name: crewName instanceof RegExp ? crewName : new RegExp(crewName) }));
}

describe("Account & Crew settings", () => {
  it("keeps an unconfigured build factual and non-blocking", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({
          configured: false,
          unavailableReason: "Race Crew is not configured. Personal STACK still works normally.",
          status: "unconfigured",
        })}
      />,
    );
    expect(screen.getByText("Race Crew unavailable")).toBeInTheDocument();
    expect(screen.getByText(/Personal STACK still works normally/)).toBeInTheDocument();
  });

  it("explains account sync while keeping signed-out STACK local", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller()}
      />,
    );
    expect(screen.getByRole("button", { name: "Create Account" })).toBeInTheDocument();
    expect(screen.getByLabelText("8-digit STACK PIN")).toHaveAttribute("pattern", "[0-9]{8}");
    expect(screen.getByText(/one canonical personal STACK across your devices/)).toBeInTheDocument();
    expect(screen.getByText(/Signed-out personal STACK still works locally/)).toBeInTheDocument();
  });

  it("requires an explicit first-device choice and reports the recoverable counts", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
        personalSync={personalSync({
          status: "initialization-required",
          initialized: false,
          initialization: { runCount: 12, blockCount: 8, raceName: "Fall Half" },
        })}
      />,
    );
    expect(screen.getByText(/This device has 12 runs and 8 built blocks/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use This Device's Data" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Not Now" })).toBeInTheDocument();
  });

  it("shows the canonical account state and offers an explicit Sync Now", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
        personalSync={personalSync()}
      />,
    );
    expect(screen.getByText("Saved to your STACK account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sync Now" })).toBeInTheDocument();
  });

  it("warns on a mismatched invite and joins without changing the local race", async () => {
    const joinPendingInvite = vi.fn(async () => undefined);
    const crew = controller({
      status: "signed-in",
      email: "runner@example.test",
      account: {
        profile: { id: "user-1", displayName: "Runner", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
        memberships: [],
        crew: null,
        role: null,
        members: [],
        invites: [],
        takenAccentColors: [],
      },
      pendingInvite: {
        token: "private-token",
        accountId: null,
        error: null,
        preview: {
          crewId: "crew-1",
          crewName: "OUC Half Crew",
          crewType: "race",
          raceName: "OUC Half",
          raceDate: "2026-12-05",
          raceDistanceMiles: 13.1,
          expiresAt: "2026-08-24T00:00:00Z",
          emblem: DEFAULT_CREW_EMBLEM,
          alreadyMember: false,
        },
      },
      joinPendingInvite,
    });
    const localRace = {
      name: "Another Half",
      date: "2026-12-12",
      distanceMiles: 13.1,
    };
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={localRace}
        crew={crew}
      />,
    );
    // The pending invite shows straight on the hub, with no navigation
    // required — it needs the runner's attention immediately.
    expect(screen.getByText(/current race does not match/)).toBeInTheDocument();
    expect(screen.getByText(/will not change your race or training plan/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Join Anyway" }));
    expect(joinPendingInvite).toHaveBeenCalledOnce();
    expect(localRace).toEqual({
      name: "Another Half",
      date: "2026-12-12",
      distanceMiles: 13.1,
    });
  });

  it("separates the account row from Crew-specific controls on the hub", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", email: "owner@example.test", account: ownerAccount })}
      />,
    );
    expect(screen.getByRole("button", { name: /Owner.*owner@example\.test/ })).toBeInTheDocument();
    expect(screen.getByText("Crews")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join Crew" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Crew" })).toBeInTheDocument();
    // No settings form fields leak onto the hub itself.
    expect(screen.queryByLabelText("Profile display name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Crew name")).not.toBeInTheDocument();
  });

  it("opens Edit Profile from the hub's account row, separate from Crew controls", async () => {
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", email: "owner@example.test", account: ownerAccount })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /Owner.*owner@example\.test/ }));
    expect(screen.getByRole("heading", { name: "Edit Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Profile display name")).toHaveValue("Owner");
    expect(screen.getByRole("button", { name: "Sign Out" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Your color" })).toBeInTheDocument();
    // Crew controls are not duplicated onto this sub-sheet.
    expect(screen.queryByRole("button", { name: "Edit Crew" })).not.toBeInTheDocument();
  });

  it("shows Crew management only to the owner", async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );
    await openCrewSettings(user, "OUC Race Crew");
    expect(screen.getByRole("button", { name: "Edit Crew" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Crew" })).toBeInTheDocument();

    // The sheet is already on the Crew Settings sub-view; re-rendering with a
    // different account (as happens when the controller updates) redraws the
    // same view rather than resetting navigation.
    rerender(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: memberAccount })}
      />,
    );
    expect(screen.queryByRole("button", { name: "Edit Crew" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Crew" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Leave Crew" })).toBeInTheDocument();
  });

  it("prefills and saves valid Crew edits without changing the personal race", async () => {
    const updateCrew = vi.fn(async () => true);
    const localRace = { name: "Personal Race", date: "2027-01-10", distanceMiles: 26.2 };
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={localRace}
        crew={controller({ status: "signed-in", account: ownerAccount, updateCrew })}
      />,
    );

    await openCrewSettings(user, "OUC Race Crew");
    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    expect(screen.getByLabelText("Crew name")).toHaveValue("OUC Race Crew");
    expect(screen.getByLabelText("Race name")).toHaveValue("OUC Half Marathon");
    expect(screen.getByLabelText("Race date")).toHaveValue("2026-12-05");
    expect(screen.getByLabelText("Distance (mi)")).toHaveValue(13.1);

    await user.clear(screen.getByLabelText("Crew name"));
    await user.type(screen.getByLabelText("Crew name"), "Winter Crew");
    await user.clear(screen.getByLabelText("Race name"));
    await user.type(screen.getByLabelText("Race name"), "Winter Half");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(updateCrew).toHaveBeenCalledWith({
      name: "Winter Crew",
      crewType: "race",
      raceName: "Winter Half",
      raceDate: "2026-12-05",
      raceDistanceMiles: 13.1,
      buildStartDate: "2026-08-01",
      // Untouched here, so the crew keeps the emblem it already had.
      emblem: ownerCrew.emblem,
    });
    expect(localRace).toEqual({ name: "Personal Race", date: "2027-01-10", distanceMiles: 26.2 });
  });

  it("defaults a new Crew Build start to today", async () => {
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={{ name: "OUC Half", date: "2026-12-05", distanceMiles: 13.1 }}
        crew={controller({
          status: "signed-in",
          account: {
            profile: { id: "owner-1", displayName: "Owner", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
            memberships: [],
            crew: null,
            role: null,
            members: [],
            invites: [],
            takenAccentColors: [],
          },
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create Crew" }));
    expect(screen.getByLabelText("Build starts")).toHaveValue(todayLocalDate());
  });

  it("asks Crew type first, hides race fields for a Run Club, and creates one with no race data", async () => {
    const createCrew = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({
          status: "signed-in",
          account: {
            profile: { id: "owner-1", displayName: "Owner", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
            memberships: [],
            crew: null,
            role: null,
            members: [],
            invites: [],
            takenAccentColors: [],
          },
          createCrew,
        })}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Create Crew" }));
    // Race Crew is the default, so the existing race-fields flow is unchanged.
    expect(screen.getByLabelText("Race name")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create Race Crew" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Run Club" }));
    expect(screen.queryByLabelText("Race name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Race date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Distance (mi)")).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Crew name"), "Thursday Run Club");
    await user.click(screen.getByRole("button", { name: "Create Run Club" }));

    expect(createCrew).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Thursday Run Club",
        crewType: "club",
        raceName: null,
        raceDate: null,
        raceDistanceMiles: null,
      }),
    );
  });

  it("does not expose race fields when editing a Run Club", async () => {
    const updateCrew = vi.fn(async () => true);
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: runClubOwnerAccount, updateCrew })}
      />,
    );

    await openCrewSettings(user, "Thursday Run Club");
    expect(screen.getByText("Run Club")).toBeInTheDocument();
    expect(screen.queryByText(/·.*mi$/)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    expect(screen.queryByLabelText("Race name")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Race date")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Distance (mi)")).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText("Crew name"));
    await user.type(screen.getByLabelText("Crew name"), "Friday Run Club");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(updateCrew).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Friday Run Club",
        crewType: "club",
        raceName: null,
        raceDate: null,
        raceDistanceMiles: null,
      }),
    );
  });

  it("confirms a later Build start when it removes existing Crew contributions", async () => {
    const updateCrew = vi.fn(async () => true);
    const user = userEvent.setup();
    const oldRun = {
      id: "run-1",
      userId: "owner-1",
      displayName: "Owner",
      accentColor: null,
      runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
      localDate: "2026-08-05",
      activityType: "easy" as const,
      distanceMiles: 3,
      durationSeconds: 1800,
      createdAt: "2026-08-05T12:00:00Z",
      updatedAt: "2026-08-05T12:00:00Z",
      buildRow: null,
      buildColumnStart: null,
      crewBuildRow: null,
      crewBuildColumnStart: null,
      crewBuildPlacedAt: null,
      propsCount: 0,
      viewerHasPropped: false,
    };
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({
          status: "signed-in",
          account: ownerAccount,
          updateCrew,
          crewData: {
            members: ownerAccount.members,
            summaries: [],
            runs: [oldRun],
            miniBuildRuns: [],
            crewBuildRuns: [],
            sharedRunsAvailable: true,
            sharedRunsTruncated: false,
            propsAvailable: true,
            loadedAt: "2026-08-12T00:00:00Z",
          },
        })}
      />,
    );

    await openCrewSettings(user, "OUC Race Crew");
    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    await user.clear(screen.getByLabelText("Build starts"));
    await user.type(screen.getByLabelText("Build starts"), "2026-08-10");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(screen.getByText(/pull contributions before that date off the shared Crew Build/)).toBeInTheDocument();
    expect(updateCrew).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Change Build Start" }));
    expect(updateCrew).toHaveBeenCalledWith(expect.objectContaining({ buildStartDate: "2026-08-10" }));
  });

  it("rejects blank names and invalid distance before calling the backend", async () => {
    const updateCrew = vi.fn(async () => true);
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount, updateCrew })}
      />,
    );
    await openCrewSettings(user, "OUC Race Crew");
    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    await user.clear(screen.getByLabelText("Crew name"));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Enter a Crew name");
    expect(updateCrew).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Crew name"), "OUC Race Crew");
    await user.clear(screen.getByLabelText("Distance (mi)"));
    await user.type(screen.getByLabelText("Distance (mi)"), "0");
    await user.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(screen.getByRole("alert")).toHaveTextContent("valid race distance");
    expect(updateCrew).not.toHaveBeenCalled();
  });

  it("requires confirmation and supports cancelling Crew deletion, returning to the hub once deleted", async () => {
    const deleteCrew = vi.fn(async () => true);
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount, deleteCrew })}
      />,
    );

    await openCrewSettings(user, "OUC Race Crew");
    await user.click(screen.getByRole("button", { name: "Delete Crew" }));
    expect(screen.getByRole("heading", { name: "Delete OUC Race Crew?" })).toBeInTheDocument();
    expect(screen.getByText(/shared data for everyone/)).toBeInTheDocument();
    expect(deleteCrew).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteCrew).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Edit Crew" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete Crew" }));
    await user.click(screen.getByRole("button", { name: "Delete Crew" }));
    expect(deleteCrew).toHaveBeenCalledOnce();
    // A crew that no longer exists has nothing left to configure here.
    expect(await screen.findByRole("heading", { name: "Account & Crew" })).toBeInTheDocument();
  });

  it("shows all 16 colors, marks the current pick, and greys out ones crewmates already wear", async () => {
    const saveAccentColor = vi.fn(async () => undefined);
    const account: LoadedCrewAccount = {
      ...memberAccount,
      profile: { id: "member-1", displayName: "Member", accentColor: "aqua", runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
      members: [
        { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-08-01T00:00:00Z", accentColor: "magenta", runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
        { userId: "member-1", displayName: "Member", role: "member", joinedAt: "2026-08-02T00:00:00Z", accentColor: "aqua", runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
      ],
      // Spans every crew this account is in, not only the one on screen.
      takenAccentColors: ["magenta"],
    };
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account, saveAccentColor })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Member\b/ }));

    const picker = screen.getByRole("list", { name: "Your color" });
    expect(within(picker).getAllByRole("button")).toHaveLength(16);

    // The runner's own pick is marked current, not disabled — clicking it
    // again is a harmless no-op rather than something the picker refuses.
    const current = within(picker).getByRole("button", { name: /your current color/ });
    expect(current).toHaveAccessibleName(/^Aqua/);
    expect(current).toHaveAttribute("aria-pressed", "true");
    expect(current).not.toBeDisabled();

    // A crewmate's color — explicit or not — is unavailable before the
    // database's own uniqueness check ever has to reject it.
    const taken = within(picker).getByRole("button", { name: /taken by another crew member/ });
    expect(taken).toHaveAccessibleName(/^Magenta/);
    expect(taken).toBeDisabled();

    await user.click(within(picker).getByRole("button", { name: "Green" }));
    expect(saveAccentColor).toHaveBeenCalledWith("green");
  });

  it("does not grey out a color once nobody else wears it", async () => {
    // A departed member's color frees up rather than staying reserved
    // forever: "taken" is read live off the current roster, not a history.
    const account: LoadedCrewAccount = {
      ...ownerAccount,
      profile: { id: "owner-1", displayName: "Owner", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
      members: [
        { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-08-01T00:00:00Z", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
      ],
    };
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Owner\b/ }));

    const picker = screen.getByRole("list", { name: "Your color" });
    expect(within(picker).queryAllByRole("button", { name: /taken/ })).toHaveLength(0);
  });
});

const secondCrew: RaceCrew = {
  id: "crew-2",
  ownerUserId: "friend-1",
  name: "Trail Crew",
  crewType: "race",
  raceName: "Ridge 50K",
  raceDate: "2027-04-10",
  raceDistanceMiles: 31,
  buildStartDate: "2026-11-01",
  emblem: DEFAULT_CREW_EMBLEM,
};

const twoCrewAccount: LoadedCrewAccount = {
  ...ownerAccount,
  memberships: [
    { crew: ownerCrew, role: "owner", joinedAt: "2026-08-01T00:00:00Z" },
    { crew: secondCrew, role: "member", joinedAt: "2026-09-01T00:00:00Z" },
  ],
};

describe("Belonging to more than one crew", () => {
  it("offers Create Crew as an addition, never a replacement for the first", async () => {
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );

    expect(screen.queryByLabelText("Crew name")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Crew" }));
    expect(screen.getByText("Create a private crew")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Crew emblem preview" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Create a private crew")).not.toBeInTheDocument();
  });

  it("lists every crew once on the hub and switches to the one the runner picks", async () => {
    const switchCrew = vi.fn(async () => undefined);
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: twoCrewAccount, switchCrew })}
      />,
    );

    const list = within(screen.getByRole("list", { name: "Your crews" }));
    expect(list.getAllByRole("button")).toHaveLength(2);
    const active = list.getByRole("button", { name: /OUC Race Crew/ });
    expect(active).toHaveAttribute("aria-pressed", "true");
    // The active crew is represented once here, not repeated elsewhere.
    expect(screen.queryByText("Crew you are viewing")).not.toBeInTheDocument();
    expect(screen.queryByText("Your Race Crew")).not.toBeInTheDocument();

    await user.click(list.getByRole("button", { name: /Trail Crew/ }));
    expect(switchCrew).toHaveBeenCalledWith("crew-2");
  });

  it("still lists a single crew on the hub, as the one way to reach Crew Settings", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );

    const list = within(screen.getByRole("list", { name: "Your crews" }));
    expect(list.getAllByRole("button")).toHaveLength(1);
  });
});

describe("Crew emblems", () => {
  it("saves the emblem the owner designed along with the rest of the Crew", async () => {
    const updateCrew = vi.fn(async () => true);
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount, updateCrew })}
      />,
    );

    await openCrewSettings(user, "OUC Race Crew");
    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    await user.click(screen.getByRole("button", { name: "Edit Emblem" }));
    await user.click(screen.getByRole("button", { name: "Next core shape" }));
    await user.click(screen.getByRole("button", { name: "Done" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(updateCrew).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "OUC Race Crew",
        emblem: {
          ...DEFAULT_CREW_EMBLEM,
          middle: {
            ...DEFAULT_CREW_EMBLEM.middle,
            shape: DEFAULT_CREW_EMBLEM.middle.shape + 1,
          },
        },
      }),
    );
  });

  it("keeps all four compact controls in the dedicated editor without presets", async () => {
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );

    await openCrewSettings(user, "OUC Race Crew");
    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    expect(screen.getByRole("img", { name: "Current crew emblem" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Crew emblem preview" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Edit Emblem" }));
    expect(screen.getByRole("heading", { name: "Edit Emblem" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Crew emblem preview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous crown shape" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous core shape" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous base shape" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous frame shape" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "TOTEM" })).not.toBeInTheDocument();
  });
});

describe("Runner Icon editor", () => {
  const iconAccount: LoadedCrewAccount = {
    ...memberAccount,
    profile: {
      id: "member-1",
      displayName: "Member",
      accentColor: "aqua",
      runnerIcon: { head: 1, face: 2, body: 3, flair: 0, background: 0 },
    },
  };

  async function openEditor(
    overrides: Partial<RaceCrewController> = {},
    account: LoadedCrewAccount = iconAccount,
  ) {
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account, ...overrides })}
      />,
    );
    await user.click(screen.getByRole("button", { name: /^Member\b/ }));
    await user.click(screen.getByRole("button", { name: /Runner Icon/ }));
    return user;
  }

  /**
   * The editor's one promise: the icon and every option that could change it
   * are on the same screen. Five parts of six options is thirty tiles, and
   * all thirty are reachable without a carousel, a name, or a second view.
   */
  it("puts the whole library on one screen with the mark being built", async () => {
    await openEditor();
    expect(screen.getByRole("heading", { name: "Runner Icon" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Runner Icon preview" })).toBeInTheDocument();
    for (const part of ["Head", "Face", "Body", "Flair", "Backdrop"]) {
      const group = screen.getByRole("group", { name: part });
      expect(within(group).getAllByRole("button")).toHaveLength(6);
    }
    // Shapes are the choice; nothing is labelled on screen with a part name.
    expect(screen.queryByText("Twin Peak")).not.toBeInTheDocument();
    expect(screen.queryByText("Chest Band")).not.toBeInTheDocument();
    // The retired option is not one of the six offered for flair.
    expect(
      screen.queryByRole("button", { name: /Side Stripe/ }),
    ).not.toBeInTheDocument();
  });

  it("marks the runner's current option in every part", async () => {
    const user = await openEditor();
    const heads = screen.getByRole("group", { name: "Head" });
    // The account opens on head 1, the Visor.
    expect(within(heads).getByRole("button", { name: /^Visor/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await user.click(within(heads).getByRole("button", { name: /^Twin Peak/ }));
    expect(within(heads).getByRole("button", { name: /^Twin Peak/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(heads).getByRole("button", { name: /^Visor/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("saves the drafted icon, and only once it differs from the saved one", async () => {
    const saveRunnerIcon = vi.fn(async () => undefined);
    const user = await openEditor({ saveRunnerIcon });

    // Nothing changed yet, so there is nothing to save.
    expect(screen.getByRole("button", { name: "Save Icon" })).toBeDisabled();

    const backdrops = screen.getByRole("group", { name: "Backdrop" });
    await user.click(within(backdrops).getByRole("button", { name: /^Shield/ }));
    const save = screen.getByRole("button", { name: "Save Icon" });
    expect(save).toBeEnabled();
    await user.click(save);
    expect(saveRunnerIcon).toHaveBeenCalledWith({
      head: 1,
      face: 2,
      body: 3,
      flair: 0,
      background: 3,
    });
  });

  it("draws a random but valid icon from Surprise Me", async () => {
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: /Surprise Me/ }));
    expect(screen.getByRole("img", { name: "Runner Icon preview" })).toBeInTheDocument();
    // Whatever it landed on is a real option in every part, so every part
    // still has exactly one of its six tiles pressed.
    for (const part of ["Head", "Face", "Body", "Flair", "Backdrop"]) {
      const group = screen.getByRole("group", { name: part });
      const pressed = within(group)
        .getAllByRole("button")
        .filter((button) => button.getAttribute("aria-pressed") === "true");
      expect(pressed).toHaveLength(1);
    }
  });

  /**
   * One identity color, not two. The editor shows the member accent picker
   * itself rather than offering a separate avatar color, so a runner cannot
   * end up with an icon that disagrees with their Crew Build blocks.
   */
  it("colors the icon from the member accent picker, with no second color control", async () => {
    const saveAccentColor = vi.fn(async () => undefined);
    const user = await openEditor({ saveAccentColor });

    const picker = screen.getByRole("list", { name: "Your color" });
    expect(within(picker).getAllByRole("button")).toHaveLength(16);
    expect(screen.getAllByRole("list", { name: /color/i })).toHaveLength(1);

    await user.click(within(picker).getByRole("button", { name: "Green" }));
    expect(saveAccentColor).toHaveBeenCalledWith("green");
  });

  it("goes back to Edit Profile rather than all the way out", async () => {
    const user = await openEditor();
    await user.click(screen.getByRole("button", { name: "Back to Edit Profile" }));
    expect(screen.getByRole("heading", { name: "Edit Profile" })).toBeInTheDocument();
  });
});

describe("Join Crew", () => {
  it("explains how to join when there is no invite link in hand yet", async () => {
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Join Crew" }));
    expect(screen.getByRole("heading", { name: "Join Crew" })).toBeInTheDocument();
    expect(screen.getByText(/Ask a crew owner for their private invite link/)).toBeInTheDocument();
  });
});
