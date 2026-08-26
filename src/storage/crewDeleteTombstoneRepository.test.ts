import { beforeEach, describe, expect, it } from "vitest";
import {
  addCrewDeleteTombstone,
  loadCrewDeleteTombstones,
  removeCrewDeleteTombstone,
} from "./crewDeleteTombstoneRepository.js";
import { CREW_DELETE_TOMBSTONES_STORAGE_KEY } from "./storageKeys.js";

beforeEach(() => localStorage.clear());

describe("Crew explicit-deletion tombstones", () => {
  it("stores only minimal identity for an explicit failed cleanup", () => {
    addCrewDeleteTombstone({
      crewId: "crew-1",
      userId: "user-1",
      localRunId: "run-b",
      deletedAt: "2026-08-11T12:00:00Z",
    });
    expect(loadCrewDeleteTombstones()).toEqual([{
      crewId: "crew-1",
      userId: "user-1",
      localRunId: "run-b",
      deletedAt: "2026-08-11T12:00:00Z",
    }]);
    expect(localStorage.getItem(CREW_DELETE_TOMBSTONES_STORAGE_KEY)).not.toMatch(
      /distance|heart|note|intervals|appState/i,
    );
  });

  it("deduplicates retries and clears the tombstone after success", () => {
    const first = {
      crewId: "crew-1",
      userId: "user-1",
      localRunId: "run-b",
      deletedAt: "2026-08-11T12:00:00Z",
    };
    addCrewDeleteTombstone(first);
    addCrewDeleteTombstone({ ...first, deletedAt: "2026-08-11T12:05:00Z" });
    expect(loadCrewDeleteTombstones()).toHaveLength(1);

    removeCrewDeleteTombstone(first);
    expect(loadCrewDeleteTombstones()).toEqual([]);
    expect(localStorage.getItem(CREW_DELETE_TOMBSTONES_STORAGE_KEY)).toBeNull();
  });
});
