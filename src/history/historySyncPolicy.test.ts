import { describe, expect, it } from "vitest";
import { DEFAULT_HISTORICAL_LOOKBACK_DAYS } from "./historicalWindows.js";
import {
  emptyHistorySyncRecord,
  historySyncDecision,
  historySyncPhase,
  recordAfterSync,
  HISTORY_REFRESH_LOOKBACK_DAYS,
  HISTORY_RETRY_AFTER_MS,
  HISTORY_STALE_AFTER_MS,
  type HistorySyncRecord,
} from "./historySyncPolicy.js";

/**
 * The trigger policy, as a set of statements about when STACK is allowed to ask
 * Intervals for a year of activity.
 *
 * NEXT-1 could not answer any of these because nothing called the service; they
 * are the reason the policy is a pure function rather than a set of conditions
 * scattered through an effect.
 */

const NOW = Date.parse("2026-08-15T09:00:00.000Z");
const HOUR = 60 * 60_000;

function record(overrides: Partial<HistorySyncRecord> = {}): HistorySyncRecord {
  return { ...emptyHistorySyncRecord(), ...overrides };
}

function at(hoursAgo: number): string {
  return new Date(NOW - hoursAgo * HOUR).toISOString();
}

describe("when history is read", () => {
  it("never reads without a connection", () => {
    expect(
      historySyncDecision({
        hasConnection: false,
        isSyncing: false,
        record: record(),
        now: NOW,
      }),
    ).toEqual({ shouldSync: false, reason: "no-connection" });
  });

  it("does not read even on request without a connection", () => {
    expect(
      historySyncDecision({
        hasConnection: false,
        isSyncing: false,
        record: record(),
        now: NOW,
        isManual: true,
      }),
    ).toEqual({ shouldSync: false, reason: "no-connection" });
  });

  it("reads a full year the first time, and only the first time", () => {
    expect(
      historySyncDecision({
        hasConnection: true,
        isSyncing: false,
        record: record(),
        now: NOW,
      }),
    ).toEqual({
      shouldSync: true,
      lookbackDays: DEFAULT_HISTORICAL_LOOKBACK_DAYS,
      reason: "first-history",
    });
  });

  it("leaves fresh history alone", () => {
    expect(
      historySyncDecision({
        hasConnection: true,
        isSyncing: false,
        record: record({ lastSuccessAt: at(2), lastCompleteAt: at(2), lastAttemptAt: at(2) }),
        now: NOW,
      }),
    ).toEqual({ shouldSync: false, reason: "fresh" });
  });

  it("refreshes stale history with one window rather than a whole year again", () => {
    const stale = HISTORY_STALE_AFTER_MS / HOUR + 1;
    expect(
      historySyncDecision({
        hasConnection: true,
        isSyncing: false,
        record: record({
          lastSuccessAt: at(stale),
          lastCompleteAt: at(stale),
          lastAttemptAt: at(stale),
        }),
        now: NOW,
      }),
    ).toEqual({
      shouldSync: true,
      lookbackDays: HISTORY_REFRESH_LOOKBACK_DAYS,
      reason: "stale",
    });
  });

  it("will not attempt twice inside the cooling-off period, however many focus events arrive", () => {
    // Returning to STACK fires focus and visibilitychange, and iOS fires them
    // again when a sheet closes. None of them may become a request.
    const justTried = record({ lastAttemptAt: at(0.1) });
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(
        historySyncDecision({
          hasConnection: true,
          isSyncing: false,
          record: justTried,
          now: NOW,
        }),
      ).toEqual({ shouldSync: false, reason: "attempted-recently" });
    }
  });

  it("keeps a failed first sync waiting rather than retrying immediately", () => {
    const failed = record({
      lastAttemptAt: at(0.5),
      lastFailureMessage: "Intervals.icu is rate limiting sync. Try again later.",
    });

    expect(
      historySyncDecision({ hasConnection: true, isSyncing: false, record: failed, now: NOW }),
    ).toEqual({ shouldSync: false, reason: "attempted-recently" });

    // …and tries the full year again once the period is over.
    expect(
      historySyncDecision({
        hasConnection: true,
        isSyncing: false,
        record: failed,
        now: NOW + HISTORY_RETRY_AFTER_MS,
      }),
    ).toMatchObject({
      shouldSync: true,
      lookbackDays: DEFAULT_HISTORICAL_LOOKBACK_DAYS,
      reason: "first-history",
    });
  });

  it("never starts a second read while one is in flight", () => {
    expect(
      historySyncDecision({
        hasConnection: true,
        isSyncing: true,
        record: record(),
        now: NOW,
      }),
    ).toEqual({ shouldSync: false, reason: "already-syncing" });
  });

  it("honours a read the runner asked for, fresh or cooling off", () => {
    expect(
      historySyncDecision({
        hasConnection: true,
        isSyncing: false,
        record: record({ lastSuccessAt: at(0.1), lastCompleteAt: at(0.1), lastAttemptAt: at(0.1) }),
        now: NOW,
        isManual: true,
      }),
    ).toEqual({
      shouldSync: true,
      lookbackDays: HISTORY_REFRESH_LOOKBACK_DAYS,
      reason: "requested",
    });
  });

  it("treats an unreadable timestamp as no timestamp rather than as now", () => {
    expect(
      historySyncDecision({
        hasConnection: true,
        isSyncing: false,
        record: record({ lastAttemptAt: "not-a-date", lastSuccessAt: "not-a-date" }),
        now: NOW,
      }),
    ).toMatchObject({ shouldSync: true, reason: "first-history" });
  });
});

describe("what STACK says about the runner's history", () => {
  const situation = (
    over: Partial<HistorySyncRecord>,
    extra: { hasConnection?: boolean; isSyncing?: boolean } = {},
  ) =>
    historySyncPhase({
      hasConnection: extra.hasConnection ?? true,
      isSyncing: extra.isSyncing ?? false,
      record: record(over),
      now: NOW,
    });

  it("distinguishes six states rather than reporting a bare failure", () => {
    expect(situation({}, { hasConnection: false })).toBe("no-connection");
    expect(situation({}, { isSyncing: true })).toBe("syncing");
    expect(situation({})).toBe("never-synced");
    expect(situation({ lastSuccessAt: at(1), lastCompleteAt: at(1) })).toBe("fresh");
    expect(
      situation({
        lastSuccessAt: at(HISTORY_STALE_AFTER_MS / HOUR + 1),
        lastCompleteAt: at(HISTORY_STALE_AFTER_MS / HOUR + 1),
      }),
    ).toBe("stale");
    expect(
      situation({ lastSuccessAt: at(1), lastCompleteAt: null, lastFailureMessage: "rate limited" }),
    ).toBe("partial");
  });

  it("calls a manual-only device unconnected rather than broken", () => {
    // A runner with no Intervals connection is not in an error state and must
    // never be told their history failed to load.
    expect(situation({}, { hasConnection: false })).toBe("no-connection");
    expect(
      situation({ lastFailureMessage: "Run Data could not be reached." }, { hasConnection: false }),
    ).toBe("no-connection");
  });
});

describe("bookkeeping after an attempt", () => {
  const outcomeAt = "2026-08-15T09:00:00.000Z";

  it("records a complete sync as both a success and a completion", () => {
    const next = recordAfterSync(record(), {
      windows: 5,
      windowsRead: 5,
      failureMessage: null,
      storedActivities: 212,
      persisted: true,
      at: outcomeAt,
    });

    expect(next).toEqual({
      lastSuccessAt: outcomeAt,
      lastCompleteAt: outcomeAt,
      lastAttemptAt: outcomeAt,
      lastFailureMessage: null,
      storedActivities: 212,
    });
  });

  it("records a partial sync as a success that is not yet complete", () => {
    // Four of five windows read: the runner has more history than they had, and
    // there is still something to come back for.
    const previous = record({ lastSuccessAt: at(48), lastCompleteAt: at(48), storedActivities: 100 });
    const next = recordAfterSync(previous, {
      windows: 5,
      windowsRead: 4,
      failureMessage: "Intervals.icu is rate limiting sync. Try again later.",
      storedActivities: 180,
      persisted: true,
      at: outcomeAt,
    });

    expect(next.lastSuccessAt).toBe(outcomeAt);
    expect(next.lastFailureMessage).toBe("Intervals.icu is rate limiting sync. Try again later.");
    expect(next.storedActivities).toBe(180);
    // The earlier complete read is not overwritten by an incomplete one.
    expect(next.lastCompleteAt).toBe(previous.lastCompleteAt);
  });

  it("does not count a sync that read nothing as a success", () => {
    const previous = record({ lastSuccessAt: at(48), lastCompleteAt: at(48), storedActivities: 100 });
    const next = recordAfterSync(previous, {
      windows: 5,
      windowsRead: 0,
      failureMessage: "Run Data could not be reached.",
      storedActivities: 0,
      persisted: false,
      at: outcomeAt,
    });

    expect(next.lastSuccessAt).toBe(previous.lastSuccessAt);
    expect(next.lastCompleteAt).toBe(previous.lastCompleteAt);
    // The history that was already stored is still what is stored.
    expect(next.storedActivities).toBe(100);
    // But the attempt still counts, so the cooling-off period applies.
    expect(next.lastAttemptAt).toBe(outcomeAt);
  });

  it("does not count a read the browser refused to store as a success", () => {
    const next = recordAfterSync(record(), {
      windows: 5,
      windowsRead: 5,
      failureMessage: "This browser could not save the runner's activity history.",
      storedActivities: 212,
      persisted: false,
      at: outcomeAt,
    });

    expect(next.lastSuccessAt).toBeNull();
    expect(next.lastCompleteAt).toBeNull();
    expect(next.lastAttemptAt).toBe(outcomeAt);
  });

  it("clears a failure once a later sync completes", () => {
    const failed = record({ lastAttemptAt: at(2), lastFailureMessage: "rate limited" });
    const next = recordAfterSync(failed, {
      windows: 1,
      windowsRead: 1,
      failureMessage: null,
      storedActivities: 212,
      persisted: true,
      at: outcomeAt,
    });

    expect(next.lastFailureMessage).toBeNull();
    expect(next.lastCompleteAt).toBe(outcomeAt);
  });
});
