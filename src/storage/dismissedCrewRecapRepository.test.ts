import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissCrewRecap,
  loadDismissedCrewRecapKeys,
} from "./dismissedCrewRecapRepository";
import { DISMISSED_CREW_RECAPS_STORAGE_KEY } from "./storageKeys";

describe("dismissed Crew Week Recaps", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("remembers a dismissal per account", () => {
    dismissCrewRecap("zack", "crew-1:2026-08-10");
    dismissCrewRecap("drew", "crew-1:2026-08-10");

    expect(loadDismissedCrewRecapKeys("zack").has("crew-1:2026-08-10")).toBe(true);
    expect(loadDismissedCrewRecapKeys("drew").has("crew-1:2026-08-10")).toBe(true);
    expect(loadDismissedCrewRecapKeys("sam").size).toBe(0);
  });

  it("keeps each crew's week separate, and does not repeat a key", () => {
    dismissCrewRecap("zack", "crew-1:2026-08-10");
    dismissCrewRecap("zack", "crew-1:2026-08-10");
    dismissCrewRecap("zack", "crew-2:2026-08-10");

    const stored = JSON.parse(
      localStorage.getItem(DISMISSED_CREW_RECAPS_STORAGE_KEY)!,
    );
    expect(stored.zack).toEqual(["crew-1:2026-08-10", "crew-2:2026-08-10"]);
  });

  it("reads a corrupted value as no dismissals rather than failing Today", () => {
    localStorage.setItem(DISMISSED_CREW_RECAPS_STORAGE_KEY, "{not json");
    expect(loadDismissedCrewRecapKeys("zack").size).toBe(0);

    localStorage.setItem(DISMISSED_CREW_RECAPS_STORAGE_KEY, JSON.stringify({ zack: 7 }));
    expect(loadDismissedCrewRecapKeys("zack").size).toBe(0);
  });
});
