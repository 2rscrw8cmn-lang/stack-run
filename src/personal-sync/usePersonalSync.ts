import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { IntervalsCandidate } from "../connected/intervals";
import { mergeCandidates } from "../connected/intervals";
import type { AppState, RunLog } from "../domain/types";
import { getSupabaseAvailability } from "../crew/supabaseClient";
import {
  adoptLegacyIntervalsApiKey,
} from "../storage/intervalsCredentialRepository";
import {
  loadPendingIntervalsCandidates,
  savePendingIntervalsCandidates,
} from "../storage/intervalsPendingRepository";
import { adoptLegacyIntervalsSyncToken } from "../storage/intervalsTokenRepository";
import { createInitialAppState, migrateAppState } from "../storage/migrations";
import {
  backupPersonalState,
  emptyPersonalOutbox,
  hasAccountAppState,
  hasPersonalOutboxWork,
  loadAccountAppState,
  loadActivePersonalOwner,
  loadPersonalMetadata,
  loadPersonalOutbox,
  LOCAL_PERSONAL_OWNER,
  saveAccountAppState,
  saveActivePersonalOwner,
  savePersonalMetadata,
  savePersonalOutbox,
} from "../storage/personalSyncRepository";
import {
  deletePersonalRuns,
  initializePersonalCloud,
  loadPersonalCloudSnapshot,
  PersonalCloudConflictError,
  reconcileCrewRunIdentity,
  resetPersonalCloud,
  savePersonalBuildDocument,
  savePersonalIntervalsDocument,
  savePersonalRun,
  savePersonalTrainingDocument,
} from "./personalCloudRepository";
import {
  appStateFromCloud,
  canonicalizeFirstDevice,
  mergeIntervalsDocuments,
  mergeMissingRunPlacements,
  reconcileLegacyRuns,
  repairCanonicalPlacements,
  rewritePlacementRunIds,
} from "./reconciliation";
import {
  intervalsDocumentFrom,
  trainingDocumentFrom,
  type PersonalCacheMetadata,
  type PersonalCloudSnapshot,
  type PersonalSyncController,
} from "./types";

interface Options {
  sessionStatus: "unconfigured" | "loading" | "signed-out" | "signed-in";
  userId: string | null;
  state: AppState;
  onReplaceState: (state: AppState) => void;
}

function jsonChanged(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) !== JSON.stringify(right);
}

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine !== false;
}

function messageOf(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Personal data could not be synchronized.";
}

function metadataFromSnapshot(snapshot: PersonalCloudSnapshot): PersonalCacheMetadata {
  return {
    version: 1,
    initialized: true,
    accountGeneration: snapshot.accountGeneration,
    revisions: {
      training: snapshot.trainingRevision,
      build: snapshot.buildRevision,
      intervals: snapshot.intervalsRevision,
      runs: Object.fromEntries(
        snapshot.runs.map((item) => [item.run.id, item.revision]),
      ),
    },
    aliasesByCanonicalId: Object.fromEntries(
      snapshot.runs.map((item) => [item.run.id, [...item.aliases]]),
    ),
    updatedAt: new Date().toISOString(),
  };
}

function rekeyRunInState(
  state: AppState,
  fromId: string,
  canonical: RunLog,
): AppState {
  const withoutCanonical = state.runLogs.filter(
    (run) => run.id !== canonical.id && run.id !== fromId,
  );
  const placements = rewritePlacementRunIds(state.blockPlacements, {
    [fromId]: canonical.id,
  });
  return {
    ...state,
    runLogs: [...withoutCanonical, canonical],
    blockPlacements: placements,
  };
}

function activeAliases(snapshot: PersonalCloudSnapshot): Array<[string, string[]]> {
  return snapshot.runs
    .filter((item) => item.deletedAt === null && item.aliases.length > 0)
    .map((item) => [item.run.id, item.aliases]);
}

export function usePersonalSync({
  sessionStatus,
  userId,
  state,
  onReplaceState,
}: Options): PersonalSyncController {
  const [availability] = useState(getSupabaseAvailability);
  const [status, setStatus] = useState<PersonalSyncController["status"]>(
    "local-only",
  );
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [deferred, setDeferred] = useState(false);
  const [pendingCandidates, setPendingCandidates] = useState<IntervalsCandidate[]>(
    () => loadPendingIntervalsCandidates(null),
  );
  const latest = useRef({ state, userId, pendingCandidates });
  const inFlight = useRef<Promise<void> | null>(null);
  const syncTimer = useRef<number | null>(null);
  const syncNowRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    latest.current = { state, userId, pendingCandidates };
  });

  const replaceForAccount = useCallback(
    (nextUserId: string, nextState: AppState, nextPending: readonly IntervalsCandidate[]) => {
      saveAccountAppState(nextUserId, nextState);
      savePendingIntervalsCandidates(nextPending, nextUserId);
      latest.current = {
        state: nextState,
        userId: nextUserId,
        pendingCandidates: [...nextPending],
      };
      setPendingCandidates([...nextPending]);
      onReplaceState(nextState);
    },
    [onReplaceState],
  );

  const adoptSnapshot = useCallback(
    async (nextUserId: string, snapshot: PersonalCloudSnapshot): Promise<void> => {
      const nextState = appStateFromCloud(snapshot);
      const metadata = metadataFromSnapshot(snapshot);
      savePersonalMetadata(nextUserId, metadata);
      savePersonalOutbox(nextUserId, emptyPersonalOutbox(snapshot.accountGeneration));
      replaceForAccount(nextUserId, nextState, snapshot.intervals.pendingCandidates);
      for (const [canonicalId, aliases] of activeAliases(snapshot)) {
        await reconcileCrewRunIdentity(availability.client!, canonicalId, aliases);
      }
      setInitialized(true);
      setStatus("ready");
      setError(null);
    },
    [availability, replaceForAccount],
  );

  const reconcileSecondDevice = useCallback(
    async (
      nextUserId: string,
      localState: AppState,
      localPending: readonly IntervalsCandidate[],
      snapshot: PersonalCloudSnapshot,
    ): Promise<void> => {
      backupPersonalState(
        nextUserId,
        localState,
        "Before adopting canonical personal STACK from another device",
      );
      const reconciliation = reconcileLegacyRuns(localState.runLogs, snapshot.runs);
      const uploadedIds = new Set<string>();
      for (const run of reconciliation.aliasRunsToRegister) {
        const saved = await savePersonalRun(
          availability.client!, snapshot.accountGeneration, 0, run,
        );
        reconciliation.localToCanonical[run.id] = saved.run.id;
        await reconcileCrewRunIdentity(
          availability.client!,
          saved.run.id,
          saved.aliases,
        );
      }
      for (const run of reconciliation.runsToUpload) {
        const saved = await savePersonalRun(
          availability.client!, snapshot.accountGeneration, 0, run,
        );
        uploadedIds.add(saved.run.id);
        if (saved.run.id !== run.id) {
          reconciliation.localToCanonical[run.id] = saved.run.id;
        }
      }

      const nextPlacements = mergeMissingRunPlacements(
        snapshot.placements,
        localState.blockPlacements,
        reconciliation.localToCanonical,
        uploadedIds,
      );
      if (jsonChanged(nextPlacements, snapshot.placements)) {
        try {
          await savePersonalBuildDocument(
            availability.client!,
            snapshot.accountGeneration,
            snapshot.buildRevision,
            nextPlacements,
          );
        } catch (reason) {
          if (!(reason instanceof PersonalCloudConflictError && reason.kind === "build")) {
            throw reason;
          }
          // The canonical tower moved while this device joined. Keep every run
          // and leave its old-device block unplaced instead of disturbing it.
        }
      }

      const mergedIntervals = mergeIntervalsDocuments(
        snapshot.intervals,
        localState,
        localPending,
      );
      if (jsonChanged(mergedIntervals, snapshot.intervals)) {
        try {
          await savePersonalIntervalsDocument(
            availability.client!,
            snapshot.accountGeneration,
            snapshot.intervalsRevision,
            mergedIntervals,
          );
        } catch (reason) {
          if (!(reason instanceof PersonalCloudConflictError && reason.kind === "intervals")) {
            throw reason;
          }
        }
      }

      const canonical = await loadPersonalCloudSnapshot(availability.client!);
      if (!canonical) throw new Error("Canonical personal STACK disappeared during adoption.");
      await adoptSnapshot(nextUserId, canonical);
      setMessage("This device now uses the personal STACK saved to your account.");
    },
    [adoptSnapshot, availability],
  );

  const syncNow = useCallback(async (): Promise<void> => {
    if (!availability.configured || !latest.current.userId) return;
    if (inFlight.current) return inFlight.current;
    const activeUserId = latest.current.userId;
    if (!loadPersonalMetadata(activeUserId).initialized) return;
    if (!online()) {
      setStatus("offline-pending");
      return;
    }

    let queueFollowUp = false;
    const request = (async () => {
      setStatus("syncing");
      setError(null);
      const started = loadPersonalOutbox(activeUserId);
      const startedGeneration = started.generation;
      const metadata = loadPersonalMetadata(activeUserId);

      try {
        if (!hasPersonalOutboxWork(started)) {
          const snapshot = await loadPersonalCloudSnapshot(availability.client!);
          if (snapshot) await adoptSnapshot(activeUserId, snapshot);
          return;
        }
        if (started.reset) {
          const current = latest.current.state;
          metadata.accountGeneration = await resetPersonalCloud(
            availability.client!,
            started.accountGeneration,
            trainingDocumentFrom(current),
            intervalsDocumentFrom(current, latest.current.pendingCandidates),
          );
        } else {
          const deletedRunIds = Object.entries(started.runs)
            .filter(([, mutation]) => mutation.kind === "delete")
            .map(([runId]) => runId);
          let deletionPlacements: Readonly<AppState["blockPlacements"]> | null = null;
          for (const [runId, mutation] of Object.entries(started.runs)) {
            if (mutation.kind === "delete") continue;
            const currentRun = latest.current.state.runLogs.find((run) => run.id === runId);
            if (!currentRun) continue;
            try {
              const saved = await savePersonalRun(
                availability.client!,
                started.accountGeneration,
                mutation.expectedRevision,
                currentRun,
              );
              metadata.revisions.runs[saved.run.id] = saved.revision;
              metadata.aliasesByCanonicalId[saved.run.id] = [...saved.aliases];
              // A second edit can land while this request is in flight. Its
              // durable outbox entry must advance to the revision we just
              // created or the next pass would reject and discard that edit.
              const concurrentOutbox = loadPersonalOutbox(activeUserId);
              const concurrentMutation = concurrentOutbox.runs[runId];
              if (concurrentOutbox.generation !== startedGeneration && concurrentMutation) {
                delete concurrentOutbox.runs[runId];
                concurrentOutbox.runs[saved.run.id] = concurrentMutation.kind === "upsert"
                  ? { ...concurrentMutation, expectedRevision: saved.revision }
                  : concurrentMutation;
                savePersonalOutbox(activeUserId, concurrentOutbox);
              }
              if (saved.run.id !== currentRun.id) {
                const next = rekeyRunInState(
                  latest.current.state,
                  currentRun.id,
                  saved.run,
                );
                replaceForAccount(activeUserId, next, latest.current.pendingCandidates);
              }
              await reconcileCrewRunIdentity(
                availability.client!,
                saved.run.id,
                saved.aliases,
              );
            } catch (reason) {
              if (
                reason instanceof PersonalCloudConflictError &&
                (reason.kind === "run" || reason.kind === "deleted")
              ) {
                backupPersonalState(
                  activeUserId,
                  latest.current.state,
                  reason.kind === "deleted"
                    ? "Run edit rejected because another device deleted the run"
                    : "Run edit rejected because another device saved a newer revision",
                );
                setMessage("A run changed on another device. This device refreshed it.");
                continue;
              }
              throw reason;
            }
          }

          if (deletedRunIds.length > 0) {
            const beforeDelete = await loadPersonalCloudSnapshot(availability.client!);
            if (!beforeDelete) throw new Error("Canonical personal STACK is unavailable.");
            if (beforeDelete.accountGeneration !== started.accountGeneration) {
              throw new PersonalCloudConflictError(
                "generation",
                "personal_generation_conflict",
              );
            }
            const requested = new Set(deletedRunIds);
            const deletedCanonicalIds = new Set(
              beforeDelete.runs
                .filter((item) =>
                  requested.has(item.run.id) || item.aliases.some((alias) => requested.has(alias)),
                )
                .map((item) => item.run.id),
            );
            const activeAfterDelete = new Set(
              beforeDelete.runs
                .filter((item) => item.deletedAt === null && !deletedCanonicalIds.has(item.run.id))
                .map((item) => item.run.id),
            );
            const repaired = repairCanonicalPlacements(
              beforeDelete.placements,
              activeAfterDelete,
            );
            const deleted = await deletePersonalRuns(
              availability.client!,
              started.accountGeneration,
              beforeDelete.buildRevision,
              deletedRunIds,
              repaired,
            );
            metadata.revisions.build = deleted.buildRevision;
            deletionPlacements = deleted.placements;
          }

          if (started.training) {
            try {
              metadata.revisions.training = await savePersonalTrainingDocument(
                availability.client!,
                started.accountGeneration,
                metadata.revisions.training,
                trainingDocumentFrom(latest.current.state),
              );
            } catch (reason) {
              if (reason instanceof PersonalCloudConflictError && reason.kind === "training") {
                backupPersonalState(
                  activeUserId,
                  latest.current.state,
                  "Plan change rejected because another device saved a newer revision",
                );
                setMessage("Your plan changed on another device. This device refreshed to the latest version.");
              } else throw reason;
            }
          }

          if (started.intervals) {
            try {
              metadata.revisions.intervals = await savePersonalIntervalsDocument(
                availability.client!,
                started.accountGeneration,
                metadata.revisions.intervals,
                intervalsDocumentFrom(
                  latest.current.state,
                  latest.current.pendingCandidates,
                ),
              );
            } catch (reason) {
              if (!(reason instanceof PersonalCloudConflictError && reason.kind === "intervals")) throw reason;
              // Ignored ids and unresolved review candidates are sets, not a
              // last-writer-wins document. Refresh, union, and retry so two
              // devices cannot make one another's review decisions vanish.
              const refreshed = await loadPersonalCloudSnapshot(availability.client!);
              if (!refreshed) {
                throw new Error("Canonical personal STACK is unavailable.", { cause: reason });
              }
              const cloudRuns = refreshed.runs
                .filter((item) => item.deletedAt === null)
                .map((item) => item.run);
              const merged = mergeIntervalsDocuments(
                refreshed.intervals,
                {
                  ...latest.current.state,
                  runLogs: [...cloudRuns, ...latest.current.state.runLogs],
                },
                latest.current.pendingCandidates,
              );
              metadata.revisions.intervals = await savePersonalIntervalsDocument(
                availability.client!,
                started.accountGeneration,
                refreshed.intervalsRevision,
                merged,
              );
            }
          }

          if (started.build) {
            if (
              deletionPlacements !== null &&
              !jsonChanged(deletionPlacements, latest.current.state.blockPlacements)
            ) {
              // The atomic delete already stored this exact deterministic
              // repack and returned its new Build revision.
            } else {
              try {
                metadata.revisions.build = await savePersonalBuildDocument(
                  availability.client!,
                  started.accountGeneration,
                  metadata.revisions.build,
                  latest.current.state.blockPlacements,
                );
              } catch (reason) {
                if (reason instanceof PersonalCloudConflictError && reason.kind === "build") {
                  backupPersonalState(
                    activeUserId,
                    latest.current.state,
                    "Personal Build change rejected because another device saved a newer revision",
                  );
                  setMessage("Your Build changed on another device. Choose the spot again.");
                } else throw reason;
              }
            }
          }
        }

        metadata.updatedAt = new Date().toISOString();
        savePersonalMetadata(activeUserId, metadata);
        const currentOutbox = loadPersonalOutbox(activeUserId);
        if (currentOutbox.generation === startedGeneration) {
          savePersonalOutbox(
            activeUserId,
            emptyPersonalOutbox(metadata.accountGeneration),
          );
        }
        const canonical = await loadPersonalCloudSnapshot(availability.client!);
        if (!canonical) throw new Error("Canonical personal STACK is unavailable.");
        // If another local mutation landed during the request, leave its cache
        // and outbox intact. The next pass will reconcile it against the new
        // revisions instead of overwriting the user's immediate edit.
        if (!hasPersonalOutboxWork(loadPersonalOutbox(activeUserId))) {
          await adoptSnapshot(activeUserId, canonical);
        } else {
          savePersonalMetadata(activeUserId, metadataFromSnapshot(canonical));
          setStatus("offline-pending");
          queueFollowUp = true;
        }
      } catch (reason) {
        if (reason instanceof PersonalCloudConflictError && reason.kind === "generation") {
          backupPersonalState(
            activeUserId,
            latest.current.state,
            "Offline changes rejected because the account was reset on another device",
          );
          const canonical = await loadPersonalCloudSnapshot(availability.client!);
          if (!canonical) {
            throw new Error("Canonical personal STACK is unavailable.", { cause: reason });
          }
          await adoptSnapshot(activeUserId, canonical);
          setMessage("This account was reset on another device. Your attempted local state was backed up.");
          return;
        }
        setError(messageOf(reason));
        setStatus(hasPersonalOutboxWork(loadPersonalOutbox(activeUserId))
          ? "offline-pending"
          : "error");
      }
    })();
    inFlight.current = request;
    try {
      await request;
    } finally {
      inFlight.current = null;
    }
    if (
      queueFollowUp &&
      online() &&
      latest.current.userId === activeUserId &&
      loadPersonalMetadata(activeUserId).initialized &&
      hasPersonalOutboxWork(loadPersonalOutbox(activeUserId))
    ) {
      if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
      syncTimer.current = window.setTimeout(() => {
        syncTimer.current = null;
        void syncNowRef.current();
      }, 0);
    }
  }, [adoptSnapshot, availability, replaceForAccount]);

  useEffect(() => {
    syncNowRef.current = syncNow;
  }, [syncNow]);

  const scheduleSync = useCallback(() => {
    if (syncTimer.current !== null) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      syncTimer.current = null;
      void syncNowRef.current();
    }, 0);
  }, []);

  const recordMutation = useCallback(
    (previous: AppState, next: AppState): void => {
      const activeUserId = latest.current.userId;
      if (!activeUserId) return;
      saveAccountAppState(activeUserId, next);
      latest.current = { ...latest.current, state: next };
      const metadata = loadPersonalMetadata(activeUserId);
      if (!metadata.initialized) return;
      const outbox = loadPersonalOutbox(activeUserId);
      if (!hasPersonalOutboxWork(outbox)) {
        outbox.accountGeneration = metadata.accountGeneration;
      }
      if (jsonChanged(trainingDocumentFrom(previous), trainingDocumentFrom(next))) {
        outbox.training = true;
      }
      if (jsonChanged(previous.blockPlacements, next.blockPlacements)) {
        outbox.build = true;
      }
      if (jsonChanged(previous.intervalsSync, next.intervalsSync)) {
        outbox.intervals = true;
      }
      const previousById = new Map(previous.runLogs.map((run) => [run.id, run] as const));
      const nextById = new Map(next.runLogs.map((run) => [run.id, run] as const));
      for (const [id, run] of nextById) {
        if (jsonChanged(previousById.get(id), run)) {
          outbox.runs[id] = {
            kind: "upsert",
            expectedRevision: metadata.revisions.runs[id] ?? 0,
          };
        }
      }
      for (const id of previousById.keys()) {
        if (!nextById.has(id)) {
          outbox.runs[id] = {
            kind: "delete",
            expectedRevision: metadata.revisions.runs[id] ?? 0,
          };
        }
      }
      outbox.generation += 1;
      outbox.updatedAt = new Date().toISOString();
      savePersonalOutbox(activeUserId, outbox);
      setStatus(online() ? "ready" : "offline-pending");
      scheduleSync();
    },
    [scheduleSync],
  );

  const recordPendingCandidates = useCallback(
    (candidates: readonly IntervalsCandidate[]): void => {
      const activeUserId = latest.current.userId;
      const next = [...candidates];
      setPendingCandidates(next);
      latest.current = { ...latest.current, pendingCandidates: next };
      savePendingIntervalsCandidates(next, activeUserId);
      if (!activeUserId || !loadPersonalMetadata(activeUserId).initialized) return;
      const outbox = loadPersonalOutbox(activeUserId);
      if (!hasPersonalOutboxWork(outbox)) {
        outbox.accountGeneration = loadPersonalMetadata(activeUserId).accountGeneration;
      }
      outbox.intervals = true;
      outbox.generation += 1;
      outbox.updatedAt = new Date().toISOString();
      savePersonalOutbox(activeUserId, outbox);
      scheduleSync();
    },
    [scheduleSync],
  );

  const initializeFromThisDevice = useCallback(async (): Promise<void> => {
    if (!availability.configured || !userId || loadPersonalMetadata(userId).initialized) return;
    setStatus("syncing");
    setError(null);
    try {
      const current = latest.current.state;
      const pending = mergeCandidates(
        loadPendingIntervalsCandidates(null),
        latest.current.pendingCandidates,
      );
      backupPersonalState(
        userId,
        current,
        "Before first-device personal account initialization",
      );
      const canonicalized = canonicalizeFirstDevice(
        current.runLogs,
        current.blockPlacements,
      );
      await initializePersonalCloud(availability.client, {
        training: trainingDocumentFrom(current),
        runs: canonicalized.runs,
        placements: canonicalized.placements,
        intervals: intervalsDocumentFrom(current, pending),
      });
      const canonical = await loadPersonalCloudSnapshot(availability.client);
      if (!canonical) throw new Error("Personal account initialization did not return canonical data.");
      adoptLegacyIntervalsApiKey(userId);
      adoptLegacyIntervalsSyncToken(userId);
      await adoptSnapshot(userId, canonical);
      setDeferred(false);
      setMessage("Personal STACK is now saved to your account.");
    } catch (reason) {
      setError(messageOf(reason));
      setStatus("initialization-required");
    }
  }, [adoptSnapshot, availability, userId]);

  const resetAccount = useCallback(async (fresh: AppState): Promise<void> => {
    const activeUserId = latest.current.userId;
    if (!activeUserId || !loadPersonalMetadata(activeUserId).initialized) return;
    replaceForAccount(activeUserId, fresh, []);
    const metadata = loadPersonalMetadata(activeUserId);
    const outbox = loadPersonalOutbox(activeUserId);
    outbox.accountGeneration = metadata.accountGeneration;
    outbox.reset = true;
    outbox.training = false;
    outbox.build = false;
    outbox.intervals = false;
    outbox.runs = {};
    outbox.generation += 1;
    outbox.updatedAt = new Date().toISOString();
    savePersonalOutbox(activeUserId, outbox);
    await syncNow();
  }, [replaceForAccount, syncNow]);

  useLayoutEffect(() => {
    if (!availability.configured || sessionStatus === "loading") return;
    let active = true;

    const switchAndHydrate = async (): Promise<void> => {
      if (sessionStatus !== "signed-in" || !userId) {
        if (loadActivePersonalOwner() !== LOCAL_PERSONAL_OWNER) {
          saveActivePersonalOwner(LOCAL_PERSONAL_OWNER);
          const local = (() => {
            try {
              const raw = localStorage.getItem("stack.app-state.v1");
              return raw ? migrateAppState(JSON.parse(raw) as unknown) : createInitialAppState();
            } catch {
              return createInitialAppState();
            }
          })();
          if (active) onReplaceState(local);
        }
        if (active) {
          setPendingCandidates(loadPendingIntervalsCandidates(null));
          setInitialized(false);
          setStatus("local-only");
        }
        return;
      }

      setStatus("loading");
      setError(null);
      const previousOwner = loadActivePersonalOwner();
      const alreadyCached = hasAccountAppState(userId);
      const candidate = alreadyCached
        ? loadAccountAppState(userId) ?? createInitialAppState()
        : previousOwner === LOCAL_PERSONAL_OWNER
          ? latest.current.state
          : createInitialAppState();
      const localPending = alreadyCached
        ? loadPendingIntervalsCandidates(userId)
        : previousOwner === LOCAL_PERSONAL_OWNER
          ? loadPendingIntervalsCandidates(null)
          : [];
      saveActivePersonalOwner(userId);
      replaceForAccount(userId, candidate, localPending);

      try {
        const snapshot = await loadPersonalCloudSnapshot(availability.client);
        if (!active) return;
        if (!snapshot) {
          setInitialized(false);
          setStatus("initialization-required");
          return;
        }
        // Validate the reconstructed schema-9 state before reconciliation can
        // write anything or canonical hydration can replace a valid cache.
        appStateFromCloud(snapshot);
        adoptLegacyIntervalsApiKey(userId);
        adoptLegacyIntervalsSyncToken(userId);
        const metadata = loadPersonalMetadata(userId);
        const outbox = loadPersonalOutbox(userId);
        if (
          metadata.initialized &&
          hasPersonalOutboxWork(outbox) &&
          snapshot.accountGeneration > metadata.accountGeneration
        ) {
          backupPersonalState(
            userId,
            candidate,
            "Offline changes rejected because the account was reset on another device",
          );
          await adoptSnapshot(userId, snapshot);
          setMessage("This account was reset on another device. Your attempted local state was backed up.");
          return;
        }
        if (metadata.initialized && hasPersonalOutboxWork(outbox)) {
          setInitialized(true);
          setStatus(online() ? "ready" : "offline-pending");
          if (online()) window.setTimeout(() => void syncNow(), 0);
          return;
        }
        if (!metadata.initialized && (candidate.runLogs.length > 0 || alreadyCached || previousOwner === LOCAL_PERSONAL_OWNER)) {
          await reconcileSecondDevice(userId, candidate, localPending, snapshot);
        } else {
          await adoptSnapshot(userId, snapshot);
        }
      } catch (reason) {
        if (!active) return;
        // The account cache remains intact and visible. A malformed or failed
        // cloud read never replaces it with an empty state.
        setError(messageOf(reason));
        setStatus("error");
      }
    };
    void switchAndHydrate();
    return () => {
      active = false;
    };
  }, [
    adoptSnapshot,
    availability,
    onReplaceState,
    reconcileSecondDevice,
    replaceForAccount,
    sessionStatus,
    syncNow,
    userId,
  ]);

  useEffect(() => {
    if (!initialized || !userId) return;
    const resume = () => {
      if (document.visibilityState !== "hidden" && online()) void syncNow();
    };
    window.addEventListener("online", resume);
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("online", resume);
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
    };
  }, [initialized, syncNow, userId]);

  const initialization =
    status === "initialization-required" && !deferred
      ? {
          runCount: state.runLogs.length,
          blockCount: state.blockPlacements.length,
          raceName: state.raceSetup?.name ?? state.plan.race.name,
        }
      : null;

  return {
    status,
    initialized,
    error,
    message,
    initialization,
    userId,
    pendingCandidates,
    recordMutation,
    recordPendingCandidates,
    initializeFromThisDevice,
    deferInitialization: () => setDeferred(true),
    syncNow,
    resetAccount,
    clearMessage: () => {
      setError(null);
      setMessage(null);
    },
  };
}
