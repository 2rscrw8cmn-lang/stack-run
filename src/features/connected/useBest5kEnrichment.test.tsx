import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { BEST_5K_PASS_LIMIT } from "../../connected/best5k";
import { loadBest5kProbes } from "../../storage/best5kProbeRepository";
import { useBest5kEnrichment } from "./useBest5kEnrichment";

const TODAY = "2026-09-15";
const CONNECTION = { mode: "local-api-key" as const, credential: "fake-key" };

function run(index: number, overrides: Partial<RunLog> = {}): RunLog {
  return {
    id: `run-${index}`,
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
      activityId: `activity-${index}`,
      sourceUpdatedAt: null,
      importedAt: "2026-09-15T00:00:00Z",
    },
    importedMetrics: null,
    ...overrides,
  };
}

describe("best 5K enrichment pass", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("asks about the runs that could have a 5K, and stores what the source said", async () => {
    const onBest5kFound = vi.fn();
    const fetchBestEfforts = vi.fn(async (activityId: string) => ({
      best5kSeconds: activityId === "activity-1" ? 1290 : null,
    }));

    renderHook(() =>
      useBest5kEnrichment({
        connection: CONNECTION,
        runLogs: [run(1), run(2)],
        accountId: "user-1",
        onBest5kFound,
        today: TODAY,
        fetchBestEfforts,
      }),
    );

    await waitFor(() => expect(onBest5kFound).toHaveBeenCalled());
    expect(onBest5kFound.mock.calls[0][0].get("run-1")).toBe(1290);
    // The run with no 5K is still settled, so a later pass does not re-ask.
    await waitFor(() => expect(loadBest5kProbes("user-1").size).toBe(2));
  });

  it("does nothing at all without a connection", () => {
    const fetchBestEfforts = vi.fn();
    renderHook(() =>
      useBest5kEnrichment({
        connection: null,
        runLogs: [run(1)],
        accountId: "user-1",
        onBest5kFound: vi.fn(),
        today: TODAY,
        fetchBestEfforts,
      }),
    );
    expect(fetchBestEfforts).not.toHaveBeenCalled();
  });

  it("asks about nothing when every run is already settled or ineligible", async () => {
    const fetchBestEfforts = vi.fn();
    renderHook(() =>
      useBest5kEnrichment({
        connection: CONNECTION,
        runLogs: [
          // Already has one.
          run(1, { importedMetrics: { best5kSeconds: 1290 } }),
          // Hand-logged, so no source to ask.
          run(2, { source: "manual", externalSource: null }),
          // Under 5,000 m: the source would refuse, so no request is spent.
          run(3, { distanceMiles: 2.5 }),
          // Cross Training has no 5K worth naming.
          run(4, { activityType: "cross" }),
        ],
        accountId: "user-1",
        onBest5kFound: vi.fn(),
        today: TODAY,
        fetchBestEfforts,
      }),
    );
    await Promise.resolve();
    expect(fetchBestEfforts).not.toHaveBeenCalled();
  });

  /**
   * The bound that matters most. Without it a runner with years of history
   * would spend hundreds of requests on one app open, and Intervals rate-limits.
   */
  it("stops at the pass limit and settles rather than looping", async () => {
    const fetchBestEfforts = vi.fn(async () => ({ best5kSeconds: null }));
    const runLogs = Array.from({ length: 40 }, (_, index) =>
      run(index, { completedDate: "2026-09-14" }),
    );

    renderHook(() =>
      useBest5kEnrichment({
        connection: CONNECTION,
        runLogs,
        accountId: "user-1",
        onBest5kFound: vi.fn(),
        today: TODAY,
        fetchBestEfforts,
      }),
    );

    await waitFor(() =>
      expect(loadBest5kProbes("user-1").size).toBe(BEST_5K_PASS_LIMIT),
    );
    // A pass that found nothing changes no state, so nothing re-triggers it:
    // the remaining history waits for the next visit rather than draining the
    // rate limit now.
    expect(fetchBestEfforts).toHaveBeenCalledTimes(BEST_5K_PASS_LIMIT);
  });

  it("leaves a failed request unsettled, so a later pass can try again", async () => {
    const fetchBestEfforts = vi.fn(async () => {
      throw new Error("Intervals.icu is rate limiting requests.");
    });
    const onBest5kFound = vi.fn();

    renderHook(() =>
      useBest5kEnrichment({
        connection: CONNECTION,
        runLogs: [run(1)],
        accountId: "user-1",
        onBest5kFound,
        today: TODAY,
        fetchBestEfforts,
      }),
    );

    await waitFor(() => expect(fetchBestEfforts).toHaveBeenCalled());
    expect(loadBest5kProbes("user-1").size).toBe(0);
    // Quiet: the runs are complete and correct without a 5K.
    expect(onBest5kFound).not.toHaveBeenCalled();
  });
});
