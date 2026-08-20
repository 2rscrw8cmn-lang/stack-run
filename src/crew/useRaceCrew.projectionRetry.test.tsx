import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { DEFAULT_CREW_EMBLEM } from "./emblem";
import type { LoadedCrewAccount, RaceCrew } from "./types";

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
    personalReady: false,
    loadCrewAccount: vi.fn(),
    createCrewInvite: vi.fn(async () => ({
      url: "https://stack.test/#join=token",
      expiresAt: "2026-08-28T00:00:00Z",
    })),
    syncCrewProjection: vi.fn(async () => undefined),
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
  createCrewInvite: mocks.createCrewInvite,
}));

vi.mock("./projection", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./projection")>()),
  projectionFingerprint: () => "personal-state-fingerprint",
  syncCrewProjection: mocks.syncCrewProjection,
}));

vi.mock("../storage/personalSyncRepository", () => ({
  loadActivePersonalOwner: () => "owner-1",
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
  memberships: [
    { crew, role: "owner", joinedAt: "2026-08-19T00:00:00Z" },
  ],
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

describe("Crew projection readiness handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mocks.personalReady = false;
    mocks.loadCrewAccount.mockResolvedValue(account);
    mocks.client.auth.getSession.mockResolvedValue({
      data: { session: { user: mocks.user } },
      error: null,
    });
  });

  it("retries automatically when personal account initialization becomes ready", async () => {
    const { result } = renderHook(() => useRaceCrew(createInitialAppState()));

    await waitFor(() => expect(result.current.account?.crew?.id).toBe("crew-1"));
    await waitFor(() =>
      expect(result.current.projectionError).toBe(
        "Crew sharing is waiting for personal STACK to finish syncing.",
      ),
    );
    expect(mocks.syncCrewProjection).not.toHaveBeenCalled();

    mocks.personalReady = true;

    await waitFor(() => expect(mocks.syncCrewProjection).toHaveBeenCalledTimes(1), {
      timeout: 1500,
    });
    await waitFor(() => expect(result.current.projectionError).toBeNull());
    expect(mocks.syncCrewProjection).toHaveBeenCalledWith(
      mocks.client,
      expect.objectContaining({
        crewId: "crew-1",
        userId: "owner-1",
        buildStartDate: "2026-08-01",
      }),
    );
  });
});
