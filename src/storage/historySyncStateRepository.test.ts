import { afterEach, describe, expect, it, vi } from "vitest";
import { emptyHistorySyncRecord } from "../history/historySyncPolicy";
import {
  clearHistorySyncRecord,
  loadHistorySyncRecord,
  saveHistorySyncRecord,
} from "./historySyncStateRepository";
import { HISTORY_SYNC_STATE_STORAGE_KEY } from "./storageKeys";

const record = {
  lastSuccessAt: "2026-08-15T09:00:00.000Z",
  lastCompleteAt: "2026-08-15T09:00:00.000Z",
  lastAttemptAt: "2026-08-15T09:00:00.000Z",
  lastFailureMessage: null,
  storedActivities: 212,
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("history sync bookkeeping", () => {
  it("round-trips a record", () => {
    saveHistorySyncRecord(record);
    expect(loadHistorySyncRecord()).toEqual(record);
  });

  it("starts empty on a device that has never synced", () => {
    expect(loadHistorySyncRecord()).toEqual(emptyHistorySyncRecord());
  });

  it("scopes the record to an account, like every other personal slot", () => {
    saveHistorySyncRecord(record, "user-a");
    expect(loadHistorySyncRecord("user-b")).toEqual(emptyHistorySyncRecord());
    expect(loadHistorySyncRecord()).toEqual(emptyHistorySyncRecord());
    expect(loadHistorySyncRecord("user-a")).toEqual(record);
  });

  it("treats an unreadable record as a device that has not synced", () => {
    // Not an error state: the worst case is one extra read, and refusing to
    // start the app over sync bookkeeping would be absurd.
    localStorage.setItem(HISTORY_SYNC_STATE_STORAGE_KEY, "{not json");
    expect(loadHistorySyncRecord()).toEqual(emptyHistorySyncRecord());

    localStorage.setItem(HISTORY_SYNC_STATE_STORAGE_KEY, JSON.stringify([1, 2, 3]));
    expect(loadHistorySyncRecord()).toEqual(emptyHistorySyncRecord());
  });

  it("drops a value that is not the shape it claims to be", () => {
    localStorage.setItem(
      HISTORY_SYNC_STATE_STORAGE_KEY,
      JSON.stringify({
        lastSuccessAt: 17,
        lastCompleteAt: "not-a-date",
        lastAttemptAt: "2026-08-15T09:00:00.000Z",
        lastFailureMessage: "   ",
        storedActivities: -4,
      }),
    );

    expect(loadHistorySyncRecord()).toEqual({
      lastSuccessAt: null,
      lastCompleteAt: null,
      lastAttemptAt: "2026-08-15T09:00:00.000Z",
      lastFailureMessage: null,
      storedActivities: 0,
    });
  });

  it("never throws when the browser refuses to write", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("QuotaExceededError");
    });
    // Nothing a person decided lives here, so a refused write is a wasted
    // request later rather than something to interrupt the runner about.
    expect(() => saveHistorySyncRecord(record)).not.toThrow();
  });

  it("never throws when the browser refuses to read or clear", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new DOMException("SecurityError");
    });

    expect(loadHistorySyncRecord()).toEqual(emptyHistorySyncRecord());
    expect(() => clearHistorySyncRecord()).not.toThrow();
  });

  it("stores nothing but the five bookkeeping values", () => {
    saveHistorySyncRecord({ ...record, lastFailureMessage: "rate limited" });
    const raw = localStorage.getItem(HISTORY_SYNC_STATE_STORAGE_KEY)!;

    expect(Object.keys(JSON.parse(raw) as object).sort()).toEqual([
      "lastAttemptAt",
      "lastCompleteAt",
      "lastFailureMessage",
      "lastSuccessAt",
      "storedActivities",
    ]);
    // No credential, no activity identity, no source payload.
    expect(raw).not.toContain("credential");
    expect(raw).not.toContain("apiKey");
  });
});
