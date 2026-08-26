import { ACTIVE_CREW_STORAGE_KEY } from "./storageKeys.js";

type ActiveCrewByUserId = Record<string, string>;

/**
 * Which crew this browser is looking at, per account.
 *
 * A device preference, not account state: two runners sharing a browser
 * profile each keep their own last-viewed crew, and losing this file only
 * means the oldest membership opens first. Nothing here is training data, so
 * every read and write is best-effort and silent on failure.
 */
function loadAll(): ActiveCrewByUserId {
  try {
    const raw = localStorage.getItem(ACTIVE_CREW_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

export function loadActiveCrewId(userId: string): string | null {
  return loadAll()[userId] ?? null;
}

export function saveActiveCrewId(userId: string, crewId: string): void {
  try {
    localStorage.setItem(
      ACTIVE_CREW_STORAGE_KEY,
      JSON.stringify({ ...loadAll(), [userId]: crewId }),
    );
  } catch {
    // A remembered crew is a convenience; the account still loads without it.
  }
}

export function forgetActiveCrewId(userId: string): void {
  try {
    const remaining = loadAll();
    delete remaining[userId];
    if (Object.keys(remaining).length === 0) {
      localStorage.removeItem(ACTIVE_CREW_STORAGE_KEY);
      return;
    }
    localStorage.setItem(ACTIVE_CREW_STORAGE_KEY, JSON.stringify(remaining));
  } catch {
    // Same reasoning as the writer above.
  }
}
