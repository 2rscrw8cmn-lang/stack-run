import type { IntervalsConnection } from "../connected/intervals.js";
import { loadIntervalsApiKey } from "../storage/intervalsCredentialRepository.js";
import { loadIntervalsSyncToken } from "../storage/intervalsTokenRepository.js";
import {
  LOCAL_PERSONAL_OWNER,
  loadActivePersonalOwner,
} from "../storage/personalSyncRepository.js";
import { clearHistoricalActivities } from "../storage/historicalActivityRepository.js";
import { formatHistoricalCoverage, summarizeHistoricalCoverage } from "./historicalCoverage.js";
import { historicalActivities, syncHistoricalActivities } from "./historicalSync.js";
import { DEFAULT_HISTORICAL_LOOKBACK_DAYS } from "./historicalWindows.js";

/**
 * A development diagnostic for the historical data foundation, and nothing
 * else.
 *
 * NEXT-1 builds a data layer with no screen in front of it, which leaves two
 * questions that only real data can answer: does a long lookback actually come
 * back from the owner's Intervals account, and which optional metrics are
 * genuinely populated on their runs? `docs/STACK_NEXT_AGENT_PROMPT.md` asks for
 * exactly this — a narrowly scoped developer diagnostic rather than an
 * analytics screen — and `docs/STACK_NEXT_IMPLEMENTATION.md` records the
 * deployed smoke test it exists to make performable.
 *
 * Three properties keep it safe to ship:
 *
 * 1. **Opt-in.** Nothing is installed unless this device has explicitly set
 *    `stack.history.diagnostics.v1` to `on` and reloaded. There is no UI that
 *    sets it, so it is off for every ordinary user.
 * 2. **No new authority.** It reuses the credential this device already holds
 *    through the same repositories the app uses, and never accepts, returns or
 *    prints one. A caller who could run this could already open Run Data.
 * 3. **Aggregates only.** Every result is a count, a ratio or a date range.
 *    No activity name, id, time or raw payload is ever returned, so a
 *    diagnostic result can be pasted into an issue without redacting it.
 */

export const HISTORY_DIAGNOSTICS_STORAGE_KEY = "stack.history.diagnostics.v1";
export const HISTORY_DIAGNOSTICS_GLOBAL = "__stackHistory";

export interface HistoryDiagnostics {
  /** The stored history's coverage report, without touching the network. */
  coverage(): string;
  /** Reads `lookbackDays` of history, reconciles it, and reports what changed. */
  sync(options?: { lookbackDays?: number }): Promise<string>;
  /** Discards this device's stored history so a sync can be re-run from empty. */
  clear(): void;
}

export function historyDiagnosticsEnabled(): boolean {
  try {
    return localStorage.getItem(HISTORY_DIAGNOSTICS_STORAGE_KEY) === "on";
  } catch {
    return false;
  }
}

/** The account this device's history belongs to, or null when signed out. */
function activeAccountId(): string | null {
  const owner = loadActivePersonalOwner();
  return owner === LOCAL_PERSONAL_OWNER ? null : owner;
}

/**
 * This device's Intervals connection, preferring the personal key exactly as
 * the app does. The credential is read and handed straight to the client; it
 * is never returned to the caller or written into a result string.
 */
function deviceConnection(accountId: string | null): IntervalsConnection | null {
  try {
    const apiKey = loadIntervalsApiKey(accountId);
    if (apiKey) return { mode: "local-api-key", credential: apiKey };
    const token = loadIntervalsSyncToken(accountId);
    if (token) return { mode: "legacy-proxy", credential: token };
  } catch {
    return null;
  }
  return null;
}

export function createHistoryDiagnostics(): HistoryDiagnostics {
  return {
    coverage() {
      const accountId = activeAccountId();
      return formatHistoricalCoverage(
        summarizeHistoricalCoverage(historicalActivities(accountId)),
      );
    },

    async sync({ lookbackDays = DEFAULT_HISTORICAL_LOOKBACK_DAYS } = {}) {
      const accountId = activeAccountId();
      const connection = deviceConnection(accountId);
      if (!connection) {
        return "no Intervals connection on this device — connect in Settings → Run Data first";
      }
      const started = Date.now();
      const result = await syncHistoricalActivities({ connection, lookbackDays, accountId });
      const lines = [
        `lookback: ${lookbackDays} days`,
        `windows: ${result.windowsRead}/${result.windows.length} read in ${((Date.now() - started) / 1000).toFixed(1)}s`,
        `added: ${result.added}  updated: ${result.updated}  unchanged: ${result.unchanged}`,
        `persisted: ${result.persisted}${result.persistError ? ` (${result.persistError})` : ""}`,
        result.failure
          ? `stopped at window ${result.failure.window.oldest}…${result.failure.window.newest}: ${result.failure.message} (${result.failure.remainingWindows} unread)`
          : "no failures",
        "",
        formatHistoricalCoverage(summarizeHistoricalCoverage(result.activities), result.rejected),
      ];
      return lines.join("\n");
    },

    clear() {
      clearHistoricalActivities(activeAccountId());
    },
  };
}

/**
 * Installs the diagnostic on `window` when this device has opted in.
 *
 * Returns whether it installed, which is the only thing the caller in
 * `main.tsx` does with it.
 */
export function installHistoryDiagnostics(
  target: Record<string, unknown> = globalThis as unknown as Record<string, unknown>,
): boolean {
  if (!historyDiagnosticsEnabled()) return false;
  target[HISTORY_DIAGNOSTICS_GLOBAL] = createHistoryDiagnostics();
  return true;
}
