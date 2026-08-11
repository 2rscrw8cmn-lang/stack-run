import { describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { addDaysToLocalDate } from "../domain/dates";
import { fetchIntervals, fetchIntervalsActivityDetail, intervalsBasicAuthorization, normalizeActivityList, normalizeIntervalsActivity, normalizeIntervalsActivityDetail, selectRunFound, suggestScheduledMatches } from "./intervals";

const activity = { id: "i1", type: "Run", start_date_local: "2026-06-10T07:00:00", distance: 5000, moving_time: 1500, elapsed_time: 1600, average_heartrate: "invalid" };
describe("Intervals normalization", () => {
  it("converts objective fields and independently omits invalid metrics", () => {
    const run = normalizeIntervalsActivity(activity)!;
    expect(run.distanceMiles).toBeCloseTo(3.10686); expect(run.durationSeconds).toBe(1500);
    expect(run.metrics.elapsedTimeSeconds).toBe(1600); expect(run.metrics.averageHeartRate).toBeUndefined();
  });
  it("rounds a converted distance to the precision STACK's own runs carry", () => {
    // Otherwise every screen that prints the stored distance, and the edit
    // sheet's text field, show the whole float the conversion produced.
    expect(normalizeIntervalsActivity(activity)!.distanceMiles).toBe(3.11);
    expect(normalizeIntervalsActivityDetail({ icu_intervals: [{ name: "Rep", moving_time: 90, distance: 800 }] }).intervals[0].distanceMiles).toBe(0.5);
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
  it("offers Today the newest recent run, preferring one that completes the plan", () => {
    const state = createInitialAppState();
    const workout = state.plan.weeks.flatMap((week) => week.workouts).find((item) => item.type !== "rest")!;
    const matched = normalizeIntervalsActivity({ ...activity, id: "matched", start_date_local: `${workout.date}T08:00:00` })!;
    const unmatched = normalizeIntervalsActivity({ ...activity, id: "unmatched", start_date_local: `${workout.date}T18:00:00` })!;
    const older = normalizeIntervalsActivity({ ...activity, id: "older", start_date_local: `${addDaysToLocalDate(workout.date, -2)}T08:00:00` })!;

    const found = selectRunFound([older, unmatched, matched], state.plan, [], workout.date);
    expect(found?.candidate.externalId).toBe("matched");
    expect(found?.workout?.id).toBe(workout.id);
  });
  it("leaves a stale candidate to Run Data rather than to Today", () => {
    const state = createInitialAppState();
    const workout = state.plan.weeks.flatMap((week) => week.workouts).find((item) => item.type !== "rest")!;
    const old = normalizeIntervalsActivity({ ...activity, start_date_local: `${addDaysToLocalDate(workout.date, -9)}T08:00:00` })!;
    expect(selectRunFound([old], state.plan, [], workout.date)).toBeNull();
    // Nor does it offer something dated after today, which is not a run yet.
    const future = normalizeIntervalsActivity({ ...activity, start_date_local: `${addDaysToLocalDate(workout.date, 1)}T08:00:00` })!;
    expect(selectRunFound([future], state.plan, [], workout.date)).toBeNull();
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

describe("direct personal-key requests", () => {
  it("formats Basic auth as literal API_KEY colon personal key", async () => {
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify([])));

    await fetchIntervals(
      "activities",
      { mode: "local-api-key", credential: "  fake-personal-key  " },
      { oldest: "2026-08-01", newest: "2026-08-10" },
    );

    expect(intervalsBasicAuthorization("fake-personal-key")).toBe(
      `Basic ${btoa("API_KEY:fake-personal-key")}`,
    );
    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      "https://intervals.icu/api/v1/athlete/0/activities?oldest=2026-08-01&newest=2026-08-10",
    );
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("Authorization"),
    ).toBe(`Basic ${btoa("API_KEY:fake-personal-key")}`);
    expect(
      new Headers(fetchMock.mock.calls[0]?.[1]?.headers).has(
        "X-Stack-Sync-Token",
      ),
    ).toBe(false);
    fetchMock.mockRestore();
  });
});

/**
 * Each of these used to reach the phone as "Run Data could not be reached",
 * which named none of them and told the owner to do nothing.
 */
describe("Run Data failure messages", () => {
  const failure = (status: number, body?: object) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(body ? JSON.stringify(body) : "", { status, headers: body ? { "Content-Type": "application/json" } : undefined }));

  it.each([
    [503, { error: "not_configured", missing: "STACK_SYNC_TOKEN" }, "Set STACK_SYNC_TOKEN in the Vercel project"],
    [401, { error: "unauthorized" }, "match STACK_SYNC_TOKEN in Vercel exactly"],
    [502, { error: "upstream_authorization_failed" }, "Check INTERVALS_API_KEY in Vercel"],
    [502, { error: "upstream_rejected_request", upstreamStatus: 404 }, "refused that request (404)"],
    [504, { error: "upstream_timeout" }, "took too long to answer"],
    [429, { error: "rate_limited" }, "rate limiting sync"],
    [400, { error: "invalid_date_range" }, "does not serve"],
  ])("turns %s into the thing to go and fix", async (status, body, expected) => {
    const fetchMock = failure(status, body);
    await expect(fetchIntervals("status", "token")).rejects.toThrow(expected);
    fetchMock.mockRestore();
  });

  it("says the reader is missing when the route itself is not deployed", async () => {
    const fetchMock = failure(404);
    await expect(fetchIntervals("status", "token")).rejects.toThrow("no /api/intervals reader");
    fetchMock.mockRestore();
  });

  it("says the same when a static host answers 200 with the app's own HTML", async () => {
    // What an undeployed function looks like from the browser: a perfectly
    // successful response that is not JSON. Reported raw it reached the phone
    // as "Unexpected token '<'", which names a parser rather than a fix.
    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("<!doctype html><html></html>", { status: 200 }));
    await expect(fetchIntervals("status", "token")).rejects.toThrow(
      "no /api/intervals reader",
    );
    fetchMock.mockRestore();
  });

  it("separates a request that never arrived from an answer that refused it", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(fetchIntervals("status", "token")).rejects.toThrow("Check this device's connection");
    fetchMock.mockRestore();
  });

  it("sends the trimmed token, because a token is pasted at least as often as typed", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    await fetchIntervals("status", "  token\n");
    expect(new Headers(fetchMock.mock.calls[0]?.[1]?.headers).get("X-Stack-Sync-Token")).toBe("token");
    fetchMock.mockRestore();
  });
});
