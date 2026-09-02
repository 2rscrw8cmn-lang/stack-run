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
  it("counts the structured groups the source actually named", () => {
    expect(runInsight({ structuredIntervalCount: 4 }))
      .toEqual({ kind: "intervals", text: "4 structured intervals recorded" });
    expect(runInsight({ structuredIntervalCount: 1 }))
      .toEqual({ kind: "intervals", text: "1 structured interval recorded" });
  });

  it("has nothing to say about a run whose source named no groups", () => {
    expect(runInsight({ structuredIntervalCount: 0 })).toBeNull();
  });

  it("cannot state a heart-rate fact at all", () => {
    /*
     * The follow-up pass removed the zone headline — `76% of this run was in
     * Zone 2` — from above Analysis. It was true, and it was in the wrong
     * place: a zone share is a heart-rate fact, Heart Rate states the whole
     * distribution as rows, and promoting the largest row made a heart-rate
     * reading the headline of every run that had zones at all.
     *
     * The rule is enforced by shape rather than by discipline: zone durations
     * are not an input here any more, so no future pass can reintroduce the
     * sentence by passing them in.
     */
    expect(Object.keys(runInsight({ structuredIntervalCount: 2 }) ?? {})).toEqual(["kind", "text"]);
    expect(runInsight({ structuredIntervalCount: 0 })).toBeNull();
    // `hrZoneSeconds` is not part of the input type; passing it changes nothing.
    const withZones = { structuredIntervalCount: 0, hrZoneSeconds: [120, 1_875, 300] };
    expect(runInsight(withZones)).toBeNull();
  });
});
