import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { DEFAULT_CREW_EMBLEM } from "./emblem";
import type { LoadedCrewAccount, RaceCrew } from "./types";

/*
 * Issue #128: joining a Crew can finish before this device has adopted the
 * account's canonical personal cache. Projection is right to stand down then —
 * a cache that is not yet authoritative must not be published to a crew — but
 * standing down silently left a runner with a Crew that had none of their
 * existing runs, and no way back except an unrelated later sync.
 */

const mocks = vi.hoisted(() => {
  const user = { id: "owner-1", email: "owner@example.test", user_metadata: {} };
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
    personalReady: false,
    loadCrewAccount: vi.fn(),
    loadCrewDashboard: vi.fn(),
    syncCrewProjection: vi.fn(
      async (): Promise<{ skipped: number; message: string | null }> =>
        ({ skipped: 0, message: null }),
    ),
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

vi.mock("./projection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./projection")>()),
  projectionFingerprint: () => "personal-state-fingerprint",
  syncCrewProjection: mocks.syncCrewProjection,
}));

vi.mock("../storage/personalSyncRepository", () => ({
  loadActivePersonalOwner: () => (mocks.personalReady ? "owner-1" : "local"),
  loadPersonalMetadata: () => ({ initialized: mocks.personalReady }),
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
    id: "owner-1",
    displayName: "Owner",
    accentColor: null,
    runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    propsSeenAt: "2026-08-19T00:00:00Z",
  },
  memberships: [{ crew, role: "owner", joinedAt: "2026-08-19T00:00:00Z" }],
  crew,
  role: "owner",
  members: [
    {
      userId: "owner-1",
      displayName: "Owner",
      role: "owner",
      joinedAt: "2026-08-19T00:00:00Z",
      accentColor: null,
      runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
    },
  ],
  invites: [],
  takenAccentColors: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.personalReady = false;
  mocks.loadCrewAccount.mockResolvedValue(account);
  mocks.loadCrewDashboard.mockResolvedValue({
    members: account.members,
    summaries: [],
    runs: [],
    miniBuildRuns: [],
    crewBuildRuns: [],
    sharedRunsAvailable: true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    propNotifications: [],
    loadedAt: "2026-08-20T01:00:00Z",
  });
  mocks.client.auth.getSession.mockResolvedValue({
    data: { session: { user: mocks.user } },
    error: null,
  });
});

describe("Crew projection readiness handoff", () => {
  it("reports a recoverable wait instead of failing silently", async () => {
    const { result } = renderHook(() => useRaceCrew(createInitialAppState()));

    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));
    await waitFor(() =>
      expect(result.current.projectionWaitingForPersonal).toBe(true),
    );
    expect(mocks.syncCrewProjection).not.toHaveBeenCalled();
    // The wait is not an error: personal STACK is fine and nothing failed.
    expect(result.current.projectionError).toBeNull();
  });

  it("projects the held-back runs as soon as personal sync reports ready", async () => {
    const { result } = renderHook(() => useRaceCrew(createInitialAppState()));

    await waitFor(() =>
      expect(result.current.projectionWaitingForPersonal).toBe(true),
    );

    mocks.personalReady = true;
    await act(async () => {
      await result.current.notePersonalSyncReady();
    });

    expect(mocks.syncCrewProjection).toHaveBeenCalledTimes(1);
    expect(mocks.syncCrewProjection).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        crewId: "crew-1",
        userId: "owner-1",
        buildStartDate: "2026-08-01",
      }),
    );
    await waitFor(() =>
      expect(result.current.projectionWaitingForPersonal).toBe(false),
    );
  });

  /*
   * A run Crew cannot store is not a failed sync. Everything else uploaded,
   * so this crew is up to date and its freshness bookkeeping must reflect
   * that - while the runner is still told a run of theirs is not arriving.
   */
  it("reports a skipped run without treating the sync as failed", async () => {
    mocks.personalReady = true;
    mocks.syncCrewProjection.mockResolvedValue({
      skipped: 1,
      message: "One run could not be shared with your crew. Every other run was shared.",
    });

    const { result } = renderHook(() => useRaceCrew(createInitialAppState()));

    await waitFor(() => expect(mocks.syncCrewProjection).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(result.current.projectionError).toBe(
        "One run could not be shared with your crew. Every other run was shared.",
      ),
    );
    expect(result.current.projectionWaitingForPersonal).toBe(false);
  });

  it("does not re-upload when nothing was held back", async () => {
    mocks.personalReady = true;
    const { result } = renderHook(() => useRaceCrew(createInitialAppState()));

    await waitFor(() => expect(mocks.syncCrewProjection).toHaveBeenCalledTimes(1));
    expect(result.current.projectionWaitingForPersonal).toBe(false);

    await act(async () => {
      await result.current.notePersonalSyncReady();
    });
    expect(mocks.syncCrewProjection).toHaveBeenCalledTimes(1);
  });
});
