import { describe, expect, it } from "vitest";
import { isManualRun, runSourceLabel } from "./runSource";

/*
 * Issue #129: manual entry is the exception. `intervals` is the only value
 * that means synced, so anything else — including a run stored before the
 * field existed — is a run the runner typed in, which is exactly what STACK
 * has always defaulted an unlabelled run to.
 */
describe("run source", () => {
  it("treats a connected run as synced", () => {
    expect(isManualRun({ source: "intervals" })).toBe(false);
    expect(runSourceLabel({ source: "intervals" })).toBe("Intervals.icu");
  });

  it("treats a hand-typed run as manual", () => {
    expect(isManualRun({ source: "manual" })).toBe(true);
    expect(runSourceLabel({ source: "manual" })).toBe("Manual entry");
  });

  it("treats an unstated source as manual rather than as unknown", () => {
    expect(isManualRun({})).toBe(true);
    expect(isManualRun({ source: null })).toBe(true);
    expect(runSourceLabel({})).toBe("Manual entry");
    expect(runSourceLabel({ source: null })).toBe("Manual entry");
  });
});
