import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { CREW_EMBLEM_PRESETS, DEFAULT_CREW_EMBLEM } from "../../crew/emblem";
import type { LoadedCrewAccount, RaceCrew } from "../../crew/types";
import { todayLocalDate } from "../../domain/dates";
import { AccountCrewSheet } from "./AccountCrewSheet";

const ownerCrew: RaceCrew = {
  id: "crew-1",
  ownerUserId: "owner-1",
  name: "OUC Race Crew",
  raceName: "OUC Half Marathon",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  buildStartDate: "2026-08-01",
  emblem: DEFAULT_CREW_EMBLEM,
};

const ownerAccount: LoadedCrewAccount = {
  profile: { id: "owner-1", displayName: "Owner", accentColor: null },
  memberships: [{ crew: ownerCrew, role: "owner", joinedAt: "2026-08-01T00:00:00Z" }],
  crew: ownerCrew,
  role: "owner",
  members: [
    { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-08-01T00:00:00Z", accentColor: null },
  ],
  invites: [],
  takenAccentColors: [],
};

const memberAccount: LoadedCrewAccount = {
  ...ownerAccount,
  profile: { id: "member-1", displayName: "Member", accentColor: null },
  role: "member",
  members: [
    ...ownerAccount.members,
    { userId: "member-1", displayName: "Member", role: "member", joinedAt: "2026-08-02T00:00:00Z", accentColor: null },
  ],
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
    createCrew: action,
    updateCrew: vi.fn(async () => true),
    deleteCrew: vi.fn(async () => true),
    switchCrew: action,
    createInvite: action,
    revokeInvite: action,
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

  it("offers create/sign-in without suggesting personal cloud sync", () => {
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
    expect(screen.getByText(/plan, runs and Build stay on this device/)).toBeInTheDocument();
  });

  it("warns on a mismatched invite and joins without changing the local race", async () => {
    const joinPendingInvite = vi.fn(async () => undefined);
    const crew = controller({
      status: "signed-in",
      email: "runner@example.test",
      account: {
        profile: { id: "user-1", displayName: "Runner", accentColor: null },
        memberships: [],
        crew: null,
        role: null,
        members: [],
        invites: [],
        takenAccentColors: [],
      },
      pendingInvite: {
        token: "private-token",
        error: null,
        preview: {
          crewId: "crew-1",
          crewName: "OUC Half Crew",
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

  it("shows Crew management only to the owner", () => {
    const { rerender } = render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );
    expect(screen.getByRole("button", { name: "Edit Crew" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Crew" })).toBeInTheDocument();

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
      raceName: "Winter Half",
      raceDate: "2026-12-05",
      raceDistanceMiles: 13.1,
      buildStartDate: "2026-08-01",
      // Untouched here, so the crew keeps the emblem it already had.
      emblem: ownerCrew.emblem,
    });
    expect(localRace).toEqual({ name: "Personal Race", date: "2027-01-10", distanceMiles: 26.2 });
  });

  it("defaults a new Crew Build start to today", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={{ name: "OUC Half", date: "2026-12-05", distanceMiles: 13.1 }}
        crew={controller({
          status: "signed-in",
          account: {
            profile: { id: "owner-1", displayName: "Owner", accentColor: null },
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

    expect(screen.getByLabelText("Build starts")).toHaveValue(todayLocalDate());
  });

  it("confirms a later Build start when it removes existing Crew contributions", async () => {
    const updateCrew = vi.fn(async () => true);
    const user = userEvent.setup();
    const oldRun = {
      id: "run-1",
      userId: "owner-1",
      displayName: "Owner",
      accentColor: null,
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

  it("requires confirmation and supports cancelling Crew deletion", async () => {
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
  });

  it("shows all 16 colors, marks the current pick, and greys out ones crewmates already wear", async () => {
    const saveAccentColor = vi.fn(async () => undefined);
    const account: LoadedCrewAccount = {
      ...memberAccount,
      profile: { id: "member-1", displayName: "Member", accentColor: "aqua" },
      members: [
        { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-08-01T00:00:00Z", accentColor: "magenta" },
        { userId: "member-1", displayName: "Member", role: "member", joinedAt: "2026-08-02T00:00:00Z", accentColor: "aqua" },
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
      profile: { id: "owner-1", displayName: "Owner", accentColor: null },
      members: [
        { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-08-01T00:00:00Z", accentColor: null },
      ],
    };
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account })}
      />,
    );

    const picker = screen.getByRole("list", { name: "Your color" });
    expect(within(picker).queryAllByRole("button", { name: /taken/ })).toHaveLength(0);
  });
});

const secondCrew: RaceCrew = {
  id: "crew-2",
  ownerUserId: "friend-1",
  name: "Trail Crew",
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
  it("offers a second crew without asking the runner to leave the first", async () => {
    const user = userEvent.setup();
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );

    expect(screen.getByText("You are in 1 crew. Join another any time with a private invite link.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Crew name")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Create Another Crew" }));
    expect(screen.getByText("Create a private crew")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Crew emblem preview" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByText("Create a private crew")).not.toBeInTheDocument();
  });

  it("lists both crews and switches to the one the runner picks", async () => {
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
    expect(list.getByRole("button", { name: /OUC Race Crew/ })).toHaveAttribute("aria-pressed", "true");

    await user.click(list.getByRole("button", { name: /Trail Crew/ }));
    expect(switchCrew).toHaveBeenCalledWith("crew-2");
  });

  it("hides the list for a runner with a single crew", () => {
    render(
      <AccountCrewSheet
        isOpen
        onClose={vi.fn()}
        localRace={null}
        crew={controller({ status: "signed-in", account: ownerAccount })}
      />,
    );

    expect(screen.queryByRole("list", { name: "Your crews" })).not.toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    await user.click(screen.getByRole("button", { name: "Next core shape" }));
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

  it("applies a preset to every part at once", async () => {
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

    await user.click(screen.getByRole("button", { name: "Edit Crew" }));
    await user.click(screen.getByRole("button", { name: "TOTEM" }));
    await user.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(updateCrew).toHaveBeenCalledWith(
      expect.objectContaining({
        emblem: CREW_EMBLEM_PRESETS.find((preset) => preset.name === "TOTEM")?.emblem,
      }),
    );
  });
});
