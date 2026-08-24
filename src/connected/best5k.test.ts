import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunLog } from "../domain/types";
import {
  BEST_5K_MIN_MILES,
  couldHaveBest5k,
  enrichBest5k,
  planBest5kEnrichment,
} from "./best5k";
import {
  BEST_5K_MAX_SECONDS,
  BEST_5K_MIN_SECONDS,
  normalizeIntervalsBestEfforts,
} from "./intervals";
import {
  best5kProbeStamp,
  clearBest5kProbes,
  loadBest5kProbes,
  recordBest5kProbes,
} from "../storage/best5kProbeRepository";

const TODAY = "2026-09-15";

function run(overrides: Partial<RunLog> & { id: string }): RunLog {
  return {
    workoutId: null,
    completedDate: TODAY,
    activityType: "easy",
    distanceMiles: 6.2,
    durationSeconds: 3000,
    effort: "solid",
    notes: "",
    createdAt: "2026-09-15T00:00:00Z",
    updatedAt: "2026-09-15T00:00:00Z",
    source: "intervals",
    externalSource: {
      provider: "intervals",
      activityId: `a-${overrides.id}`,
      sourceUpdatedAt: null,
      importedAt: "2026-09-15T00:00:00Z",
    },
    importedMetrics: null,
    ...overrides,
  };
}

describe("Intervals best-effort normalization", () => {
  it("reads the 5,000 m point from parallel distance/time arrays", () => {
    expect(
      normalizeIntervalsBestEfforts({
        distances: [1000, 1609, 5000, 10000],
        secs: [230, 380, 1215, 2600],
      }).best5kSeconds,
    ).toBe(1215);
  });

  it("reads it from a list of curve points, and from a distance-keyed map", () => {
    expect(
      normalizeIntervalsBestEfforts([
        { distance: 1609, secs: 380 },
        { distance: 5000, secs: 1290 },
      ]).best5kSeconds,
    ).toBe(1290);
    expect(
      normalizeIntervalsBestEfforts({ curve: [{ distance: 5000, seconds: 1301 }] })
        .best5kSeconds,
    ).toBe(1301);
    expect(normalizeIntervalsBestEfforts({ "5000": 1333 }).best5kSeconds).toBe(1333);
  });

  it("never invents a 5K from a nearby distance", () => {
    // The source's own rule and STACK's: a 4.99 km run has a 4.99 km time.
    expect(
      normalizeIntervalsBestEfforts({ distances: [1000, 4990], secs: [230, 1180] })
        .best5kSeconds,
    ).toBeNull();
    expect(
      normalizeIntervalsBestEfforts([{ distance: 8000, secs: 2100 }]).best5kSeconds,
    ).toBeNull();
  });

  it("declines an implausible reading rather than showing a wrong 5K", () => {
    for (const secs of [0, -10, BEST_5K_MIN_SECONDS - 1, BEST_5K_MAX_SECONDS + 1]) {
      expect(
        normalizeIntervalsBestEfforts({ distances: [5000], secs: [secs] }).best5kSeconds,
      ).toBeNull();
    }
    expect(
      normalizeIntervalsBestEfforts({ distances: [5000], secs: [BEST_5K_MIN_SECONDS] })
        .best5kSeconds,
    ).toBe(BEST_5K_MIN_SECONDS);
  });

  it("yields no 5K for a shape it does not recognize, rather than a guess", () => {
    for (const raw of [null, undefined, 5, "1215", {}, { pace: 300 }, { distances: [5000] }]) {
      expect(normalizeIntervalsBestEfforts(raw).best5kSeconds).toBeNull();
    }
  });
});

describe("which runs could have a source-verified 5K", () => {
  it("needs an Intervals activity, real running, and 5,000 m of it", () => {
    expect(couldHaveBest5k(run({ id: "1" }))).toBe(true);
    expect(couldHaveBest5k(run({ id: "2", activityType: "cross" }))).toBe(false);
    expect(couldHaveBest5k(run({ id: "3", distanceMiles: BEST_5K_MIN_MILES - 0.01 }))).toBe(false);
    expect(couldHaveBest5k(run({ id: "4", distanceMiles: BEST_5K_MIN_MILES }))).toBe(true);
    expect(
      couldHaveBest5k(run({ id: "5", source: "manual", externalSource: null })),
    ).toBe(false);
  });

  it("leaves a run that already has one alone", () => {
    expect(
      couldHaveBest5k(run({ id: "6", importedMetrics: { best5kSeconds: 1290 } })),
    ).toBe(false);
    // An implausible stored value is not an answer, so the run is asked about
    // again rather than left carrying a number nothing will show.
    expect(
      couldHaveBest5k(run({ id: "7", importedMetrics: { best5kSeconds: 3 } })),
    ).toBe(true);
  });
});

describe("planning a bounded enrichment pass", () => {
  it("takes the newest runs first and stops at the pass limit", () => {
    const runs = [
      run({ id: "old", completedDate: "2026-09-01" }),
      run({ id: "new", completedDate: "2026-09-14" }),
      run({ id: "mid", completedDate: "2026-09-08" }),
    ];
    expect(
      planBest5kEnrichment(runs, new Map(), TODAY, { limit: 2 }).map((t) => t.runLogId),
    ).toEqual(["new", "mid"]);
  });

  it("never asks twice about the same settled activity", () => {
    const runs = [run({ id: "1" })];
    const probes = new Map([["a-1", best5kProbeStamp(null)]]);
    expect(planBest5kEnrichment(runs, probes, TODAY)).toEqual([]);
    // A revised activity is a different question, so it is asked again.
    const revised = new Map([["a-1", best5kProbeStamp("2026-09-16T00:00:00Z")]]);
    expect(planBest5kEnrichment(runs, revised, TODAY)).toHaveLength(1);
  });

  it("stays inside its lookback window and ignores the future", () => {
    const runs = [
      run({ id: "ancient", completedDate: "2025-01-01" }),
      run({ id: "ahead", completedDate: "2026-09-20" }),
    ];
    expect(planBest5kEnrichment(runs, new Map(), TODAY)).toEqual([]);
  });

  it("asks once per activity even when two runs point at it", () => {
    const shared = {
      provider: "intervals" as const,
      activityId: "a-shared",
      sourceUpdatedAt: null,
      importedAt: "now",
    };
    const runs = [
      run({ id: "1", externalSource: shared }),
      run({ id: "2", externalSource: shared }),
    ];
    expect(planBest5kEnrichment(runs, new Map(), TODAY)).toHaveLength(1);
  });
});

describe("running an enrichment pass", () => {
  it("stores only what the source reported, and settles every activity asked", async () => {
    const result = await enrichBest5k(
      [
        { runLogId: "r1", activityId: "a1", probeStamp: "1:" },
        { runLogId: "r2", activityId: "a2", probeStamp: "1:" },
      ],
      async (activityId) => ({ best5kSeconds: activityId === "a1" ? 1290.4 : null }),
    );
    expect(result.seconds.get("r1")).toBe(1290);
    // A settled "no" is the common answer and is worth remembering: it is what
    // stops the next pass spending a request on the same question.
    expect(result.seconds.has("r2")).toBe(false);
    expect([...result.probes.keys()]).toEqual(["a1", "a2"]);
  });

  it("does not settle an activity whose request failed", async () => {
    const result = await enrichBest5k(
      [{ runLogId: "r1", activityId: "a1", probeStamp: "1:" }],
      async () => {
        throw new Error("Intervals.icu is rate limiting requests.");
      },
    );
    expect(result.seconds.size).toBe(0);
    expect(result.probes.size).toBe(0);
  });
});

describe("the probe record", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("is per account, additive and bounded to strings", () => {
    recordBest5kProbes(new Map([["a1", "1:"]]), "user-1");
    recordBest5kProbes(new Map([["a2", "1:x"]]), "user-1");
    recordBest5kProbes(new Map([["a3", "1:"]]), "user-2");
    expect([...loadBest5kProbes("user-1").keys()]).toEqual(["a1", "a2"]);
    expect([...loadBest5kProbes("user-2").keys()]).toEqual(["a3"]);
    expect(loadBest5kProbes(null).size).toBe(0);
  });

  it("tolerates a corrupt value and forgets only the scope asked for", () => {
    localStorage.setItem("stack.intervals.best-5k-probes.v1", "{not json");
    expect(loadBest5kProbes("user-1").size).toBe(0);
    recordBest5kProbes(new Map([["a1", "1:"]]), "user-1");
    recordBest5kProbes(new Map([["a2", "1:"]]), "user-2");
    clearBest5kProbes("user-1");
    expect(loadBest5kProbes("user-1").size).toBe(0);
    expect(loadBest5kProbes("user-2").size).toBe(1);
  });

  it("survives a browser that refuses to write", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("quota");
      });
    expect(() => recordBest5kProbes(new Map([["a1", "1:"]]), "user-1")).not.toThrow();
    setItem.mockRestore();
  });
});
