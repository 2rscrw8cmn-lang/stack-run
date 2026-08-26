import { afterEach, describe, expect, it, vi } from "vitest";
import { saveIntervalsApiKey } from "../storage/intervalsCredentialRepository.js";
import { saveHistoricalActivities } from "../storage/historicalActivityRepository.js";
import type { HistoricalActivity } from "./historicalActivity.js";
import {
  createHistoryDiagnostics,
  historyDiagnosticsEnabled,
  installHistoryDiagnostics,
  HISTORY_DIAGNOSTICS_GLOBAL,
  HISTORY_DIAGNOSTICS_STORAGE_KEY,
} from "./historyDiagnostics.js";

const activity: HistoricalActivity = {
  provider: "intervals",
  sourceId: "a1",
  startDateLocal: "2026-06-10",
  startTimeLocal: "2026-06-10T06:32:00",
  sourceType: "Run",
  name: "Morning run",
  distanceMeters: 9_012,
  movingTimeSeconds: 3_612,
  elapsedTimeSeconds: 3_701,
  averageHeartRate: 153,
  maxHeartRate: 174,
  hrZoneSeconds: [300, 900, 1200, 600, 0, 0, 0],
  elevationGainMeters: 35.4,
  averageCadence: 79,
  trainingLoad: 88,
  sourceUpdatedAt: "2026-06-10T14:00:00Z",
  firstSeenAt: "2026-06-11T09:00:00.000Z",
  lastSeenAt: "2026-08-15T09:00:00.000Z",
  reconciledAt: null,
};

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("history diagnostics", () => {
  it("installs nothing unless this device has explicitly opted in", () => {
    const target: Record<string, unknown> = {};
    expect(historyDiagnosticsEnabled()).toBe(false);
    expect(installHistoryDiagnostics(target)).toBe(false);
    expect(target[HISTORY_DIAGNOSTICS_GLOBAL]).toBeUndefined();

    localStorage.setItem(HISTORY_DIAGNOSTICS_STORAGE_KEY, "on");
    expect(installHistoryDiagnostics(target)).toBe(true);
    expect(target[HISTORY_DIAGNOSTICS_GLOBAL]).toBeDefined();
  });

  it("reports stored coverage without touching the network", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    saveHistoricalActivities([activity]);

    const report = createHistoryDiagnostics().coverage();

    expect(report).toContain("activities: 1");
    expect(report).toContain("averageCadence: 1/1 (100%)");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("says what to do rather than failing when the device has no connection", async () => {
    await expect(createHistoryDiagnostics().sync()).resolves.toContain("no Intervals connection");
  });

  it("never returns the credential it used", async () => {
    saveIntervalsApiKey("fake-personal-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify([])));

    const report = await createHistoryDiagnostics().sync({ lookbackDays: 30 });

    expect(report).toContain("windows: 1/1");
    expect(report).not.toContain("fake-personal-key");
    expect(report).not.toContain("Basic ");
  });

  it("clears only the stored history", () => {
    saveHistoricalActivities([activity]);
    localStorage.setItem("stack.app-state.v1", "{}");

    createHistoryDiagnostics().clear();

    expect(createHistoryDiagnostics().coverage()).toContain("activities: 0");
    expect(localStorage.getItem("stack.app-state.v1")).toBe("{}");
  });
});
