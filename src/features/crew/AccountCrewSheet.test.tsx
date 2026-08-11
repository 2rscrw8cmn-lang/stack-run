import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { AccountCrewSheet } from "./AccountCrewSheet";

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
        profile: { id: "user-1", displayName: "Runner" },
        crew: null,
        role: null,
        members: [],
        invites: [],
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
});
