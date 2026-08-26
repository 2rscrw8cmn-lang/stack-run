import { describe, expect, it } from "vitest";
import type { CrewMemberSummary } from "./types.js";
import { crewFreshness, crewSyncStatus } from "./freshness.js";

function summary(updatedAt: string): CrewMemberSummary {
  return {
    userId: updatedAt,
    displayName: "Runner",
    weekStart: "2026-08-10",
    weeklyMiles: 0,
    longestRun28dMiles: 0,
    consistencyCompleted: 0,
    consistencyDue: 0,
    milesBuilt: 0,
    updatedAt,
  };
}

describe("Crew comparison freshness", () => {
  const now = new Date("2026-08-10T15:00:00Z").getTime();

  it("hides normal fresh timestamps", () => {
    expect(crewFreshness([summary("2026-08-10T14:57:00Z")], now)).toBeNull();
  });

  it("uses the oldest displayed projection and switches to warning after two hours", () => {
    expect(
      crewFreshness(
        [summary("2026-08-10T14:30:00Z"), summary("2026-08-10T12:00:00Z")],
        now,
      ),
    ).toEqual({ label: "Updated 3h ago", warning: true });
  });
});

describe("Crew sync status (issue #120)", () => {
  const now = new Date("2026-08-10T15:00:00Z").getTime();

  it("stays green while the numbers are current enough to compare", () => {
    expect(
      crewSyncStatus({ summaries: [summary("2026-08-10T14:30:00Z")], loading: false, error: false, now }),
    ).toEqual({ state: "healthy", label: "Refresh crew data. Crew data is up to date." });
  });

  it("reports syncing while a refresh is running, whatever the data says", () => {
    expect(
      crewSyncStatus({ summaries: [summary("2026-08-10T09:00:00Z")], loading: true, error: false, now }),
    ).toEqual({ state: "syncing", label: "Refreshing crew data" });
  });

  it("asks for attention once the numbers are meaningfully stale", () => {
    expect(
      crewSyncStatus({ summaries: [summary("2026-08-10T12:00:00Z")], loading: false, error: false, now }),
    ).toEqual({ state: "attention", label: "Refresh crew data. Updated 3h ago." });
  });

  it("asks for attention after a failed refresh even with fresh numbers", () => {
    expect(
      crewSyncStatus({ summaries: [summary("2026-08-10T14:59:00Z")], loading: false, error: true, now }),
    ).toEqual({ state: "attention", label: "Refresh crew data. Last refresh failed." });
  });
});
