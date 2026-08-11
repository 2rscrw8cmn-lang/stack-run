import { describe, expect, it } from "vitest";
import type { CrewMemberSummary } from "./types";
import { crewFreshness } from "./freshness";

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
