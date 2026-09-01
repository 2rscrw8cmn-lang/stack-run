import { describe, expect, it } from "vitest";
import { runInsight } from "./runInsight.js";

/**
 * Issue #214, part 7: one useful line, or none.
 *
 * The tests that matter here are the ones about *not* saying something. The
 * mockup's insight row is a pleasant place to put a sentence, and that is
 * exactly why the rule has to be written down: STACK states arithmetic on
 * numbers the source gave it, and never a verdict on the run.
 */
describe("run insight", () => {
  it("states the zone a run mostly happened in, with its share and its duration", () => {
    expect(runInsight({ hrZoneSeconds: [120, 1_875, 300, 180, 0], structuredIntervalCount: 0 }))
      .toEqual({ kind: "zone", text: "76% of this run was in Zone 2 · 31:15" });
  });

  it("says nothing about zones when the run was in no particular zone", () => {
    // Four zones at roughly a quarter each: true, and useless as a headline.
    expect(runInsight({ hrZoneSeconds: [600, 640, 610, 620], structuredIntervalCount: 0 }))
      .toBeNull();
  });

  it("counts the structured groups the source actually named when there are no zones", () => {
    expect(runInsight({ hrZoneSeconds: null, structuredIntervalCount: 4 }))
      .toEqual({ kind: "intervals", text: "4 structured intervals recorded" });
    expect(runInsight({ hrZoneSeconds: null, structuredIntervalCount: 1 }))
      .toEqual({ kind: "intervals", text: "1 structured interval recorded" });
  });

  it("has nothing to say about a run whose source supplied neither", () => {
    expect(runInsight({ hrZoneSeconds: null, structuredIntervalCount: 0 })).toBeNull();
    expect(runInsight({ hrZoneSeconds: [], structuredIntervalCount: 0 })).toBeNull();
    expect(runInsight({ hrZoneSeconds: [0, 0, 0], structuredIntervalCount: 0 })).toBeNull();
  });

  it("prefers the zone statement to the interval count when it has both", () => {
    expect(runInsight({ hrZoneSeconds: [100, 900, 0], structuredIntervalCount: 6 })?.kind)
      .toBe("zone");
  });
});
