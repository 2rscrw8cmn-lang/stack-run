import { DISMISSED_PROP_NOTIFICATIONS_STORAGE_KEY } from "./storageKeys.js";

type DismissedByUserId = Record<string, string[]>;

/** Bounds the list per account; a Prop swiped away this long ago has long since aged out of the server's own feed anyway. */
const MAX_REMEMBERED_PER_USER = 200;

function loadAll(): DismissedByUserId {
  try {
    const raw = localStorage.getItem(DISMISSED_PROP_NOTIFICATIONS_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].every((id) => typeof id === "string"),
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** Props this runner has swiped off their own list, so a cleared row stays cleared across visits. */
export function loadDismissedPropNotificationIds(userId: string): ReadonlySet<string> {
  return new Set(loadAll()[userId] ?? []);
}

export function dismissPropNotification(userId: string, notificationId: string): void {
  try {
    const all = loadAll();
    const existing = all[userId] ?? [];
    if (existing.includes(notificationId)) return;
    localStorage.setItem(
      DISMISSED_PROP_NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify({
        ...all,
        [userId]: [...existing, notificationId].slice(-MAX_REMEMBERED_PER_USER),
      }),
    );
  } catch {
    // A dismissal that doesn't stick just reappears next visit; not worth surfacing.
  }
}
