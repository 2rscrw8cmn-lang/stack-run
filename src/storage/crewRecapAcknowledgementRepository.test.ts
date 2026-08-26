import { beforeEach, describe, expect, it } from "vitest";
import {
  dismissCrewRecap,
  loadDismissedCrewRecapKeys,
  loadSeenCrewRecapKeys,
  markCrewRecapSeen,
} from "./crewRecapAcknowledgementRepository.js";
import {
  DISMISSED_CREW_RECAPS_STORAGE_KEY,
  SEEN_CREW_RECAPS_STORAGE_KEY,
} from "./storageKeys.js";

describe("Crew Week Recap acknowledgement", () => {
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

    localStorage.setItem(SEEN_CREW_RECAPS_STORAGE_KEY, "{not json");
    expect(loadSeenCrewRecapKeys("zack").size).toBe(0);
  });

  /**
   * Issue #186: seen and cleared are different statements, and the recap has
   * to be able to hold one without the other. Opening the Crew notification
   * must not take the module off Today.
   */
  it("keeps seen and cleared apart", () => {
    markCrewRecapSeen("zack", "crew-1:2026-08-10");

    expect(loadSeenCrewRecapKeys("zack").has("crew-1:2026-08-10")).toBe(true);
    expect(loadDismissedCrewRecapKeys("zack").has("crew-1:2026-08-10")).toBe(false);

    dismissCrewRecap("zack", "crew-1:2026-08-10");
    expect(loadSeenCrewRecapKeys("zack").has("crew-1:2026-08-10")).toBe(true);
    expect(loadDismissedCrewRecapKeys("zack").has("crew-1:2026-08-10")).toBe(true);
  });

  /**
   * One record, both surfaces. Today's teaser and Crew's notification are the
   * same recap seen from two places, so a recap cleared on one cannot still be
   * sitting unread on the other.
   */
  it("is the same record whichever surface wrote it", () => {
    dismissCrewRecap("zack", "crew-1:2026-08-10");
    expect(loadDismissedCrewRecapKeys("zack").has("crew-1:2026-08-10")).toBe(true);
    expect(loadSeenCrewRecapKeys("drew").size).toBe(0);
  });
});
