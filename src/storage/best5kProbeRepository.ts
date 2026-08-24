import { BEST_5K_PROBES_STORAGE_KEY } from "./storageKeys";

/**
 * Which Intervals activities STACK has already asked about a best 5K.
 *
 * This is bookkeeping, not training data. The pace curve costs a second
 * request per activity and Intervals rate-limits, so the enrichment pass has
 * to be able to tell "no 5K in this run" apart from "not asked yet". Without
 * that, a runner whose history is full of 3-mile runs would spend a bounded
 * budget re-asking the same settled questions forever and never reach the runs
 * that do have an answer.
 *
 * It is device-local and deliberately not part of `AppState`: nothing here is
 * a fact about the runner's training, none of it is worth syncing to another
 * device, and a browser that loses it simply asks again.
 */

/**
 * What a probe is settled *against*. Two things can unsettle one:
 *
 * - the source revising the activity (`sourceUpdatedAt` moves), because the
 *   curve is then describing different data;
 * - STACK learning to read a response shape it previously could not, which is
 *   what the version is for — the normalizer is `Expected` rather than
 *   `Verified`, so a build that reads the real shape correctly must not
 *   inherit the previous build's "asked, nothing there".
 */
const PROBE_VERSION = 1;

type ProbesByActivityId = Record<string, string>;
type ProbesByScope = Record<string, ProbesByActivityId>;

/**
 * Bounds the record per account. Well past a multi-year Intervals history, and
 * small enough that the value can never grow without limit on a shared device.
 */
const MAX_REMEMBERED_PER_SCOPE = 4000;

const ANONYMOUS_SCOPE = "local";

function scopeOf(accountId: string | null): string {
  return accountId ?? ANONYMOUS_SCOPE;
}

/** The stamp a settled probe stores, so a revised activity is asked again. */
export function best5kProbeStamp(sourceUpdatedAt: string | null | undefined): string {
  return `${PROBE_VERSION}:${sourceUpdatedAt ?? ""}`;
}

function loadAll(): ProbesByScope {
  try {
    const raw = localStorage.getItem(BEST_5K_PROBES_STORAGE_KEY);
    if (raw === null) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const entries = Object.entries(parsed as Record<string, unknown>).flatMap(
      ([scope, value]): [string, ProbesByActivityId][] => {
        if (!value || typeof value !== "object" || Array.isArray(value)) return [];
        const probes = Object.entries(value as Record<string, unknown>).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string",
        );
        return [[scope, Object.fromEntries(probes)]];
      },
    );
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/** Activity ids already asked about, mapped to the stamp they were settled at. */
export function loadBest5kProbes(
  accountId: string | null = null,
): ReadonlyMap<string, string> {
  return new Map(Object.entries(loadAll()[scopeOf(accountId)] ?? {}));
}

/**
 * Records that these activities have been asked about at this stamp — whether
 * or not the source had a 5K to report. A settled "no" is exactly as useful as
 * a settled "yes" here, and is the more common answer.
 */
export function recordBest5kProbes(
  probes: ReadonlyMap<string, string>,
  accountId: string | null = null,
): void {
  if (probes.size === 0) return;
  try {
    const all = loadAll();
    const scope = scopeOf(accountId);
    const merged = { ...(all[scope] ?? {}), ...Object.fromEntries(probes) };
    const entries = Object.entries(merged).slice(-MAX_REMEMBERED_PER_SCOPE);
    localStorage.setItem(
      BEST_5K_PROBES_STORAGE_KEY,
      JSON.stringify({ ...all, [scope]: Object.fromEntries(entries) }),
    );
  } catch {
    // A probe record that does not stick costs one repeated request next
    // session, inside the same bounded budget. Never worth an error for.
  }
}

/** Only an explicit Forget Connection may call this. */
export function clearBest5kProbes(accountId: string | null = null): void {
  try {
    const all = loadAll();
    delete all[scopeOf(accountId)];
    localStorage.setItem(BEST_5K_PROBES_STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Nothing to recover: an un-cleared probe record only means the next pass
    // skips activities it already has an answer for.
  }
}
