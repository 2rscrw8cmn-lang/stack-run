import { describe, expect, it } from "vitest";
import type { SourceRunFacts } from "./sourceRunFacts.js";
import { RUN_METHODOLOGY_NOTES, sourceRunOptionFacts } from "./runOptions.js";

const facts: SourceRunFacts = {
  distanceMiles: 2.76,
  durationSeconds: 1_818,
  paceSecondsPerMile: 658,
  elapsedTimeSeconds: 2_040,
  averageHeartRate: 153,
  maxHeartRate: 174,
  elevationGainFeet: 115.6,
  averageCadence: 79,
  trainingLoad: 42,
  hrZoneSeconds: null,
};

/**
 * Issue #214, part 9: provenance and secondary detail move behind `…`.
 *
 * Moving them must not lose them, and must not invent them either — an empty
 * list is the right answer for a run STACK knows nothing administrative about.
 */
describe("run option facts", () => {
  it("states where a run came from, what the runner said, and how long the watch ran", () => {
    expect(sourceRunOptionFacts(facts, {
      sourceLabel: "Intervals.icu",
      effortLabel: "Great",
      importedAt: "2026-08-13T13:00:00Z",
      sourceUpdatedAt: "2026-08-14T09:30:00Z",
    })).toEqual([
      { label: "Source", value: "Intervals.icu" },
      { label: "Effort", value: "Great" },
      { label: "Elapsed", value: "34:00" },
      { label: "Moving", value: "30:18" },
      { label: "Imported", value: "Aug 13, 2026" },
      { label: "Source updated", value: "Aug 14, 2026" },
    ]);
  });

  it("keeps elapsed time out of it when it says nothing moving time did not", () => {
    const rows = sourceRunOptionFacts({ ...facts, elapsedTimeSeconds: 1_830 }, {});
    expect(rows.map((row) => row.label)).not.toContain("Elapsed");
  });

  it("names a hand-typed heart rate as entered rather than as a measurement", () => {
    const rows = sourceRunOptionFacts({ ...facts, averageHeartRate: null }, { manualHeartRate: 142 });
    expect(rows).toContainEqual({ label: "Avg HR (entered)", value: "142 bpm" });
  });

  it("says nothing at all about a run with nothing administrative to say", () => {
    expect(sourceRunOptionFacts({ ...facts, elapsedTimeSeconds: null })).toEqual([]);
  });

  it("ignores a stored value that is not a timestamp rather than printing Invalid Date", () => {
    // Older fixtures wrote the literal string "now" into `importedAt`.
    expect(sourceRunOptionFacts(facts, { importedAt: "now" }).map((row) => row.label))
      .not.toContain("Imported");
  });

  it("explains the calculations a runner would otherwise have to take on trust", () => {
    const notes = RUN_METHODOLOGY_NOTES.join(" ");
    expect(notes).toMatch(/climbing total over the whole run/i);
    expect(notes).toMatch(/never recomputes/i);
    expect(notes).toMatch(/no doubling/i);
    expect(notes).toMatch(/left out rather than shown as zero/i);
  });
});
