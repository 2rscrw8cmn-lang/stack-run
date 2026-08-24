import {
  DISMISSED_CREW_RECAPS_STORAGE_KEY,
  SEEN_CREW_RECAPS_STORAGE_KEY,
} from "./storageKeys";

/**
 * What a runner has done about one Crew week's recap.
 *
 * Two statements, deliberately separate — the same distinction Props already
 * draws on the Crew screen:
 *
 * **Seen** is "I opened it". It clears the unread treatment on the Crew
 * notification and nothing else; the recap stays available for as long as its
 * week is current, because a story worth telling is worth replaying.
 *
 * **Cleared** is "I am done with it". It takes the prompt off both Today and
 * Crew for good.
 *
 * One record for both surfaces, on purpose. Today's teaser and Crew's
 * notification are one recap seen from two places, and issue #186 is explicit
 * that they must not maintain contradictory state: a recap cleared on Today
 * cannot still be sitting unread on Crew.
 *
 * Device-local, per account, per Crew week. Acknowledging a recap is a
 * statement about this screen, not about the week — the Crew's shared facts
 * are untouched and none of it is any crewmate's business.
 */

/**
 * Bounds each list per account. A recap ages out within days of its week
 * closing, so a handful of keys is already more history than the feature can
 * use; this only stops the value growing without limit on a long-lived device.
 */
const MAX_REMEMBERED_PER_USER = 60;

type KeysByUserId = Record<string, string[]>;

function loadAll(storageKey: string): KeysByUserId {
  try {
    const raw = localStorage.getItem(storageKey);
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

function loadKeys(storageKey: string, userId: string): ReadonlySet<string> {
  return new Set(loadAll(storageKey)[userId] ?? []);
}

function remember(storageKey: string, userId: string, recapKey: string): void {
  try {
    const all = loadAll(storageKey);
    const existing = all[userId] ?? [];
    if (existing.includes(recapKey)) return;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...all,
        [userId]: [...existing, recapKey].slice(-MAX_REMEMBERED_PER_USER),
      }),
    );
  } catch {
    // An acknowledgement that does not stick reappears next visit, and the
    // recap ages out on its own regardless. Not worth surfacing an error for.
  }
}

/** Crew weeks this runner has cleared. Hides the prompt on Today and on Crew. */
export function loadDismissedCrewRecapKeys(userId: string): ReadonlySet<string> {
  return loadKeys(DISMISSED_CREW_RECAPS_STORAGE_KEY, userId);
}

export function dismissCrewRecap(userId: string, recapKey: string): void {
  remember(DISMISSED_CREW_RECAPS_STORAGE_KEY, userId, recapKey);
}

/**
 * Crew weeks this runner has opened. Clears the unread treatment on the Crew
 * notification; never hides the recap, which is what `dismissCrewRecap` is for.
 */
export function loadSeenCrewRecapKeys(userId: string): ReadonlySet<string> {
  return loadKeys(SEEN_CREW_RECAPS_STORAGE_KEY, userId);
}

export function markCrewRecapSeen(userId: string, recapKey: string): void {
  remember(SEEN_CREW_RECAPS_STORAGE_KEY, userId, recapKey);
}
