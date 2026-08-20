import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntervalsCandidate } from "../connected/intervals";
import { StorageWriteError } from "./appStateRepository";
import {
  clearPendingIntervalsCandidates,
  loadPendingIntervalsCandidates,
  savePendingIntervalsCandidates,
} from "./intervalsPendingRepository";
import { INTERVALS_PENDING_STORAGE_KEY } from "./storageKeys";

const candidate: IntervalsCandidate = {
  externalId: "i1",
  sourceType: "Run",
  completedDate: "2026-07-04",
  distanceMiles: 5.02,
  durationSeconds: 2700,
  sourceUpdatedAt: "2026-07-04T13:00:00Z",
  metrics: { averageHeartRate: 148, hrZoneSeconds: [10, 20, 30] },
  inferredActivityType: "easy",
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("pending Intervals candidates", () => {
  it("round-trips the normalized snapshot the review screen shows", () => {
    savePendingIntervalsCandidates([candidate]);
    expect(loadPendingIntervalsCandidates()).toEqual([candidate]);
  });

  it("stores its own key and removes it rather than leaving an empty list", () => {
    savePendingIntervalsCandidates([candidate]);
    expect(localStorage.getItem(INTERVALS_PENDING_STORAGE_KEY)).toContain("i1");

    savePendingIntervalsCandidates([]);
    expect(localStorage.getItem(INTERVALS_PENDING_STORAGE_KEY)).toBeNull();
    expect(loadPendingIntervalsCandidates()).toEqual([]);
  });

  it("carries no credential and nothing raw from the source response", () => {
    savePendingIntervalsCandidates([candidate]);
    const stored = localStorage.getItem(INTERVALS_PENDING_STORAGE_KEY)!;
    expect(Object.keys(JSON.parse(stored)[0]).sort()).toEqual([
      "completedDate",
      "distanceMiles",
      "durationSeconds",
      "externalId",
      "inferredActivityType",
      "metrics",
      "sourceType",
      "sourceUpdatedAt",
    ]);
  });

  it("drops a row it cannot trust instead of handing back a broken candidate", () => {
    localStorage.setItem(
      INTERVALS_PENDING_STORAGE_KEY,
      JSON.stringify([
        candidate,
        { ...candidate, externalId: "" },
        { ...candidate, externalId: "bad-date", completedDate: "07/04/2026" },
        { ...candidate, externalId: "bad-distance", distanceMiles: "5" },
        { ...candidate, externalId: "bad-metrics", metrics: { averageHeartRate: "high" } },
        "not an object",
      ]),
    );
    expect(loadPendingIntervalsCandidates().map((item) => item.externalId)).toEqual(["i1"]);
  });

  it("treats unreadable storage as an empty queue rather than a broken app", () => {
    localStorage.setItem(INTERVALS_PENDING_STORAGE_KEY, "{not json");
    expect(loadPendingIntervalsCandidates()).toEqual([]);

    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadPendingIntervalsCandidates()).toEqual([]);
  });

  it("says so when the queue cannot be written, rather than promising it survived", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    expect(() => savePendingIntervalsCandidates([candidate])).toThrow(StorageWriteError);
  });

  it("clears the queue when Run Data is forgotten, quietly if it cannot", () => {
    savePendingIntervalsCandidates([candidate]);
    clearPendingIntervalsCandidates();
    expect(loadPendingIntervalsCandidates()).toEqual([]);

    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(() => clearPendingIntervalsCandidates()).not.toThrow();
  });

  it("keeps pending review queues isolated between signed-in accounts", () => {
    savePendingIntervalsCandidates([candidate], "user-a");
    savePendingIntervalsCandidates([{ ...candidate, externalId: "i2" }], "user-b");

    expect(loadPendingIntervalsCandidates("user-a").map((item) => item.externalId)).toEqual(["i1"]);
    expect(loadPendingIntervalsCandidates("user-b").map((item) => item.externalId)).toEqual(["i2"]);
    expect(loadPendingIntervalsCandidates()).toEqual([]);
  });
});
