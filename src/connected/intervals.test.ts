import { describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { fetchIntervalsActivityDetail, normalizeActivityList, normalizeIntervalsActivity, normalizeIntervalsActivityDetail, suggestScheduledMatches } from "./intervals";

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
  it("keeps only explicitly labelled, timed interval groups", () => {
    expect(normalizeIntervalsActivityDetail({ icu_intervals: [
      { name: "Warm up", moving_time: 600, distance: 1609.344, average_heartrate: 140 },
      { moving_time: 60, distance: 200 },
      { label: "Rep 1", elapsed_time: 90 },
    ] }).intervals).toEqual([
      { label: "Warm up", durationSeconds: 600, distanceMiles: 1, averageHeartRate: 140 },
      { label: "Rep 1", durationSeconds: 90 },
    ]);
  });
});

describe("Intervals activity detail request", () => {
  it("requests intervals only when called", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ icu_intervals: [] })));
    expect(fetchMock).not.toHaveBeenCalled();
    await fetchIntervalsActivityDetail("activity-1", "token");
    expect(fetchMock).toHaveBeenCalledWith("/api/intervals?resource=activity&id=activity-1&intervals=true", expect.objectContaining({ cache: "no-store" }));
    fetchMock.mockRestore();
  });
  it.each([[500, "could not be loaded"], [429, "rate limiting"]])("describes detail error %s", async (status, message) => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("", { status }));
    await expect(fetchIntervalsActivityDetail("activity-1", "token")).rejects.toThrow(message);
    fetchMock.mockRestore();
  });
});
