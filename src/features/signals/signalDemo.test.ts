import { describe, expect, it } from "vitest";
import { presentableRunnerSignals } from "../../signals/runnerSignals.js";
import { isSignalDemoEnabled, signalDemoRuns } from "./signalDemo.js";

const TODAY = "2026-08-15";

describe("Training Signals preview demo", () => {
  it("is opt-in and limited to local or Vercel branch-preview hosts", () => {
    expect(
      isSignalDemoEnabled({
        hostname: "stack-run-git-feature-training-signals-v2-verus-domus.vercel.app",
        search: "?demo=signals",
      }),
    ).toBe(true);
    expect(
      isSignalDemoEnabled({ hostname: "localhost", search: "?demo=signals" }),
    ).toBe(true);
    expect(
      isSignalDemoEnabled({ hostname: "stack.example.com", search: "?demo=signals" }),
    ).toBe(false);
    expect(
      isSignalDemoEnabled({
        hostname: "stack-run-git-feature-training-signals-v2-verus-domus.vercel.app",
        search: "",
      }),
    ).toBe(false);
  });

  it("drives all five historical signal families through the real domain rules", () => {
    const runs = signalDemoRuns(TODAY);
    const signals = presentableRunnerSignals({ runs, today: TODAY });

    expect(signals.map((signal) => signal.id)).toEqual([
      "volume-trend",
      "run-frequency",
      "long-run-progression",
      "workload-trend",
      "zone-distribution",
    ]);
    expect(signals.every((signal) => signal.isPresentable)).toBe(true);
    expect(runs.every((run) => run.stack === null)).toBe(true);
    expect(runs.every((run) => run.id.startsWith("demo:signals:"))).toBe(true);
  });
});
