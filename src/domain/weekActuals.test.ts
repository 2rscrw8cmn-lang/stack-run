import { describe, expect, it } from "vitest";
import type { RunLog } from "./types";
import { selectWeekActuals } from "./weekActuals";

const run = (completedDate: string, distanceMiles: number, durationSeconds: number, workoutId: string | null = null): RunLog => ({
  id: `run-${completedDate}-${distanceMiles}`, workoutId, completedDate, activityType: "easy",
  distanceMiles, durationSeconds, effort: "solid", notes: "",
  createdAt: "2026-08-01T12:00:00Z", updatedAt: "2026-08-01T12:00:00Z",
});

describe("selectWeekActuals", () => {
  it("counts every run in the week, scheduled or extra", () => {
    const actuals = selectWeekActuals(
      [run("2026-08-03", 3.11, 1800, "workout-1"), run("2026-08-05", 1.18, 796), run("2026-08-08", 6.2, 3600, "workout-2")],
      "2026-08-03",
      "2026-08-09",
    );
    expect(actuals).toEqual({ runCount: 3, distanceMiles: 10.49, durationSeconds: 6196, longestRunMiles: 6.2 });
  });

  it("keeps both ends of the week and excludes the days outside it", () => {
    const runs = [run("2026-08-02", 5, 2400), run("2026-08-03", 1, 600), run("2026-08-09", 2, 1200), run("2026-08-10", 5, 2400)];
    expect(selectWeekActuals(runs, "2026-08-03", "2026-08-09").distanceMiles).toBe(3);
  });

  it("is empty rather than zero-ish before anything is run", () => {
    expect(selectWeekActuals([], "2026-08-03", "2026-08-09")).toEqual({ runCount: 0, distanceMiles: 0, durationSeconds: 0, longestRunMiles: 0 });
  });

  it("does not let two-decimal distances drift into a total nobody can print", () => {
    expect(selectWeekActuals([run("2026-08-03", 1.18, 60), run("2026-08-04", 3.11, 60)], "2026-08-03", "2026-08-09").distanceMiles).toBe(4.29);
  });
});
