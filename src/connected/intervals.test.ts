import { describe, expect, it } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { normalizeActivityList, normalizeIntervalsActivity, suggestScheduledMatches } from "./intervals";

const activity = { id: "i1", type: "Run", start_date_local: "2026-06-10T07:00:00", distance: 5000, moving_time: 1500, elapsed_time: 1600, average_heartrate: "invalid" };
describe("Intervals normalization", () => {
  it("converts objective fields and independently omits invalid metrics", () => {
    const run = normalizeIntervalsActivity(activity)!;
    expect(run.distanceMiles).toBeCloseTo(3.10686); expect(run.durationSeconds).toBe(1500);
    expect(run.metrics.elapsedTimeSeconds).toBe(1600); expect(run.metrics.averageHeartRate).toBeUndefined();
  });
  it("ignores non-running, duplicate and ignored activities", () => {
    expect(normalizeIntervalsActivity({ ...activity, type: "Ride" })).toBeNull();
    expect(normalizeActivityList([activity, activity], [], [])).toHaveLength(1);
    expect(normalizeActivityList([activity], [], ["i1"])).toHaveLength(0);
    expect(normalizeActivityList([activity], [{ id: "run", workoutId: null, completedDate: "2026-06-10", activityType: "easy", distanceMiles: 3.1, durationSeconds: 1500, effort: "solid", notes: "", createdAt: "now", updatedAt: "now", source: "intervals", externalSource: { provider: "intervals", activityId: "i1", sourceUpdatedAt: null, importedAt: "now" }, importedMetrics: null }], [])).toHaveLength(0);
  });
  it("suggests an unmatched workout within two days deterministically", () => {
    const state = createInitialAppState(); const workout = state.plan.weeks.flatMap((week) => week.workouts).find((item) => item.type !== "rest")!;
    const candidate = normalizeIntervalsActivity({ ...activity, start_date_local: `${workout.date}T08:00:00` })!;
    expect(suggestScheduledMatches(candidate, state.plan, [])[0]?.id).toBe(workout.id);
  });
});
