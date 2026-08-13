import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { loadCrewDeleteTombstones } from "../storage/crewDeleteTombstoneRepository";
import { DEFAULT_CREW_EMBLEM } from "./emblem";
import type { CrewDashboardData, LoadedCrewAccount, RaceCrew } from "./types";

const mocks = vi.hoisted(() => {
  const user = {
    id: "owner-1",
    email: "owner@example.test",
    user_metadata: {},
  };
  const client = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user } }, error: null })),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  };
  return {
    user,
    client,
    loadCrewAccount: vi.fn(),
    updateCrew: vi.fn(async () => undefined),
    deleteCrew: vi.fn(async () => undefined),
    loadCrewDashboard: vi.fn(),
    syncCrewProjection: vi.fn(async () => undefined),
    deleteCrewRunProjection: vi.fn(async () => undefined),
  };
});

vi.mock("./supabaseClient", () => ({
  getSupabaseAvailability: () => ({
    configured: true,
    reason: null,
    client: mocks.client,
  }),
}));

vi.mock("./crewService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./crewService")>()),
  loadCrewAccount: mocks.loadCrewAccount,
  updateCrew: mocks.updateCrew,
  deleteCrew: mocks.deleteCrew,
}));

vi.mock("./dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dashboard")>()),
  loadCrewDashboard: mocks.loadCrewDashboard,
}));

vi.mock("./projection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./projection")>()),
  projectionFingerprint: () => "personal-state-fingerprint",
  syncCrewProjection: mocks.syncCrewProjection,
  deleteCrewRunProjection: mocks.deleteCrewRunProjection,
}));

const { useRaceCrew } = await import("./useRaceCrew");

const ownerCrew: RaceCrew = {
  id: "crew-1",
  ownerUserId: "owner-1",
  name: "Original Crew",
  crewType: "race",
  raceName: "Original Race",
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

const noCrewAccount: LoadedCrewAccount = {
  profile: ownerAccount.profile,
  memberships: [],
  crew: null,
  role: null,
  members: [],
  invites: [],
  takenAccentColors: [],
};

const memberAccount: LoadedCrewAccount = {
  ...ownerAccount,
  profile: { id: "owner-1", displayName: "Former Owner", accentColor: null },
  role: "member",
  members: [
    { userId: "owner-1", displayName: "Former Owner", role: "member", joinedAt: "2026-08-01T00:00:00Z", accentColor: null },
  ],
};

const dashboard: CrewDashboardData = {
  members: ownerAccount.members,
  summaries: [],
  runs: [],
  miniBuildRuns: [],
  crewBuildRuns: [],
  sharedRunsAvailable: true,
  sharedRunsTruncated: false,
  propsAvailable: true,
  loadedAt: "2026-08-11T12:00:00Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.client.auth.getSession.mockResolvedValue({
    data: { session: { user: mocks.user } },
    error: null,
  });
  mocks.loadCrewDashboard.mockResolvedValue(dashboard);
});

describe("Race Crew owner lifecycle", () => {
  it("keeps personal deletion independent and retries only its explicit Crew tombstone", async () => {
    mocks.loadCrewAccount.mockResolvedValue(ownerAccount);
    mocks.deleteCrewRunProjection
      .mockRejectedValueOnce(new Error("network unavailable"))
      .mockResolvedValueOnce(undefined);
    const { result, rerender } = renderHook(
      ({ state }) => useRaceCrew(state),
      { initialProps: { state: null as ReturnType<typeof createInitialAppState> | null } },
    );
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));

    await act(async () => {
      await result.current.deleteRunContribution("run-b");
    });
    expect(result.current.projectionError).toContain("cleanup will retry");
    expect(loadCrewDeleteTombstones()).toHaveLength(1);

    rerender({ state: createInitialAppState() });
    await waitFor(() => expect(mocks.deleteCrewRunProjection).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(loadCrewDeleteTombstones()).toEqual([]));
    expect(mocks.deleteCrewRunProjection).toHaveBeenNthCalledWith(
      2,
      mocks.client,
      expect.objectContaining({
        crewId: "crew-1",
        userId: "owner-1",
        localRunId: "run-b",
      }),
    );
  });

  it("reloads edited Crew metadata without touching personal AppState", async () => {
    const updatedAccount: LoadedCrewAccount = {
      ...ownerAccount,
      crew: { ...ownerCrew, name: "Updated Crew", raceName: "Updated Race" },
    };
    mocks.loadCrewAccount
      .mockResolvedValueOnce(ownerAccount)
      .mockResolvedValueOnce(updatedAccount);
    const personalState = null;
    const { result } = renderHook(() => useRaceCrew(personalState));
    await waitFor(() => expect(result.current.status).toBe("signed-in"));

    let saved = false;
    await act(async () => {
      saved = await result.current.updateCrew({
        name: "Updated Crew",
        crewType: "race",
        raceName: "Updated Race",
        raceDate: "2027-01-10",
        raceDistanceMiles: 26.2,
        buildStartDate: "2026-08-01",
        emblem: DEFAULT_CREW_EMBLEM,
      });
    });

    expect(saved).toBe(true);
    expect(mocks.updateCrew).toHaveBeenCalledWith(
      mocks.client,
      "crew-1",
      expect.objectContaining({ name: "Updated Crew", raceName: "Updated Race" }),
    );
    expect(result.current.account?.crew?.name).toBe("Updated Crew");
    expect(result.current.message).toBe("Crew updated.");
    expect(personalState).toBeNull();
  });

  it("deletes the Crew, clears shared client state, and keeps the account signed in", async () => {
    mocks.loadCrewAccount
      .mockResolvedValueOnce(ownerAccount)
      .mockResolvedValueOnce(noCrewAccount);
    const personalState = createInitialAppState();
    const personalSnapshot = structuredClone(personalState);
    const { result } = renderHook(() => useRaceCrew(personalState));
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));

    let deleted = false;
    await act(async () => {
      deleted = await result.current.deleteCrew();
    });

    expect(deleted).toBe(true);
    expect(mocks.deleteCrew).toHaveBeenCalledWith(mocks.client, "crew-1");
    expect(result.current.status).toBe("signed-in");
    expect(result.current.email).toBe("owner@example.test");
    expect(result.current.account?.crew).toBeNull();
    expect(result.current.crewData).toBeNull();
    expect(result.current.latestInviteUrl).toBeNull();
    expect(result.current.message).toBe("Crew deleted.");
    expect(personalState).toEqual(personalSnapshot);
  });

  it("reloads stale permissions when an owner mutation is denied", async () => {
    mocks.loadCrewAccount
      .mockResolvedValueOnce(ownerAccount)
      .mockResolvedValueOnce(memberAccount);
    mocks.updateCrew.mockRejectedValueOnce(new Error("permission denied"));
    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.role).toBe("owner"));

    let saved = true;
    await act(async () => {
      saved = await result.current.updateCrew({
        name: "Denied",
        crewType: "race",
        raceName: "Denied",
        raceDate: "2027-01-10",
        raceDistanceMiles: 26.2,
        buildStartDate: "2026-08-01",
        emblem: DEFAULT_CREW_EMBLEM,
      });
    });

    expect(saved).toBe(false);
    expect(result.current.account?.role).toBe("member");
    expect(result.current.error).toBe("permission denied");
  });

  it("drops stale membership on the next foreground refresh", async () => {
    mocks.loadCrewAccount
      .mockResolvedValueOnce(ownerAccount)
      .mockResolvedValueOnce(noCrewAccount);
    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));

    act(() => window.dispatchEvent(new Event("focus")));
    await waitFor(() => expect(result.current.account?.crew).toBeNull());
    expect(result.current.status).toBe("signed-in");
    expect(result.current.crewData).toBeNull();
  });
});

/** The second argument of every call: the client is the first. */
function syncedInputs<T>(mock: { mock: { calls: unknown[][] } }): T[] {
  return mock.mock.calls.map((call) => call[1] as T);
}

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

const viewingSecondCrew: LoadedCrewAccount = {
  ...twoCrewAccount,
  crew: secondCrew,
  role: "member",
};

describe("Running with more than one crew", () => {
  it("shares this device's projection with every crew, not just the visible one", async () => {
    mocks.loadCrewAccount.mockResolvedValue(twoCrewAccount);
    const { result } = renderHook(() => useRaceCrew(createInitialAppState()));
    await waitFor(() => expect(result.current.account?.memberships).toHaveLength(2));

    await waitFor(() => expect(mocks.syncCrewProjection).toHaveBeenCalledTimes(2));
    const crewIds = syncedInputs<{ crewId: string }>(mocks.syncCrewProjection).map(
      (input) => input.crewId,
    );
    expect(crewIds.sort()).toEqual(["crew-1", "crew-2"]);
    // Each crew owns its own contribution window.
    const windows = syncedInputs<{ buildStartDate: string }>(mocks.syncCrewProjection).map(
      (input) => input.buildStartDate,
    );
    expect(windows.sort()).toEqual(["2026-08-01", "2026-11-01"]);
  });

  it("switches the viewed crew and remembers it on this device", async () => {
    mocks.loadCrewAccount
      .mockResolvedValueOnce(twoCrewAccount)
      .mockResolvedValue(viewingSecondCrew);
    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));

    await act(async () => {
      await result.current.switchCrew("crew-2");
    });

    expect(result.current.account?.crew?.id).toBe("crew-2");
    expect(result.current.account?.role).toBe("member");
    expect(mocks.loadCrewAccount).toHaveBeenLastCalledWith(
      mocks.client,
      mocks.user,
      "crew-2",
    );
    expect(JSON.parse(localStorage.getItem("stack.crew.active.v1") ?? "{}")).toEqual({
      "owner-1": "crew-2",
    });
  });

  it("refuses to switch to a crew this account is not in", async () => {
    mocks.loadCrewAccount.mockResolvedValue(twoCrewAccount);
    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));
    mocks.loadCrewAccount.mockClear();

    await act(async () => {
      await result.current.switchCrew("crew-9");
    });

    expect(result.current.error).toBe("That crew is no longer available.");
    expect(result.current.account?.crew?.id).toBe("crew-1");
    expect(mocks.loadCrewAccount).not.toHaveBeenCalled();
  });

  it("withdraws a deleted run from every crew it was shared with", async () => {
    mocks.loadCrewAccount.mockResolvedValue(twoCrewAccount);
    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.memberships).toHaveLength(2));
    mocks.deleteCrewRunProjection.mockClear();

    await act(async () => {
      await result.current.deleteRunContribution("run-b");
    });

    expect(
      syncedInputs<{ crewId: string }>(mocks.deleteCrewRunProjection).map(
        (input) => input.crewId,
      ),
    ).toEqual(["crew-1", "crew-2"]);
    expect(result.current.projectionError).toBeNull();
  });
});
