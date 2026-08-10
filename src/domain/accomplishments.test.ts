import { describe, expect, it } from "vitest";
import type { RunLog, TrainingPlan } from "./types";
import { accomplishmentsForAddedRuns } from "./accomplishments";

const plan: TrainingPlan = {
  schemaVersion: 1,
  id: "plan",
  name: "Test plan",
  race: { name: "Test race", date: "2026-10-01", distanceMiles: 13.1 },
  startDate: "2026-08-01",
  endDate: "2026-10-01",
  weeks: [],
  notes: [],
};

function run(id: string, distanceMiles: number, completedDate = "2026-08-10"): RunLog {
  return {
    id,
    workoutId: null,
    completedDate,
    activityType: "easy",
    distanceMiles,
    durationSeconds: 1800,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-10T12:00:00.000Z",
    updatedAt: "2026-08-10T12:00:00.000Z",
  };
}

describe("accomplishmentsForAddedRuns", () => {
  it("marks a new active-plan longest run after there is a prior run", () => {
    expect(accomplishmentsForAddedRuns(plan, [run("prior", 6)], [run("new", 8)]))
      .toContainEqual({ id: "longest-new", label: "New Longest Run", value: "8 MI" });
  });

  it("does not call the first run or an out-of-period run a new longest", () => {
    expect(accomplishmentsForAddedRuns(plan, [], [run("first", 8)])).toEqual([]);
    expect(
      accomplishmentsForAddedRuns(
        plan,
        [run("prior", 6)],
        [run("old", 8, "2026-07-31")],
      ),
    ).toEqual([]);
  });

  it("reports only the highest meaningful miles-built threshold crossed", () => {
    expect(
      accomplishmentsForAddedRuns(
        plan,
        [run("prior", 48)],
        [run("new", 55)],
      ),
    ).toContainEqual({ id: "miles-100", label: "Miles Built", value: "100 MI" });
  });

  it("returns nothing when no run was added", () => {
    expect(accomplishmentsForAddedRuns(plan, [run("prior", 49)], [])).toEqual([]);
  });
});
