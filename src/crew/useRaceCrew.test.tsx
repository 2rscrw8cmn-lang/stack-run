import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { loadCrewDeleteTombstones } from "../storage/crewDeleteTombstoneRepository";
import type { CrewDashboardData, LoadedCrewAccount } from "./types";

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

const ownerAccount: LoadedCrewAccount = {
  profile: { id: "owner-1", displayName: "Owner" },
  crew: {
    id: "crew-1",
    ownerUserId: "owner-1",
    name: "Original Crew",
    raceName: "Original Race",
    raceDate: "2026-12-05",
    raceDistanceMiles: 13.1,
    buildStartDate: "2026-08-01",
  },
  role: "owner",
  members: [
    { userId: "owner-1", displayName: "Owner", role: "owner", joinedAt: "2026-08-01T00:00:00Z" },
  ],
  invites: [],
};

const noCrewAccount: LoadedCrewAccount = {
  profile: ownerAccount.profile,
  crew: null,
  role: null,
  members: [],
  invites: [],
};

const memberAccount: LoadedCrewAccount = {
  ...ownerAccount,
  profile: { id: "owner-1", displayName: "Former Owner" },
  role: "member",
  members: [
    { userId: "owner-1", displayName: "Former Owner", role: "member", joinedAt: "2026-08-01T00:00:00Z" },
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
      crew: { ...ownerAccount.crew!, name: "Updated Crew", raceName: "Updated Race" },
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
        raceName: "Updated Race",
        raceDate: "2027-01-10",
        raceDistanceMiles: 26.2,
        buildStartDate: "2026-08-01",
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
        raceName: "Denied",
        raceDate: "2027-01-10",
        raceDistanceMiles: 26.2,
        buildStartDate: "2026-08-01",
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
