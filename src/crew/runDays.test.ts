import { describe, expect, it } from "vitest";
import { runDaysByUserId } from "./runDays";

describe("Run Days", () => {
  it("counts distinct calendar days per member inside the trailing window", () => {
    const runs = [
      { userId: "zack", localDate: "2026-08-01" },
      { userId: "zack", localDate: "2026-08-01" }, // same day, two runs: counts once
      { userId: "zack", localDate: "2026-08-05" },
      { userId: "drew", localDate: "2026-08-10" },
    ];
    const result = runDaysByUserId(runs, "2026-08-10");
    expect(result.get("zack")).toBe(2);
    expect(result.get("drew")).toBe(1);
  });

  it("excludes runs outside the trailing window and future dates", () => {
    const runs = [
      { userId: "zack", localDate: "2026-07-01" }, // more than 28 days before 2026-08-10
      { userId: "zack", localDate: "2026-08-11" }, // after today
      { userId: "zack", localDate: "2026-07-14" }, // exactly the window start (28 days back)
    ];
    const result = runDaysByUserId(runs, "2026-08-10");
    expect(result.get("zack")).toBe(1);
  });

  it("returns an empty map for members with no runs in the window", () => {
    expect(runDaysByUserId([], "2026-08-10").size).toBe(0);
  });

  it("supports a custom window size", () => {
    const runs = [
      { userId: "zack", localDate: "2026-08-01" }, // outside a 7-day window
      { userId: "zack", localDate: "2026-08-09" },
    ];
    expect(runDaysByUserId(runs, "2026-08-10", 7).get("zack")).toBe(1);
  });
});
