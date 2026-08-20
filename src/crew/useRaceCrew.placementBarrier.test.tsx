import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CREW_EMBLEM } from "./emblem";
import type { CrewDashboardData, LoadedCrewAccount, RaceCrew } from "./types";

/*
 * Issue #128: the forced refresh after a placement is a read barrier, not just
 * another read. Joining a dashboard request that was already running answers
 * with the Crew as it looked before the write, which puts the block back in
 * READY even though the server accepted it.
 */

const mocks = vi.hoisted(() => {
  const user = { id: "runner-1", email: "runner@example.test", user_metadata: {} };
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
    loadCrewDashboard: vi.fn(),
    placeCrewBuildBlock: vi.fn(async () => undefined),
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
}));

vi.mock("./dashboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./dashboard")>()),
  loadCrewDashboard: mocks.loadCrewDashboard,
}));

vi.mock("./crewBuildPlacement", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./crewBuildPlacement")>()),
  placeCrewBuildBlock: mocks.placeCrewBuildBlock,
}));

vi.mock("../storage/personalSyncRepository", () => ({
  loadActivePersonalOwner: () => "runner-1",
  loadPersonalMetadata: () => ({ initialized: true }),
}));

const { useRaceCrew } = await import("./useRaceCrew");

const crew: RaceCrew = {
  id: "crew-1",
  ownerUserId: "owner-1",
  name: "Run Club",
  crewType: "club",
  raceName: null,
  raceDate: null,
  raceDistanceMiles: null,
  buildStartDate: "2026-08-01",
  emblem: DEFAULT_CREW_EMBLEM,
};

const account: LoadedCrewAccount = {
  profile: {
    id: "runner-1",
    displayName: "Runner",
    accentColor: null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    propsSeenAt: "2026-08-19T00:00:00Z",
  },
  memberships: [{ crew, role: "member", joinedAt: "2026-08-19T00:00:00Z" }],
  crew,
  role: "member",
  members: [
    {
      userId: "runner-1",
      displayName: "Runner",
      role: "member",
      joinedAt: "2026-08-19T00:00:00Z",
      accentColor: null,
      runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    },
  ],
  invites: [],
  takenAccentColors: [],
};

const readyRun = {
  id: "shared-run-1",
  userId: "runner-1",
  displayName: "Runner",
  accentColor: null,
  localDate: "2026-08-09",
  activityType: "easy" as const,
  distanceMiles: 2.15,
  durationSeconds: 1200,
  createdAt: "2026-08-09T12:00:00Z",
  crewBuildRow: null as number | null,
  crewBuildColumnStart: null as number | null,
  crewBuildPlacedAt: null as string | null,
};

function dashboardWith(row: number | null, columnStart: number | null): CrewDashboardData {
  return {
    members: account.members,
    summaries: [],
    runs: [],
    miniBuildRuns: [],
    crewBuildRuns: [
      {
        ...readyRun,
        crewBuildRow: row,
        crewBuildColumnStart: columnStart,
        crewBuildPlacedAt: row === null ? null : "2026-08-20T01:00:00Z",
      },
    ],
    sharedRunsAvailable: true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    propNotifications: [],
    loadedAt: "2026-08-20T01:00:00Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.loadCrewAccount.mockResolvedValue(account);
  mocks.client.auth.getSession.mockResolvedValue({
    data: { session: { user: mocks.user } },
    error: null,
  });
});

describe("Crew placement read barrier", () => {
  it("waits out a request that started before the write, then reads again", async () => {
    let resolveStale: ((data: CrewDashboardData) => void) | undefined;
    const stale = new Promise<CrewDashboardData>((resolve) => {
      resolveStale = resolve;
    });
    mocks.loadCrewDashboard
      .mockReturnValueOnce(stale)
      .mockResolvedValueOnce(dashboardWith(0, 1));

    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));

    let firstRefresh: Promise<void> = Promise.resolve();
    act(() => {
      firstRefresh = result.current.refreshCrewData(true);
    });
    await waitFor(() => expect(mocks.loadCrewDashboard).toHaveBeenCalledTimes(1));

    let placement: Promise<boolean> = Promise.resolve(false);
    act(() => {
      placement = result.current.placeCrewBuildBlock("shared-run-1", 0, 1);
    });
    // The in-flight read has not been joined; it queried before the write.
    expect(mocks.loadCrewDashboard).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveStale?.(dashboardWith(null, null));
      await firstRefresh;
    });

    let placed = false;
    await act(async () => {
      placed = await placement;
    });

    expect(placed).toBe(true);
    expect(mocks.loadCrewDashboard).toHaveBeenCalledTimes(2);
    expect(result.current.crewData?.crewBuildRuns[0]).toMatchObject({
      id: "shared-run-1",
      crewBuildRow: 0,
      crewBuildColumnStart: 1,
    });
    expect(result.current.crewBuildPlacementError).toBeNull();
  });

  it("says so when a fresh read does not show the accepted coordinates", async () => {
    mocks.loadCrewDashboard.mockResolvedValue(dashboardWith(null, null));
    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));

    let placed = true;
    await act(async () => {
      placed = await result.current.placeCrewBuildBlock("shared-run-1", 0, 1);
    });

    expect(placed).toBe(false);
    expect(result.current.crewBuildPlacementError).toBe(
      "That placement could not be confirmed. Refresh and try again.",
    );
  });

  it("does not call a failed refresh a failed placement", async () => {
    mocks.loadCrewDashboard.mockRejectedValue(new Error("Network unreachable."));
    const { result } = renderHook(() => useRaceCrew(null));
    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));

    let placed = false;
    await act(async () => {
      placed = await result.current.placeCrewBuildBlock("shared-run-1", 0, 1);
    });

    // The server accepted the write. A read that never arrived is reported as
    // a dashboard error and must not be dressed up as a rejected placement.
    expect(placed).toBe(true);
    expect(result.current.crewBuildPlacementError).toBeNull();
    expect(result.current.crewDataError).toBe("Network unreachable.");
  });
});
