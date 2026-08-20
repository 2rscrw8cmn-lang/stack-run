import { describe, expect, it } from "vitest";
import { avgPaceSecondsByUserId, type AvgPaceRun } from "./avgPace";

const today = "2026-08-28";

function run(
  userId: string,
  localDate: string,
  distanceMiles: number,
  durationSeconds: number,
  activityType: AvgPaceRun["activityType"] = "easy",
): AvgPaceRun {
  return { userId, localDate, distanceMiles, durationSeconds, activityType };
}

describe("Crew Avg Pace", () => {
  it("divides total duration by total distance rather than averaging run paces", () => {
    // A 1-mile 10:00 shakeout and a 9-mile 72:00 long run: the mean of the two
    // paces is 9:00, but the runner actually covered 10 miles in 82 minutes.
    const paces = avgPaceSecondsByUserId(
      [run("a", "2026-08-27", 1, 600), run("a", "2026-08-26", 9, 4320)],
      today,
    );
    expect(paces.get("a")).toBeCloseTo(492, 5);
  });

  it("ignores Cross Training, zero-distance and zero-duration activity", () => {
    const paces = avgPaceSecondsByUserId(
      [
        run("a", "2026-08-27", 3, 1800),
        run("a", "2026-08-26", 0, 2400, "cross"),
        run("a", "2026-08-25", 0, 1200),
        run("a", "2026-08-24", 4, 0),
      ],
      today,
    );
    expect(paces.get("a")).toBe(600);
  });

  it("only counts runs inside the trailing 28-day window", () => {
    const paces = avgPaceSecondsByUserId(
      [
        run("a", "2026-08-01", 1, 600),
        run("a", "2026-07-31", 1, 1200),
        run("a", "2026-08-29", 1, 1200),
      ],
      today,
    );
    expect(paces.get("a")).toBe(600);
  });

  it("omits a runner with no eligible running rather than reporting a zero pace", () => {
    const paces = avgPaceSecondsByUserId([run("a", "2026-08-27", 0, 1800, "cross")], today);
    expect(paces.has("a")).toBe(false);
  });

  it("keeps each member's total separate", () => {
    const paces = avgPaceSecondsByUserId(
      [run("a", "2026-08-27", 2, 1200), run("b", "2026-08-27", 2, 1800)],
      today,
    );
    expect(paces.get("a")).toBe(600);
    expect(paces.get("b")).toBe(900);
  });
});
