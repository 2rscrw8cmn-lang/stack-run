import { DISMISSED_CREW_RECAPS_STORAGE_KEY } from "./storageKeys";

type DismissedByUserId = Record<string, string[]>;

/**
 * Bounds the list per account. A recap ages off Today within days of its week
 * closing, so a handful of keys is already more history than the feature can
 * use; this only stops the value growing without limit on a long-lived device.
 */
const MAX_REMEMBERED_PER_USER = 60;

function loadAll(): DismissedByUserId {
  try {
    const raw = localStorage.getItem(DISMISSED_CREW_RECAPS_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).filter(
      (entry): entry is [string, string[]] =>
        Array.isArray(entry[1]) && entry[1].every((key) => typeof key === "string"),
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/**
 * Crew weeks this runner has dismissed from Today, so a recap they closed
 * stays closed for the rest of the days it would otherwise be shown.
 *
 * Device-local on purpose. Dismissing a recap is a statement about this
 * screen, not about the week — the fuller recap remains reachable, the Crew's
 * shared facts are untouched, and nothing about one member's dismissal is any
 * of their crewmates' business.
 */
export function loadDismissedCrewRecapKeys(userId: string): ReadonlySet<string> {
  return new Set(loadAll()[userId] ?? []);
}

export function dismissCrewRecap(userId: string, recapKey: string): void {
  try {
    const all = loadAll();
    const existing = all[userId] ?? [];
    if (existing.includes(recapKey)) return;
    localStorage.setItem(
      DISMISSED_CREW_RECAPS_STORAGE_KEY,
      JSON.stringify({
        ...all,
        [userId]: [...existing, recapKey].slice(-MAX_REMEMBERED_PER_USER),
      }),
    );
  } catch {
    // A dismissal that does not stick reappears next visit, and the recap
    // ages out on its own regardless. Not worth surfacing an error for.
  }
}
