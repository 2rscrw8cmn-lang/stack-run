import { describe, expect, it, vi } from "vitest";
import { createInitialAppState } from "../storage/migrations";
import { addDaysToLocalDate } from "../domain/dates";
import type { RunLog } from "../domain/types";
import { availableScheduledMatches, fetchIntervals, fetchIntervalsActivityDetail, fetchIntervalsRunProfile, intervalsBasicAuthorization, mergeCandidates, normalizeActivityList, normalizeIntervalsActivity, normalizeIntervalsActivityDetail, normalizeIntervalsRunProfile, selectRunFound, suggestScheduledMatches, unresolvedCandidates, VERIFIED_CROSS_TRAINING_TYPES, VERIFIED_RUNNING_TYPES } from "./intervals";

const activity = { id: "i1", type: "Run", start_date_local: "2026-06-10T07:00:00", distance: 5000, moving_time: 1500, elapsed_time: 1600, average_heartrate: "invalid" };
/**
 * Shaped after the real activity captured 2026-08-13: a HealthFit-synced HIIT
 * session with no distance at all, only elapsed/moving time and heart rate.
 */
const hiit = { id: "i-hiit", type: "HighIntensityIntervalTraining", start_date_local: "2026-08-13T06:04:12", distance: null, moving_time: 1715, elapsed_time: 1772, average_heartrate: 97, max_heartrate: 120 };

function runLog(overrides: Partial<RunLog> = {}): RunLog {
  return { id: "run", workoutId: null, completedDate: "2026-06-10", activityType: "easy", distanceMiles: 3.1, durationSeconds: 1500, effort: "solid", notes: "", createdAt: "now", updatedAt: "now", source: "manual", externalSource: null, importedMetrics: null, ...overrides };
}
function importedRun(activityId: string): RunLog {
  return runLog({ id: `run-${activityId}`, source: "intervals", externalSource: { provider: "intervals", activityId, sourceUpdatedAt: null, importedAt: "now" } });
}
const candidateFor = (id: string, date: string, overrides: Record<string, unknown> = {}) =>
  normalizeIntervalsActivity({ ...activity, id, start_date_local: `${date}T07:00:00`, ...overrides })!;
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
    expect(normalizeActivityList([activity], [importedRun("i1")], [])).toHaveLength(0);
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
  it("lets Today prefer the candidate suggested for the workout due now", () => {
    const state = createInitialAppState();
    const workouts = state.plan.weeks
      .flatMap((week) => week.workouts)
      .filter((item) => item.type !== "rest");
    const preferredWorkout = workouts[0];
    const newerWorkout = workouts[1];
    const preferred = candidateFor("preferred", preferredWorkout.date);
    const newer = candidateFor("newer", newerWorkout.date);

    const found = selectRunFound(
      [newer, preferred],
      state.plan,
      [],
      newerWorkout.date,
      preferredWorkout.id,
    );

    expect(found?.candidate.externalId).toBe("preferred");
    expect(found?.workout?.id).toBe(preferredWorkout.id);
  });
  it("never offers a stale candidate whose source activity is already accepted", () => {
    const state = createInitialAppState();
    const workout = state.plan.weeks
      .flatMap((week) => week.workouts)
      .find((item) => item.type !== "rest")!;
    const candidate = candidateFor("accepted", workout.date);

    expect(
      selectRunFound(
        [candidate],
        state.plan,
        [importedRun("accepted")],
        workout.date,
      ),
    ).toBeNull();
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

/**
 * The allowlist is one entry long on purpose, and the point of these tests is
 * that the filtering is a decision rather than an accident nobody can see.
 *
 * `Run` is the only Intervals running type this repository has ever observed:
 * every fixture, every captured payload and `docs/INTERVALS_INTEGRATION.md`
 * agree on it, and the contract says not to guess sport names. Aliases people
 * reasonably expect — `VirtualRun`, `TrailRun`, `Treadmill` — appear nowhere in
 * any source STACK has, so they stay out until a real payload shows one, at
 * which point this list is where it goes and this test is what changes.
 */
describe("verified running activity types", () => {
  it("accepts exactly the source-verified Intervals running type", () => {
    expect([...VERIFIED_RUNNING_TYPES]).toEqual(["Run"]);
    expect(normalizeIntervalsActivity(activity)).not.toBeNull();
  });

  it.each(["VirtualRun", "TrailRun", "Treadmill", "Ride", "VirtualRide", "Swim", "Walk", "Hike", "WeightTraining", "run", "RUN", ""])(
    "leaves an unverified type %s out of Run Data rather than guessing",
    (type) => {
      expect(normalizeIntervalsActivity({ ...activity, type })).toBeNull();
      expect(normalizeActivityList([{ ...activity, type }], [], [])).toEqual([]);
    },
  );
});

/**
 * `HighIntensityIntervalTraining` is the one Intervals cross-training source
 * type this repository has observed: captured from a real HIIT session,
 * recorded on watch and synced through HealthFit on 2026-08-13. It carried no
 * distance at all — Intervals' own `distance` and `icu_distance` fields were
 * both null — which is why Cross Training is the one STACK activity type that
 * does not require one (see `runValidation.ts`).
 */
describe("verified cross-training activity types", () => {
  it("accepts exactly the source-verified Intervals cross-training type", () => {
    expect([...VERIFIED_CROSS_TRAINING_TYPES]).toEqual(["HighIntensityIntervalTraining"]);
    const run = normalizeIntervalsActivity(hiit);
    expect(run).not.toBeNull();
    expect(run?.inferredActivityType).toBe("cross");
  });

  it("defaults a HIIT candidate's distance to zero rather than rejecting it", () => {
    const run = normalizeIntervalsActivity(hiit)!;
    expect(run.distanceMiles).toBe(0);
    expect(run.durationSeconds).toBe(1715);
    expect(run.metrics.averageHeartRate).toBe(97);
    expect(run.metrics.maxHeartRate).toBe(120);
  });

  it("still needs a duration even with distance excused", () => {
    expect(normalizeIntervalsActivity({ ...hiit, moving_time: undefined, elapsed_time: undefined })).toBeNull();
  });

  it("infers easy, never cross, for a verified running type", () => {
    expect(normalizeIntervalsActivity(activity)?.inferredActivityType).toBe("easy");
  });

  it.each(["Workout", "Elliptical", "WeightTraining", "Crossfit", "hiit", ""])(
    "leaves a plausible but unverified cross-training type %s out rather than guessing",
    (type) => {
      expect(normalizeIntervalsActivity({ ...hiit, type })).toBeNull();
      expect(normalizeActivityList([{ ...hiit, type }], [], [])).toEqual([]);
    },
  );
});

/**
 * Issue #41. A read answers "what changed lately"; it never answers "what is
 * still waiting to be reviewed", and the two used to be the same object.
 */
describe("unresolved candidate queue", () => {
  it("keeps a pending run a later, narrower read did not mention", () => {
    const a = candidateFor("a", "2026-07-01");
    const b = candidateFor("b", "2026-08-08");
    const c = candidateFor("c", "2026-08-09");

    expect(mergeCandidates([a, b, c], [b, c]).map((item) => item.externalId)).toEqual(["c", "b", "a"]);
  });

  it("refreshes a re-read snapshot in place instead of duplicating it", () => {
    const first = candidateFor("a", "2026-07-01");
    const corrected = candidateFor("a", "2026-07-01", { moving_time: 2100, distance: 8000, average_heartrate: 148 });

    const merged = mergeCandidates([first], [corrected]);
    expect(merged).toHaveLength(1);
    expect(merged[0].externalId).toBe("a");
    expect(merged[0].durationSeconds).toBe(2100);
    expect(merged[0].metrics.averageHeartRate).toBe(148);
  });

  it("does not resurrect a run that has since been imported or ignored", () => {
    const a = candidateFor("a", "2026-07-01");
    const b = candidateFor("b", "2026-07-02");
    const c = candidateFor("c", "2026-07-03");

    expect(unresolvedCandidates([a, b, c], [importedRun("b")], ["c"]).map((item) => item.externalId)).toEqual(["a"]);
    // A queue that somehow holds the same id twice still renders one row.
    expect(unresolvedCandidates([a, a], [], [])).toHaveLength(1);
  });
});

/**
 * Issue #40. The ±2-day helper is a confidence judgement, and it was also the
 * entire list the Match dropdown could offer — so a run the plan had moved
 * away from could not be matched to its workout at all.
 */
describe("manual scheduled matches", () => {
  const state = createInitialAppState();
  const plan = state.plan;
  const candidate = candidateFor("i1", "2026-08-04");

  it("suggests only what is within two days", () => {
    expect(suggestScheduledMatches(candidate, plan, []).map((item) => item.id)).toEqual(["workout-002", "workout-004"]);
  });

  it("offers every unmatched non-rest workout for a manual match, nearest first", () => {
    const available = availableScheduledMatches(candidate, plan, []);
    const ids = available.map((item) => item.id);

    expect(ids.slice(0, 4)).toEqual(["workout-002", "workout-004", "workout-006", "workout-007"]);
    // Five days out, so never a suggestion — and still the user's to choose.
    expect(suggestScheduledMatches(candidate, plan, []).map((item) => item.id)).not.toContain("workout-007");
    expect(ids).toContain("workout-007");
    expect(ids).toEqual([...new Set(ids)]);
    expect(available.every((item) => item.type !== "rest")).toBe(true);
    expect(ids).not.toContain("workout-001");
  });

  it("never offers a workout another run already satisfies", () => {
    const logs = [runLog({ id: "other", workoutId: "workout-007" })];
    expect(availableScheduledMatches(candidate, plan, logs).map((item) => item.id)).not.toContain("workout-007");
    expect(availableScheduledMatches(candidate, plan, logs).map((item) => item.id)).toContain("workout-006");
  });

  it("orders equal-distance dates by planned date and then by id", () => {
    // 2026-08-06 and 2026-08-08 both sit two days from a 2026-08-07 run.
    const middle = candidateFor("i2", "2026-08-07");
    expect(availableScheduledMatches(middle, plan, []).slice(0, 2).map((item) => item.id)).toEqual(["workout-004", "workout-006"]);
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

describe("Run Profile streams", () => {
  it("derives pace from velocity and keeps heart rate and elevation", () => {
    const profile = normalizeIntervalsRunProfile({
      time: [0, 30, 60],
      heartrate: [140, 150, 160],
      altitude: [100, 101, 99],
      velocity_smooth: [3.0, 3.2, 0],
    });
    expect(profile).not.toBeNull();
    expect(profile!.samples).toHaveLength(3);
    expect(profile!.samples[0].heartRate).toBe(140);
    expect(profile!.samples[0].paceSecondsPerMile).toBeCloseTo(1609.344 / 3.0, 3);
    expect(profile!.samples[0].elevationFeet).toBeCloseTo(100 * 3.28084, 3);
    // A stopped/near-zero velocity sample yields no pace rather than an infinite one.
    expect(profile!.samples[2].paceSecondsPerMile).toBeUndefined();
  });

  it("carries cadence exactly as the source reports it, without doubling or converting", () => {
    // The August 13 activity reports 79, and Intervals' own interval rows read
    // 79 / 79 / 80. Whatever convention that is, it is the source's, and STACK
    // repeats it rather than reinterpreting it as steps per minute.
    const profile = normalizeIntervalsRunProfile({
      time: [0, 30, 60, 90],
      cadence: [79, 79, 80, 0],
    });
    expect(profile!.samples.map((sample) => sample.cadence)).toEqual([79, 79, 80, undefined]);
    // Emphatically not 158/158/160.
    expect(profile!.samples.some((sample) => sample.cadence === 158)).toBe(false);
  });

  it("treats a standing-still cadence as absent rather than as a measured zero", () => {
    const profile = normalizeIntervalsRunProfile({ time: [0, 30, 60], cadence: [80, 0, 79] });
    expect(profile!.samples[1].cadence).toBeUndefined();
    expect(Object.keys(profile!.samples[1])).toEqual(["timeSeconds"]);
  });

  it("recognizes a cadence-only stream as a profile worth showing", () => {
    expect(normalizeIntervalsRunProfile({ time: [0, 30], cadence: [79, 80] })).not.toBeNull();
  });

  it("tolerates an array-of-descriptors stream shape, not only a keyed map", () => {
    const arrayShaped = normalizeIntervalsRunProfile([
      { type: "time", data: [0, 60] },
      { type: "heartrate", data: [140, 150] },
    ]);
    expect(arrayShaped?.samples.map((sample) => sample.heartRate)).toEqual([140, 150]);
  });

  it("resolves to null rather than guessing when the shape is unrecognized", () => {
    expect(normalizeIntervalsRunProfile(null)).toBeNull();
    expect(normalizeIntervalsRunProfile({})).toBeNull();
    expect(normalizeIntervalsRunProfile({ time: [0] })).toBeNull(); // fewer than 2 samples
    expect(normalizeIntervalsRunProfile({ time: [0, 30], other: [1, 2] })).toBeNull(); // no recognized metric
    // A stream whose length disagrees with `time` is dropped rather than misaligned.
    expect(normalizeIntervalsRunProfile({ time: [0, 30, 60], heartrate: [140, 150] })).toBeNull();
  });

  it("requests the streams endpoint only when called, separately from interval detail", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ time: [0, 60], heartrate: [140, 150] })),
    );
    await fetchIntervalsRunProfile("activity-1", "token");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/intervals?resource=activity-streams&id=activity-1",
      expect.objectContaining({ cache: "no-store" }),
    );
    fetchMock.mockRestore();
  });

  it("asks the direct personal-key path for exactly the four plotted series", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ time: [0, 60], heartrate: [140, 150] })),
    );
    await fetchIntervalsRunProfile("activity-1", { mode: "local-api-key", credential: "fake-personal-key" });
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://intervals.icu/api/v1/activity/activity-1/streams?types=time,heartrate,altitude,velocity_smooth,cadence",
    );
    fetchMock.mockRestore();
  });

  it("returns null rather than a guess when the response carries no recognizable stream", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({}), { status: 200 }));
    const profile = await fetchIntervalsRunProfile("activity-1", "token");
    expect(profile).toBeNull();
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
