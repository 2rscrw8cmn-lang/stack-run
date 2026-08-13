import type { AppState } from "../domain/types";
import { migrateAppState } from "./migrations";
import { backupStorageKey } from "./storageKeys";
import type {
  PersonalCacheMetadata,
  PersonalOutbox,
  PersonalRevisionState,
} from "../personal-sync/types";

const ACTIVE_OWNER_KEY = "stack.personal.active-owner.v1";
const ACCOUNT_STATE_PREFIX = "stack.app-state.account.v1.";
const METADATA_PREFIX = "stack.personal-cache-meta.v1.";
const OUTBOX_PREFIX = "stack.personal-outbox.v1.";

export const LOCAL_PERSONAL_OWNER = "local";

function scoped(prefix: string, userId: string): string {
  return `${prefix}${encodeURIComponent(userId)}`;
}

export function loadActivePersonalOwner(): string {
  try {
    return localStorage.getItem(ACTIVE_OWNER_KEY) ?? LOCAL_PERSONAL_OWNER;
  } catch {
    return LOCAL_PERSONAL_OWNER;
  }
}

export function saveActivePersonalOwner(owner: string): void {
  localStorage.setItem(ACTIVE_OWNER_KEY, owner);
}

export function accountAppStateStorageKey(userId: string): string {
  return scoped(ACCOUNT_STATE_PREFIX, userId);
}

export function hasAccountAppState(userId: string): boolean {
  try {
    return localStorage.getItem(accountAppStateStorageKey(userId)) !== null;
  } catch {
    return false;
  }
}

export function loadAccountAppState(userId: string): AppState | null {
  try {
    const raw = localStorage.getItem(accountAppStateStorageKey(userId));
    return raw === null ? null : migrateAppState(JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function saveAccountAppState(userId: string, state: AppState): void {
  localStorage.setItem(accountAppStateStorageKey(userId), JSON.stringify(state));
}

export const EMPTY_PERSONAL_REVISIONS: PersonalRevisionState = {
  training: 0,
  build: 0,
  intervals: 0,
  runs: {},
};

export function emptyPersonalMetadata(): PersonalCacheMetadata {
  return {
    version: 1,
    initialized: false,
    revisions: { ...EMPTY_PERSONAL_REVISIONS, runs: {} },
    aliasesByCanonicalId: {},
    updatedAt: new Date(0).toISOString(),
  };
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

export function loadPersonalMetadata(userId: string): PersonalCacheMetadata {
  try {
    const raw = localStorage.getItem(scoped(METADATA_PREFIX, userId));
    if (raw === null) return emptyPersonalMetadata();
    const parsed = JSON.parse(raw) as Partial<PersonalCacheMetadata>;
    const revisions = parsed.revisions;
    if (
      parsed.version !== 1 ||
      typeof parsed.initialized !== "boolean" ||
      !revisions ||
      !isPositiveInteger(revisions.training) ||
      !isPositiveInteger(revisions.build) ||
      !isPositiveInteger(revisions.intervals) ||
      typeof revisions.runs !== "object" ||
      revisions.runs === null ||
      Object.values(revisions.runs).some((value) => !isPositiveInteger(value)) ||
      typeof parsed.aliasesByCanonicalId !== "object" ||
      parsed.aliasesByCanonicalId === null
    ) {
      return emptyPersonalMetadata();
    }
    return parsed as PersonalCacheMetadata;
  } catch {
    return emptyPersonalMetadata();
  }
}

export function savePersonalMetadata(
  userId: string,
  metadata: PersonalCacheMetadata,
): void {
  localStorage.setItem(scoped(METADATA_PREFIX, userId), JSON.stringify(metadata));
}

export function emptyPersonalOutbox(): PersonalOutbox {
  return {
    version: 1,
    generation: 0,
    reset: false,
    training: false,
    build: false,
    intervals: false,
    runs: {},
    updatedAt: new Date(0).toISOString(),
  };
}

export function loadPersonalOutbox(userId: string): PersonalOutbox {
  try {
    const raw = localStorage.getItem(scoped(OUTBOX_PREFIX, userId));
    if (raw === null) return emptyPersonalOutbox();
    const parsed = JSON.parse(raw) as Partial<PersonalOutbox>;
    if (
      parsed.version !== 1 ||
      !isPositiveInteger(parsed.generation) ||
      typeof parsed.reset !== "boolean" ||
      typeof parsed.training !== "boolean" ||
      typeof parsed.build !== "boolean" ||
      typeof parsed.intervals !== "boolean" ||
      typeof parsed.runs !== "object" ||
      parsed.runs === null
    ) {
      return emptyPersonalOutbox();
    }
    return parsed as PersonalOutbox;
  } catch {
    return emptyPersonalOutbox();
  }
}

export function savePersonalOutbox(userId: string, outbox: PersonalOutbox): void {
  const key = scoped(OUTBOX_PREFIX, userId);
  const hasWork =
    outbox.training ||
    outbox.reset ||
    outbox.build ||
    outbox.intervals ||
    Object.keys(outbox.runs).length > 0;
  if (hasWork) localStorage.setItem(key, JSON.stringify(outbox));
  else localStorage.removeItem(key);
}

export function hasPersonalOutboxWork(outbox: PersonalOutbox): boolean {
  return (
    outbox.training ||
    outbox.reset ||
    outbox.build ||
    outbox.intervals ||
    Object.keys(outbox.runs).length > 0
  );
}

export function backupPersonalState(
  userId: string,
  state: AppState,
  reason: string,
): string {
  const key = backupStorageKey(new Date().toISOString());
  localStorage.setItem(
    key,
    JSON.stringify({ reason, userId, state, backedUpAt: new Date().toISOString() }),
  );
  return key;
}
