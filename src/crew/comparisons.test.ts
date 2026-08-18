import { describe, expect, it } from "vitest";
import type { CrewMember } from "./types";
import {
  comparisonBarPercent,
  comparisonBest,
  formatComparisonReading,
  orderedComparisonRows,
  type ComparisonSummary,
} from "./comparisons";

const members: CrewMember[] = [
  { userId: "a", displayName: "A", role: "owner", joinedAt: "1", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  { userId: "b", displayName: "B", role: "member", joinedAt: "2", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  { userId: "c", displayName: "C", role: "member", joinedAt: "3", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
];

function summary(userId: string, weeklyMiles: number): ComparisonSummary {
  return {
    userId,
    displayName: userId.toUpperCase(),
    weekStart: "2026-08-10",
    weeklyMiles,
    longestRun28dMiles: weeklyMiles,
    consistencyCompleted: 0,
    consistencyDue: 0,
    milesBuilt: weeklyMiles,
    avgPaceSeconds: null,
    updatedAt: "2026-08-10T00:00:00Z",
  };
}

function paced(userId: string, avgPaceSeconds: number | null): ComparisonSummary {
  return { ...summary(userId, 0), avgPaceSeconds };
}

function rowsOf(summaries: ComparisonSummary[]) {
  return summaries.map((item) => ({
    member: members.find((member) => member.userId === item.userId)!,
    summary: item,
  }));
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

  it("scales factual mile bars to the best displayed value", () => {
    expect(comparisonBarPercent("weekly-miles", summary("a", 10), 20)).toBe(50);
    expect(comparisonBarPercent("weekly-miles", summary("b", 20), 20)).toBe(100);
  });

  /* Issue #120: pace is the one metric where a smaller number is the better one. */
  it("ranks a faster Avg Pace ahead of a slower one", () => {
    const rows = orderedComparisonRows("avg-pace", members, [
      paced("a", 9 * 60 + 42),
      paced("b", 8 * 60),
      paced("c", 11 * 60),
    ]);
    expect(rows.map((row) => row.member.userId)).toEqual(["b", "a", "c"]);
  });

  it("puts a member with no Avg Pace reading last, not first", () => {
    const rows = orderedComparisonRows("avg-pace", members, [
      paced("a", 10 * 60),
      paced("b", null),
      paced("c", 9 * 60),
    ]);
    expect(rows.map((row) => row.member.userId)).toEqual(["c", "a", "b"]);
  });

  it("takes the fastest pace as the full bar and shortens the slower ones", () => {
    const best = comparisonBest("avg-pace", rowsOf([paced("a", 600), paced("b", 480)]));
    expect(best).toBe(480);
    expect(comparisonBarPercent("avg-pace", paced("b", 480), best)).toBe(100);
    expect(comparisonBarPercent("avg-pace", paced("a", 600), best)).toBe(80);
    expect(comparisonBarPercent("avg-pace", paced("c", null), best)).toBe(0);
  });

  it("takes the largest value as the full bar for a mileage metric", () => {
    expect(comparisonBest("weekly-miles", rowsOf([summary("a", 10), summary("b", 22)]))).toBe(22);
  });

  it("prints Avg Pace as minutes per mile", () => {
    expect(formatComparisonReading("avg-pace", paced("a", 9 * 60 + 42))).toEqual({
      value: "9:42 /MI",
      detail: null,
    });
    expect(formatComparisonReading("avg-pace", paced("b", null)).value).toBe("—");
  });
});
