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
  deleteCrew as deleteCrewRecord,
  leaveCrew,
  loadCrewAccount,
  previewCrewInvite,
  redeemCrewInvite,
  removeCrewMember,
  revokeCrewInvite,
  updateCrew as updateCrewRecord,
  updateDisplayName,
  type CrewDetailsInput,
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
import {
  commitOptimisticCrewProps,
  setCrewReaction,
  withDashboardPropsState,
} from "./reactions";
import { CREW_DASHBOARD_STALE_MS } from "./freshness";
import { getSupabaseAvailability } from "./supabaseClient";
import {
  CrewBuildPlacementError,
  placeCrewBuildBlock,
} from "./crewBuildPlacement";
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
  propsPendingRunIds: readonly string[];
  propsErrors: Readonly<Record<string, string>>;
  crewBuildPlacementPending: boolean;
  crewBuildPlacementError: string | null;
  createAccount: (input: { email: string; pin: string; displayName: string }) => Promise<void>;
  signIn: (input: { email: string; pin: string }) => Promise<void>;
  signOut: () => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<void>;
  createCrew: (input: CrewDetailsInput) => Promise<void>;
  updateCrew: (input: CrewDetailsInput) => Promise<boolean>;
  deleteCrew: () => Promise<boolean>;
  createInvite: () => Promise<void>;
  revokeInvite: (inviteId: string) => Promise<void>;
  joinPendingInvite: () => Promise<void>;
  leaveCrew: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  refreshCrewData: (force?: boolean) => Promise<void>;
  toggleProps: (runId: string) => Promise<void>;
  placeCrewBuildBlock: (runId: string, row: number, columnStart: number) => Promise<boolean>;
  clearCrewBuildPlacementError: () => void;
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
  const [propsPendingRunIds, setPropsPendingRunIds] = useState<readonly string[]>([]);
  const [propsErrors, setPropsErrors] = useState<Readonly<Record<string, string>>>({});
  const [crewBuildPlacementPending, setCrewBuildPlacementPending] = useState(false);
  const [crewBuildPlacementError, setCrewBuildPlacementError] = useState<string | null>(null);
  const latest = useRef({ appState, user, account });
  const lastProjection = useRef({ fingerprint: "", syncedAt: 0 });
  const lastDashboard = useRef({ crewId: "", loadedAt: 0 });
  const dashboardInFlight = useRef<Promise<void> | null>(null);
  const propsInFlight = useRef(new Set<string>());

  const resetCrewClientState = useCallback((): void => {
    setLatestInviteUrl(null);
    lastProjection.current = { fingerprint: "", syncedAt: 0 };
    setCrewData(null);
    setCrewDataStatus("idle");
    setCrewDataError(null);
    setPropsPendingRunIds([]);
    setPropsErrors({});
    setCrewBuildPlacementError(null);
    propsInFlight.current.clear();
    lastDashboard.current = { crewId: "", loadedAt: 0 };
  }, []);

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
    const userId = current.user?.id;
    if (!userId || !crewId) return;
    const fresh =
      lastDashboard.current.crewId === crewId &&
      Date.now() - lastDashboard.current.loadedAt < CREW_DASHBOARD_STALE_MS;
    if (!force && fresh) return;
    if (dashboardInFlight.current) return dashboardInFlight.current;

    const request = (async () => {
      setCrewDataStatus("loading");
      setCrewDataError(null);
      try {
        const loaded = await loadCrewDashboard(availability.client, crewId, userId);
        if (latest.current.account?.crew?.id !== crewId) return;
        setCrewData(loaded);
        setCrewDataStatus("ready");
        setPropsErrors({});
        lastDashboard.current = { crewId, loadedAt: Date.now() };
      } catch (reason) {
        const currentUser = latest.current.user;
        if (currentUser) {
          try {
            const refreshedAccount = await loadCrewAccount(availability.client, currentUser);
            setAccount(refreshedAccount);
            if (!refreshedAccount.crew) {
              resetCrewClientState();
              setStatus("signed-in");
              return;
            }
          } catch {
            // Preserve the dashboard error below when the account refresh also fails.
          }
        }
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
  }, [availability, resetCrewClientState]);

  useEffect(() => {
    const crewId = account?.crew?.id ?? "";
    if (lastDashboard.current.crewId === crewId) return;
    setCrewData(null);
    setCrewDataStatus("idle");
    setCrewDataError(null);
    setPropsPendingRunIds([]);
    setPropsErrors({});
    setCrewBuildPlacementError(null);
    propsInFlight.current.clear();
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

  useEffect(() => {
    if (!availability.configured || !account?.crew || !user) return;
    const refreshMembership = () => {
      if (document.visibilityState === "hidden") return;
      void loadCrewAccount(availability.client, user)
        .then((loaded) => {
          setAccount(loaded);
          setStatus("signed-in");
          if (!loaded.crew) resetCrewClientState();
        })
        .catch((reason) => setError(messageOf(reason)));
    };
    window.addEventListener("focus", refreshMembership);
    document.addEventListener("visibilitychange", refreshMembership);
    return () => {
      window.removeEventListener("focus", refreshMembership);
      document.removeEventListener("visibilitychange", refreshMembership);
    };
  }, [account?.crew, availability, resetCrewClientState, user]);

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

  async function operateResult(
    action: () => Promise<void>,
    success: string,
  ): Promise<boolean> {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      return true;
    } catch (reason) {
      setError(messageOf(reason));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleProps(runId: string): Promise<void> {
    const currentUser = user;
    const crewId = account?.crew?.id;
    const run = crewData?.runs.find((item) => item.id === runId);
    if (
      !availability.configured ||
      !currentUser ||
      !crewId ||
      !run ||
      !crewData?.propsAvailable ||
      run.userId === currentUser.id ||
      propsInFlight.current.has(runId)
    ) {
      return;
    }

    const nextState = !run.viewerHasPropped;
    propsInFlight.current.add(runId);
    setPropsPendingRunIds((current) => [...current, runId]);
    setPropsErrors((current) => {
      const next = { ...current };
      delete next[runId];
      return next;
    });
    try {
      await commitOptimisticCrewProps({
        nextState,
        apply: (viewerHasPropped) => setCrewData((current) =>
          current
            ? withDashboardPropsState(current, runId, viewerHasPropped)
            : current,
        ),
        persist: () => setCrewReaction(availability.client, {
          crewId,
          sharedRunId: runId,
          userId: currentUser.id,
          active: nextState,
        }),
        onFailure: () => setPropsErrors((current) => ({
          ...current,
          [runId]: "Props could not be saved. Try again.",
        })),
      });
    } finally {
      propsInFlight.current.delete(runId);
      setPropsPendingRunIds((current) => current.filter((id) => id !== runId));
    }
  }

  async function placeBlockInCrewBuild(
    runId: string,
    row: number,
    columnStart: number,
  ): Promise<boolean> {
    if (!availability.configured || !user || !account?.crew || crewBuildPlacementPending) {
      return false;
    }
    setCrewBuildPlacementPending(true);
    setCrewBuildPlacementError(null);
    try {
      await placeCrewBuildBlock(availability.client, {
        sharedRunId: runId,
        row,
        columnStart,
      });
      lastDashboard.current.loadedAt = 0;
      await refreshCrewData(true);
      return true;
    } catch (reason) {
      if (reason instanceof CrewBuildPlacementError && reason.kind === "conflict") {
        setCrewBuildPlacementError("That space was just taken. Choose another spot.");
        lastDashboard.current.loadedAt = 0;
        await refreshCrewData(true);
      } else {
        setCrewBuildPlacementError("Your block could not be placed. Refresh and try again.");
      }
      return false;
    } finally {
      setCrewBuildPlacementPending(false);
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
    propsPendingRunIds,
    propsErrors,
    crewBuildPlacementPending,
    crewBuildPlacementError,
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
      setStatus("signed-out");
      resetCrewClientState();
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
    updateCrew: (input) => operateResult(async () => {
      if (!availability.configured || !account?.crew || !user) {
        throw new Error("Crew could not be updated. Refresh and try again.");
      }
      try {
        await updateCrewRecord(availability.client, account.crew.id, input);
      } catch (reason) {
        await reloadAccount(user).catch(() => undefined);
        throw reason;
      }
      setAccount((current) =>
        current?.crew
          ? { ...current, crew: { ...current.crew, ...input } }
          : current,
      );
      await reloadAccount(user).catch(() => undefined);
      lastDashboard.current.loadedAt = 0;
    }, "Crew updated."),
    deleteCrew: () => operateResult(async () => {
      if (!availability.configured || !account?.crew || !user) {
        throw new Error("Crew could not be deleted. Refresh and try again.");
      }
      try {
        await deleteCrewRecord(availability.client, account.crew.id);
      } catch (reason) {
        await reloadAccount(user).catch(() => undefined);
        throw reason;
      }
      setAccount((current) =>
        current
          ? { ...current, crew: null, role: null, members: [], invites: [] }
          : current,
      );
      resetCrewClientState();
      await reloadAccount(user).catch(() => undefined);
    }, "Crew deleted."),
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
      resetCrewClientState();
    }, "You left the crew. Personal STACK was not changed."),
    removeMember: (userId) => operate(async () => {
      if (!availability.configured || !account?.crew || !user) return;
      await removeCrewMember(availability.client, account.crew.id, userId);
      await reloadAccount(user);
      lastDashboard.current.loadedAt = 0;
      await refreshCrewData(true);
    }, "Crew member removed."),
    refreshCrewData,
    toggleProps,
    placeCrewBuildBlock: placeBlockInCrewBuild,
    clearCrewBuildPlacementError: () => setCrewBuildPlacementError(null),
    clearMessage: () => {
      setError(null);
      setMessage(null);
    },
  };
}
