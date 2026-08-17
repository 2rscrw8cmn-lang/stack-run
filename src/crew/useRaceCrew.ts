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
  resetCrewInvite,
  updateAccentColor,
  updateCrew as updateCrewRecord,
  updateDisplayName,
  updatePropsSeenAt,
  updateRunnerIcon,
  type CrewDetailsInput,
} from "./crewService";
import type { CrewMemberAccent } from "./memberAccent";
import { unreadPropNotifications } from "./notifications";
import type { RunnerIcon } from "./runnerIcon";
import {
  captureInviteFromLocation,
  clearPendingInvite,
} from "./invites";
import {
  deleteCrewRunProjection,
  projectionFingerprint,
  syncCrewProjection,
} from "./projection";
import {
  addCrewDeleteTombstone,
  loadCrewDeleteTombstones,
  removeCrewDeleteTombstone,
  type CrewDeleteTombstone,
} from "../storage/crewDeleteTombstoneRepository";
import {
  loadActiveCrewId,
  saveActiveCrewId,
} from "../storage/activeCrewRepository";
import {
  dismissPropNotification as rememberDismissedPropNotification,
  loadDismissedPropNotificationIds,
} from "../storage/dismissedPropNotificationRepository";
import { loadCrewDashboard } from "./dashboard";
import {
  loadActivePersonalOwner,
  loadPersonalMetadata,
} from "../storage/personalSyncRepository";
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
  CrewPropNotification,
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
  /** Bound after auth so a shared browser cannot hand this capability onward. */
  accountId: string | null;
}

export interface RaceCrewController {
  configured: boolean;
  unavailableReason: string | null;
  status: RaceCrewSessionStatus;
  busy: boolean;
  error: string | null;
  message: string | null;
  email: string | null;
  userId?: string | null;
  account: LoadedCrewAccount | null;
  pendingInvite: PendingCrewInvite | null;
  latestInviteUrl: string | null;
  projectionError: string | null;
  crewData: CrewDashboardData | null;
  crewDataStatus: "idle" | "loading" | "ready" | "error";
  crewDataError: string | null;
  propsPendingRunIds: readonly string[];
  propsErrors: Readonly<Record<string, string>>;
  /** Props on the viewer's own runs since they last opened a surface that shows them. */
  unreadPropNotifications: readonly CrewPropNotification[];
  /** Props on the viewer's own runs, minus whichever ones they've swiped away. */
  visiblePropNotifications: readonly CrewPropNotification[];
  crewBuildPlacementPending: boolean;
  crewBuildPlacementError: string | null;
  createAccount: (input: { email: string; pin: string; displayName: string }) => Promise<void>;
  signIn: (input: { email: string; pin: string }) => Promise<void>;
  signOut: () => Promise<void>;
  saveDisplayName: (displayName: string) => Promise<void>;
  saveAccentColor: (accentColor: CrewMemberAccent) => Promise<void>;
  saveRunnerIcon: (runnerIcon: RunnerIcon) => Promise<void>;
  createCrew: (input: CrewDetailsInput) => Promise<void>;
  updateCrew: (input: CrewDetailsInput) => Promise<boolean>;
  deleteCrew: () => Promise<boolean>;
  /** Changes which crew this device is looking at. */
  switchCrew: (crewId: string) => Promise<void>;
  createInvite: () => Promise<void>;
  resetInvite: () => Promise<void>;
  joinPendingInvite: () => Promise<void>;
  leaveCrew: () => Promise<void>;
  removeMember: (userId: string) => Promise<void>;
  deleteRunContribution: (localRunId: string) => Promise<void>;
  refreshCrewData: (force?: boolean) => Promise<void>;
  toggleProps: (runId: string) => Promise<void>;
  markPropsSeen: () => Promise<void>;
  dismissPropNotification: (notificationId: string) => void;
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
  const [dismissedPropIds, setDismissedPropIds] = useState<ReadonlySet<string>>(new Set());
  const dismissedPropIdsUserId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pendingInvite, setPendingInvite] = useState<PendingCrewInvite | null>(
    initialInviteToken
      ? { token: initialInviteToken, preview: null, error: null, accountId: null }
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
  /**
   * Foreground events can arrive while an explicit Crew mutation is reloading
   * the roster. A response started before that mutation must never replace the
   * post-mutation account when it eventually resolves.
   */
  const accountMutationEpoch = useRef(0);
  /** Freshness is per crew: each one owns its Build window and its own sync. */
  const lastProjection = useRef(new Map<string, { fingerprint: string; syncedAt: number }>());
  const lastDashboard = useRef({ crewId: "", loadedAt: 0 });
  const dashboardInFlight = useRef<{ crewId: string; request: Promise<void> } | null>(null);
  const propsInFlight = useRef(new Set<string>());

  const resetCrewClientState = useCallback((): void => {
    setLatestInviteUrl(null);
    lastProjection.current.clear();
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

  // Dismissed Props are read fresh whenever the signed-in account changes,
  // rather than via an effect: it's cheap, synchronous localStorage state
  // being adjusted to match a prop, exactly the case React's own effect
  // guidance says to handle during render instead of after it.
  if ((user?.id ?? null) !== dismissedPropIdsUserId.current) {
    dismissedPropIdsUserId.current = user?.id ?? null;
    setDismissedPropIds(user ? loadDismissedPropNotificationIds(user.id) : new Set());
  }

  const reloadAccount = useCallback(async (
    nextUser: User,
    preferredCrewId?: string,
    source: "foreground" | "mutation" | "normal" = "normal",
  ): Promise<void> => {
    if (!availability.configured) return;
    const mutationEpoch = source === "mutation"
      ? ++accountMutationEpoch.current
      : accountMutationEpoch.current;
    const preferred = preferredCrewId ?? loadActiveCrewId(nextUser.id) ?? undefined;
    const loaded = await loadCrewAccount(availability.client, nextUser, preferred);
    // A focus/visibility request that began before an explicit mutation may
    // contain an older or incomplete roster. The mutation reload is canonical.
    if (source === "foreground" && mutationEpoch !== accountMutationEpoch.current) return;
    if (latest.current.user && latest.current.user.id !== nextUser.id) return;
    // Remember what actually resolved, so a crew that was left, deleted or
    // never joined stops being asked for on the next load.
    if (loaded.crew && loaded.crew.id !== preferred) {
      saveActiveCrewId(nextUser.id, loaded.crew.id);
    }
    latest.current = { ...latest.current, user: nextUser, account: loaded };
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
      if (nextUser) {
        setPendingInvite((current) => current && current.accountId === null
          ? { ...current, accountId: nextUser.id }
          : current);
      }
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
      setPendingInvite((current) => {
        if (!current) return null;
        if (!nextUser) return current;
        if (current.accountId && current.accountId !== nextUser.id) {
          clearPendingInvite();
          return null;
        }
        return current.accountId ? current : { ...current, accountId: nextUser.id };
      });
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
      .then((preview) => setPendingInvite((current) => ({ token: initialInviteToken, preview, error: null, accountId: current?.accountId ?? user?.id ?? null })))
      .catch((reason) =>
        setPendingInvite((current) => ({ token: initialInviteToken, preview: null, error: messageOf(reason), accountId: current?.accountId ?? user?.id ?? null })),
      );
  }, [availability, initialInviteToken, user?.id]);

  // Owners always get their Crew's durable link back on a later visit. The
  // RPC returns the existing capability or establishes one exactly once.
  const ownerCrewId = account?.role === "owner" ? account.crew?.id ?? null : null;
  useEffect(() => {
    if (!availability.configured || !user || !ownerCrewId) return;
    let active = true;
    void createCrewInvite(availability.client, ownerCrewId)
      .then((invite) => { if (active) setLatestInviteUrl(invite.url); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [availability, ownerCrewId, user]);

  /**
   * Shares the canonical account cache's safe projection with every crew the
   * account is in. An old device is never allowed to project before personal
   * account reconciliation has completed.
   *
   * A run belongs to the runner, not to whichever crew happens to be open, so
   * standing in one crew must never starve the others of contributions. Each
   * crew keeps its own freshness entry because each owns its own Build window,
   * and one crew's failure never stops the rest from syncing.
   */
  const syncProjection = useCallback(async (force = false): Promise<void> => {
    if (!availability.configured) return;
    const current = latest.current;
    const state = current.appState;
    const activeUser = current.user;
    const memberships = current.account?.memberships ?? [];
    if (!state || !activeUser || memberships.length === 0) return;
    if (
      loadActivePersonalOwner() !== activeUser.id ||
      !loadPersonalMetadata(activeUser.id).initialized
    ) return;
    const today = todayLocalDate();
    const failures: string[] = [];

    for (const membership of memberships) {
      const crew = membership.crew;
      const fingerprint = projectionFingerprint(state, today, crew.buildStartDate);
      const previous = lastProjection.current.get(crew.id);
      const fresh = previous !== undefined
        && Date.now() - previous.syncedAt < PROJECTION_STALE_MS;
      if (!force && fresh && fingerprint === previous.fingerprint) continue;
      try {
        const pendingDeletes = loadCrewDeleteTombstones().filter(
          (item) => item.crewId === crew.id && item.userId === activeUser.id,
        );
        for (const tombstone of pendingDeletes) {
          await deleteCrewRunProjection(availability.client, tombstone);
        }
        await syncCrewProjection(availability.client, {
          state,
          crewId: crew.id,
          userId: activeUser.id,
          today,
          buildStartDate: crew.buildStartDate,
          authoritativeEmpty: pendingDeletes.length > 0,
        });
        for (const tombstone of pendingDeletes) {
          removeCrewDeleteTombstone(tombstone);
        }
        lastProjection.current.set(crew.id, { fingerprint, syncedAt: Date.now() });
        if (crew.id === current.account?.crew?.id) lastDashboard.current.loadedAt = 0;
      } catch (reason) {
        failures.push(messageOf(reason));
      }
    }
    setProjectionError(failures[0] ?? null);
  }, [availability]);

  /** A deleted personal run is withdrawn from every crew it was shared with. */
  async function deleteRunContribution(localRunId: string): Promise<void> {
    const memberships = account?.memberships ?? [];
    if (!availability.configured || !user || memberships.length === 0) return;
    const deletedAt = new Date().toISOString();
    let retrySaved = true;
    let failed = false;

    for (const membership of memberships) {
      const tombstone: CrewDeleteTombstone = {
        crewId: membership.crew.id,
        userId: user.id,
        localRunId,
        deletedAt,
      };
      try {
        addCrewDeleteTombstone(tombstone);
      } catch {
        retrySaved = false;
      }
      try {
        await deleteCrewRunProjection(availability.client, tombstone);
        // The tombstone survives a successful delete on purpose: only a
        // completed projection sync can retire it, because that sync is what
        // proves the now-smaller local view is the authoritative one.
        lastProjection.current.delete(membership.crew.id);
      } catch {
        failed = true;
      }
    }

    lastDashboard.current.loadedAt = 0;
    setProjectionError(
      !failed
        ? null
        : retrySaved
          ? "Run deleted here. Crew cleanup will retry when STACK reconnects."
          : "Run deleted here, but Crew cleanup could not be saved for retry.",
    );
  }

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
    // Only a request for the crew being asked about can be shared; switching
    // crews must not be answered with the previous crew's load.
    if (dashboardInFlight.current?.crewId === crewId) {
      return dashboardInFlight.current.request;
    }

    const request = (async () => {
      setCrewDataStatus("loading");
      setCrewDataError(null);
      try {
        const buildStartDate = current.account?.crew?.buildStartDate;
        if (!buildStartDate) return;
        const loaded = await loadCrewDashboard(
          availability.client,
          crewId,
          userId,
          buildStartDate,
        );
        if (latest.current.account?.crew?.id !== crewId) return;
        setCrewData(loaded);
        setCrewDataStatus("ready");
        setPropsErrors({});
        lastDashboard.current = { crewId, loadedAt: Date.now() };
      } catch (reason) {
        const currentUser = latest.current.user;
        if (currentUser) {
          try {
            const refreshedAccount = await loadCrewAccount(
              availability.client,
              currentUser,
              crewId,
            );
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
    dashboardInFlight.current = { crewId, request };
    try {
      await request;
    } finally {
      if (dashboardInFlight.current?.request === request) dashboardInFlight.current = null;
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

  const fingerprint = appState && account?.crew
    ? projectionFingerprint(appState, todayLocalDate(), account.crew.buildStartDate)
    : "";
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
      const current = latest.current;
      if (!current.user || !current.account?.crew) return;
      void reloadAccount(current.user, current.account.crew.id, "foreground")
        .then(() => {
          if (!latest.current.account?.crew) resetCrewClientState();
        })
        .catch((reason) => setError(messageOf(reason)));
    };
    window.addEventListener("focus", refreshMembership);
    document.addEventListener("visibilitychange", refreshMembership);
    return () => {
      window.removeEventListener("focus", refreshMembership);
      document.removeEventListener("visibilitychange", refreshMembership);
    };
  }, [account?.crew, availability, reloadAccount, resetCrewClientState, user]);

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

  const visiblePropNotifications = (crewData?.propNotifications ?? []).filter(
    (notification) => !dismissedPropIds.has(notification.id),
  );
  const unread = account
    ? unreadPropNotifications(visiblePropNotifications, account.profile.propsSeenAt)
    : [];

  function dismissPropNotification(notificationId: string): void {
    if (!user) return;
    rememberDismissedPropNotification(user.id, notificationId);
    setDismissedPropIds((current) => new Set(current).add(notificationId));
  }

  async function markPropsSeen(): Promise<void> {
    if (!availability.configured || !user || unread.length === 0) return;
    const seenAt = new Date().toISOString();
    try {
      await updatePropsSeenAt(availability.client, user.id, seenAt);
      setAccount((current) =>
        current
          ? { ...current, profile: { ...current.profile, propsSeenAt: seenAt } }
          : current,
      );
    } catch {
      // Best-effort bookkeeping; the notification simply stays unread and
      // this retries the next time a Props surface is opened.
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
      } else if (
        reason instanceof CrewBuildPlacementError &&
        reason.kind === "unsupported"
      ) {
        setCrewBuildPlacementError("That block needs support from the Crew Build.");
      } else if (
        reason instanceof CrewBuildPlacementError &&
        reason.kind === "supporting"
      ) {
        setCrewBuildPlacementError("That block is supporting part of the Crew Build.");
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
    userId: user?.id ?? null,
    account,
    pendingInvite,
    latestInviteUrl,
    projectionError,
    crewData,
    crewDataStatus,
    crewDataError,
    propsPendingRunIds,
    propsErrors,
    unreadPropNotifications: unread,
    visiblePropNotifications,
    crewBuildPlacementPending,
    crewBuildPlacementError,
    createAccount: (input) => operate(async () => {
      if (!availability.configured) return;
      const nextUser = await createStackAccount(availability.client, input);
      setUser(nextUser);
      await reloadAccount(nextUser);
    }, "STACK account created. Choose the device that should initialize its personal data."),
    signIn: (input) => operate(async () => {
      if (!availability.configured) return;
      const nextUser = await signInToStack(availability.client, input);
      setUser(nextUser);
      await reloadAccount(nextUser);
    }, "Signed in. Loading the personal STACK saved to this account."),
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
    saveAccentColor: (accentColor) => operate(async () => {
      if (!availability.configured || !user) return;
      await updateAccentColor(availability.client, user.id, accentColor);
      await reloadAccount(user);
      lastDashboard.current.loadedAt = 0;
      await refreshCrewData(true);
    }, "Color updated."),
    saveRunnerIcon: (runnerIcon) => operate(async () => {
      if (!availability.configured || !user) return;
      await updateRunnerIcon(availability.client, user.id, runnerIcon);
      await reloadAccount(user);
      // Crewmates see this icon in rosters and legends, so the same forced
      // refresh the accent uses applies here.
      lastDashboard.current.loadedAt = 0;
      await refreshCrewData(true);
    }, "Runner Icon saved."),
    createCrew: (input) => operate(async () => {
      if (!availability.configured || !user) return;
      const createdCrewId = await createCrew(availability.client, input);
      // A crew you just made is the crew you meant to be looking at.
      if (createdCrewId) saveActiveCrewId(user.id, createdCrewId);
      resetCrewClientState();
      await reloadAccount(user, createdCrewId ?? undefined);
      await syncProjection(true);
    }, "Race Crew created."),
    switchCrew: (crewId) => operate(async () => {
      if (!availability.configured || !user) return;
      if (account?.crew?.id === crewId) return;
      if (!account?.memberships.some((item) => item.crew.id === crewId)) {
        throw new Error("That crew is no longer available.");
      }
      saveActiveCrewId(user.id, crewId);
      resetCrewClientState();
      await reloadAccount(user, crewId);
      await refreshCrewData(true);
    }),
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
      setAccount((current) => {
        if (!current?.crew) return current;
        const updated = { ...current.crew, ...input };
        return {
          ...current,
          crew: updated,
          memberships: current.memberships.map((item) =>
            item.crew.id === updated.id ? { ...item, crew: updated } : item,
          ),
        };
      });
      await reloadAccount(user, account.crew.id).catch(() => undefined);
      lastDashboard.current.loadedAt = 0;
      await syncProjection(true);
      await refreshCrewData(true);
    }, "Crew updated."),
    deleteCrew: () => operateResult(async () => {
      if (!availability.configured || !account?.crew || !user) {
        throw new Error("Crew could not be deleted. Refresh and try again.");
      }
      const deletedCrewId = account.crew.id;
      try {
        await deleteCrewRecord(availability.client, deletedCrewId);
      } catch (reason) {
        await reloadAccount(user, deletedCrewId).catch(() => undefined);
        throw reason;
      }
      setAccount((current) =>
        current
          ? {
            ...current,
            memberships: current.memberships.filter(
              (item) => item.crew.id !== deletedCrewId,
            ),
            crew: null,
            role: null,
            members: [],
            invites: [],
          }
          : current,
      );
      resetCrewClientState();
      // Any remaining crew becomes the view; the deleted one cannot be asked for.
      await reloadAccount(user, undefined).catch(() => undefined);
    }, "Crew deleted."),
    createInvite: () => operate(async () => {
      if (!availability.configured || !account?.crew) return;
      const crewId = account.crew.id;
      const created = await createCrewInvite(availability.client, crewId);
      setLatestInviteUrl(created.url);
      // Creating an invite is roster-neutral. Pin the reload to this Crew so a
      // saved preference or a simultaneous foreground event cannot switch it.
      if (user) await reloadAccount(user, crewId, "mutation");
    }, "Invite link ready."),
    resetInvite: () => operate(async () => {
      if (!availability.configured || !account?.crew) return;
      const invite = await resetCrewInvite(availability.client, account.crew.id);
      setLatestInviteUrl(invite.url);
    }, "Invite link reset. The previous link no longer works."),
    joinPendingInvite: () => operate(async () => {
      if (!availability.configured || !pendingInvite || !user) return;
      const joinedCrewId = await redeemCrewInvite(availability.client, pendingInvite.token);
      clearPendingInvite();
      setPendingInvite(null);
      if (joinedCrewId) saveActiveCrewId(user.id, joinedCrewId);
      resetCrewClientState();
      await reloadAccount(user, joinedCrewId ?? undefined);
      await syncProjection(true);
    }, "Joined Race Crew. Your local race and plan were not changed."),
    leaveCrew: () => operate(async () => {
      if (!availability.configured || !account?.crew || !user) return;
      await leaveCrew(availability.client, account.crew.id);
      resetCrewClientState();
      // No preference: whichever remaining crew is oldest becomes the view.
      await reloadAccount(user, undefined);
    }, "You left the crew. Personal STACK was not changed."),
    removeMember: (userId) => operate(async () => {
      if (!availability.configured || !account?.crew || !user) return;
      await removeCrewMember(availability.client, account.crew.id, userId);
      await reloadAccount(user);
      lastDashboard.current.loadedAt = 0;
      await refreshCrewData(true);
    }, "Crew member removed."),
    deleteRunContribution,
    refreshCrewData,
    toggleProps,
    markPropsSeen,
    dismissPropNotification,
    placeCrewBuildBlock: placeBlockInCrewBuild,
    clearCrewBuildPlacementError: () => setCrewBuildPlacementError(null),
    clearMessage: () => {
      setError(null);
      setMessage(null);
    },
  };
}
