import { useCallback, useEffect, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { todayLocalDate } from "../domain/dates";
import type { AppState } from "../domain/types";
import {
  createStackAccount,
  signInToStack,
  signOutOfStack,
} from "./auth";
import {
  createCrew,
  createCrewInvite,
  leaveCrew,
  loadCrewAccount,
  previewCrewInvite,
  redeemCrewInvite,
  removeCrewMember,
  revokeCrewInvite,
  updateDisplayName,
} from "./crewService";
import {
  captureInviteFromLocation,
  clearPendingInvite,
} from "./invites";
import {
  projectionFingerprint,
  syncCrewProjection,
} from "./projection";
import { loadCrewDashboard } from "./dashboard";
import { CREW_DASHBOARD_STALE_MS } from "./freshness";
import { getSupabaseAvailability } from "./supabaseClient";
import type {
  CrewDashboardData,
  CrewInvitePreview,
  LoadedCrewAccount,
} from "./types";

const PROJECTION_STALE_MS = 30 * 60_000;

export type RaceCrewSessionStatus =
  | "unconfigured"
  | "loading"
  | "signed-out"
  | "signed-in";

export interface PendingCrewInvite {
  token: string;
  preview: CrewInvitePreview | null;
  error: string | null;
}

export interface RaceCrewController {
  configured: boolean;
  unavailableReason: string | null;
  status: RaceCrewSessionStatus;
  busy: boolean;
  error: string | null;
  message: string | null;
  email: string | null;
  account: LoadedCrewAccount | null;
  pendingInvite: PendingCrewInvite | null;
  latestInviteUrl: string | null;
  projectionError: string | null;
  crewData: CrewDashboardData | null;
  crewDataStatus: "idle" | "loading" | "ready" | "error";
  crewDataError: string | null;
  createAccount: (input: { email: string; pin: string; displayName: string }) => Promise<void>;
  signIn: (input: { email: string; pin: string }) => Promise<void>;
  signOut: () => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<void>;
  createCrew: (input: { name: string; raceName: string; raceDate: string; raceDistanceMiles: number }) => Promise<void>;
  createInvite: () => Promise<void>;
  revokeInvite: (inviteId: string) => Promise<void>;
  joinPendingInvite: () => Promise<void>;
  leaveCrew: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  refreshCrewData: (force?: boolean) => Promise<void>;
  clearMessage: () => void;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Race Crew could not be reached.";
}

export function useRaceCrew(appState: AppState | null): RaceCrewController {
  const [availability] = useState(getSupabaseAvailability);
  const [initialInviteToken] = useState(() =>
    availability.configured ? captureInviteFromLocation() : null,
  );
  const [status, setStatus] = useState<RaceCrewSessionStatus>(
    availability.configured ? "loading" : "unconfigured",
  );
  const [user, setUser] = useState<User | null>(null);
  const [account, setAccount] = useState<LoadedCrewAccount | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingCrewInvite | null>(
    initialInviteToken
      ? { token: initialInviteToken, preview: null, error: null }
      : null,
  );
  const [latestInviteUrl, setLatestInviteUrl] = useState<string | null>(null);
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [crewData, setCrewData] = useState<CrewDashboardData | null>(null);
  const [crewDataStatus, setCrewDataStatus] = useState<
    RaceCrewController["crewDataStatus"]
  >("idle");
  const [crewDataError, setCrewDataError] = useState<string | null>(null);
  const latest = useRef({ appState, user, account });
  const lastProjection = useRef({ fingerprint: "", syncedAt: 0 });
  const lastDashboard = useRef({ crewId: "", loadedAt: 0 });
  const dashboardInFlight = useRef<Promise<void> | null>(null);

  useEffect(() => {
    latest.current = { appState, user, account };
  });

  const reloadAccount = useCallback(async (nextUser: User): Promise<void> => {
    if (!availability.configured) return;
    const loaded = await loadCrewAccount(availability.client, nextUser);
    setAccount(loaded);
    setStatus("signed-in");
  }, [availability]);

  useEffect(() => {
    if (!availability.configured) return;
    let active = true;
    void availability.client.auth.getSession().then(async ({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) {
        setError(sessionError.message);
        setStatus("signed-out");
        return;
      }
      const nextUser = data.session?.user ?? null;
      setUser(nextUser);
      if (!nextUser) {
        setStatus("signed-out");
        return;
      }
      try {
        await reloadAccount(nextUser);
      } catch (reason) {
        if (active) {
          setError(messageOf(reason));
          setStatus("signed-in");
        }
      }
    });

    const { data: listener } = availability.client.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      const nextUser = session?.user ?? null;
      if ((latest.current.user?.id ?? null) !== (nextUser?.id ?? null)) {
        // A raw invite URL is intentionally ephemeral and must never cross
        // account boundaries on a shared browser profile.
        setLatestInviteUrl(null);
      }
      setUser(nextUser);
      if (!nextUser) {
        setAccount(null);
        setStatus("signed-out");
        return;
      }
      setStatus("loading");
      window.setTimeout(() => {
        void reloadAccount(nextUser).catch((reason) => {
          setError(messageOf(reason));
          setStatus("signed-in");
        });
      }, 0);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [availability, reloadAccount]);

  useEffect(() => {
    if (!availability.configured || !initialInviteToken) return;
    void previewCrewInvite(availability.client, initialInviteToken)
      .then((preview) => setPendingInvite({ token: initialInviteToken, preview, error: null }))
      .catch((reason) =>
        setPendingInvite({ token: initialInviteToken, preview: null, error: messageOf(reason) }),
      );
  }, [availability, initialInviteToken]);

  const syncProjection = useCallback(async (force = false): Promise<void> => {
    if (!availability.configured) return;
    const current = latest.current;
    if (!current.appState || !current.user || !current.account?.crew) return;
    const today = todayLocalDate();
    const fingerprint = projectionFingerprint(current.appState, today);
    const fresh = Date.now() - lastProjection.current.syncedAt < PROJECTION_STALE_MS;
    if (!force && fresh && fingerprint === lastProjection.current.fingerprint) return;
    try {
      await syncCrewProjection(availability.client, {
        state: current.appState,
        crewId: current.account.crew.id,
        userId: current.user.id,
        today,
      });
      lastProjection.current = { fingerprint, syncedAt: Date.now() };
      lastDashboard.current.loadedAt = 0;
      setProjectionError(null);
    } catch (reason) {
      setProjectionError(messageOf(reason));
    }
  }, [availability]);

  const refreshCrewData = useCallback(async (force = false): Promise<void> => {
    if (!availability.configured) return;
    const current = latest.current;
    const crewId = current.account?.crew?.id;
    if (!current.user || !crewId) return;
    const fresh =
      lastDashboard.current.crewId === crewId &&
      Date.now() - lastDashboard.current.loadedAt < CREW_DASHBOARD_STALE_MS;
    if (!force && fresh) return;
    if (dashboardInFlight.current) return dashboardInFlight.current;

    const request = (async () => {
      setCrewDataStatus("loading");
      setCrewDataError(null);
      try {
        const loaded = await loadCrewDashboard(availability.client, crewId);
        if (latest.current.account?.crew?.id !== crewId) return;
        setCrewData(loaded);
        setCrewDataStatus("ready");
        lastDashboard.current = { crewId, loadedAt: Date.now() };
      } catch (reason) {
        setCrewDataError(messageOf(reason));
        setCrewDataStatus("error");
      }
    })();
    dashboardInFlight.current = request;
    try {
      await request;
    } finally {
      if (dashboardInFlight.current === request) dashboardInFlight.current = null;
    }
  }, [availability]);

  useEffect(() => {
    const crewId = account?.crew?.id ?? "";
    if (lastDashboard.current.crewId === crewId) return;
    setCrewData(null);
    setCrewDataStatus("idle");
    setCrewDataError(null);
    lastDashboard.current = { crewId, loadedAt: 0 };
  }, [account?.crew?.id]);

  const fingerprint = appState ? projectionFingerprint(appState, todayLocalDate()) : "";
  useEffect(() => {
    if (!account?.crew || !user || !fingerprint) return;
    const timer = window.setTimeout(() => void syncProjection(false), 0);
    return () => window.clearTimeout(timer);
  }, [account?.crew, fingerprint, syncProjection, user]);

  useEffect(() => {
    if (!account?.crew || !user) return;
    const refresh = () => {
      if (document.visibilityState !== "hidden") void syncProjection(false);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [account?.crew, syncProjection, user]);

  useEffect(() => {
    if (!account?.crew || !user) return;
    const refresh = () => {
      if (document.visibilityState !== "hidden") void refreshCrewData(false);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [account?.crew, refreshCrewData, user]);

  async function operate(action: () => Promise<void>, success?: string): Promise<void> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      if (success) setMessage(success);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return {
    configured: availability.configured,
    unavailableReason: availability.configured ? null : availability.reason,
    status,
    busy,
    error,
    message,
    email: user?.email ?? null,
    account,
    pendingInvite,
    latestInviteUrl,
    projectionError,
    crewData,
    crewDataStatus,
    crewDataError,
    createAccount: (input) => operate(async () => {
      if (!availability.configured) return;
      const nextUser = await createStackAccount(availability.client, input);
      setUser(nextUser);
      await reloadAccount(nextUser);
    }, "STACK account created. Your personal training stayed on this device."),
    signIn: (input) => operate(async () => {
      if (!availability.configured) return;
      const nextUser = await signInToStack(availability.client, input);
      setUser(nextUser);
      await reloadAccount(nextUser);
    }, "Signed in. Your local plan and runs were not replaced."),
    signOut: () => operate(async () => {
      if (!availability.configured) return;
      await signOutOfStack(availability.client);
      setUser(null);
      setAccount(null);
      setLatestInviteUrl(null);
      setStatus("signed-out");
      lastProjection.current = { fingerprint: "", syncedAt: 0 };
      setCrewData(null);
      setCrewDataStatus("idle");
      setCrewDataError(null);
      lastDashboard.current = { crewId: "", loadedAt: 0 };
    }, "Signed out. Personal STACK is still available."),
    saveDisplayName: (displayName) => operate(async () => {
      if (!availability.configured || !user) return;
      await updateDisplayName(availability.client, user.id, displayName);
      await reloadAccount(user);
      lastDashboard.current.loadedAt = 0;
      await refreshCrewData(true);
    }, "Display name updated."),
    createCrew: (input) => operate(async () => {
      if (!availability.configured || !user) return;
      await createCrew(availability.client, input);
      await reloadAccount(user);
      await syncProjection(true);
    }, "Race Crew created."),
    createInvite: () => operate(async () => {
      if (!availability.configured || !account?.crew) return;
      const created = await createCrewInvite(availability.client, account.crew.id);
      setLatestInviteUrl(created.url);
      if (user) await reloadAccount(user);
    }, "Private invite created. It expires in 14 days."),
    revokeInvite: (inviteId) => operate(async () => {
      if (!availability.configured) return;
      await revokeCrewInvite(availability.client, inviteId);
      setLatestInviteUrl(null);
      if (user) await reloadAccount(user);
    }, "Invite revoked."),
    joinPendingInvite: () => operate(async () => {
      if (!availability.configured || !pendingInvite || !user) return;
      await redeemCrewInvite(availability.client, pendingInvite.token);
      clearPendingInvite();
      setPendingInvite(null);
      await reloadAccount(user);
      await syncProjection(true);
    }, "Joined Race Crew. Your local race and plan were not changed."),
    leaveCrew: () => operate(async () => {
      if (!availability.configured || !account?.crew || !user) return;
      await leaveCrew(availability.client, account.crew.id);
      await reloadAccount(user);
      setLatestInviteUrl(null);
      lastProjection.current = { fingerprint: "", syncedAt: 0 };
      setCrewData(null);
      setCrewDataStatus("idle");
      setCrewDataError(null);
      lastDashboard.current = { crewId: "", loadedAt: 0 };
    }, "You left the crew. Personal STACK was not changed."),
    removeMember: (userId) => operate(async () => {
      if (!availability.configured || !account?.crew || !user) return;
      await removeCrewMember(availability.client, account.crew.id, userId);
      await reloadAccount(user);
      lastDashboard.current.loadedAt = 0;
      await refreshCrewData(true);
    }, "Crew member removed."),
    refreshCrewData,
    clearMessage: () => {
      setError(null);
      setMessage(null);
    },
  };
}
