import { describe, expect, it } from "vitest";
import type { CrewMember, CrewMemberSummary } from "./types";
import { comparisonBarPercent, orderedComparisonRows } from "./comparisons";

const members: CrewMember[] = [
  { userId: "a", displayName: "A", role: "owner", joinedAt: "1", accentColor: null },
  { userId: "b", displayName: "B", role: "member", joinedAt: "2", accentColor: null },
  { userId: "c", displayName: "C", role: "member", joinedAt: "3", accentColor: null },
];

function summary(userId: string, weeklyMiles: number): CrewMemberSummary {
  return {
    userId,
    displayName: userId.toUpperCase(),
    weekStart: "2026-08-10",
    weeklyMiles,
    longestRun28dMiles: weeklyMiles,
    consistencyCompleted: 0,
    consistencyDue: 0,
    milesBuilt: weeklyMiles,
    updatedAt: "2026-08-10T00:00:00Z",
  };
}

describe("Crew comparisons", () => {
  it("sorts factual values descending without inventing a tie-breaker", () => {
    const rows = orderedComparisonRows("weekly-miles", members, [
      summary("a", 10),
      summary("b", 12),
      summary("c", 12),
    ]);
    expect(rows.map((row) => row.member.userId)).toEqual(["b", "c", "a"]);
  });

  it("puts zero-due consistency in the neutral unavailable group", () => {
    const rows = orderedComparisonRows("consistency", members, [
      { ...summary("a", 0), consistencyCompleted: 2, consistencyDue: 4 },
      summary("b", 0),
      { ...summary("c", 0), consistencyCompleted: 3, consistencyDue: 4 },
    ]);
    expect(rows.map((row) => row.member.userId)).toEqual(["c", "a", "b"]);
  });

  it("scales factual mile bars to the displayed maximum and consistency to 100%", () => {
    expect(comparisonBarPercent("weekly-miles", summary("a", 10), 20)).toBe(50);
    expect(comparisonBarPercent("weekly-miles", summary("b", 20), 20)).toBe(100);
    expect(
      comparisonBarPercent(
        "consistency",
        { ...summary("a", 0), consistencyCompleted: 3, consistencyDue: 4 },
        0.75,
      ),
    ).toBe(75);
    expect(comparisonBarPercent("consistency", summary("b", 0), 1)).toBe(0);
  });
});
