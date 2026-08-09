import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunLog } from "../../domain/types";
import { RunResultDetail } from "./RunResultDetail";

const base: RunLog = {
  id: "run-1", workoutId: null, completedDate: "2026-06-10", activityType: "intervals",
  distanceMiles: 5, durationSeconds: 2400, effort: "solid", notes: "Felt controlled.",
  createdAt: "2026-06-10T12:00:00Z", updatedAt: "2026-06-10T12:00:00Z",
};

afterEach(() => vi.restoreAllMocks());

describe("connected run result", () => {
  it("leaves a minimum-field manual run unchanged apart from derived pace", () => {
    render(<RunResultDetail run={base} />);
    expect(screen.getByText("5 mi")).toBeInTheDocument();
    expect(screen.getByText("40:00")).toBeInTheDocument();
    expect(screen.getByText("8:00 /mi")).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();
    expect(screen.getByText("Felt controlled.")).toBeInTheDocument();
    expect(screen.queryByText(/Synced via/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /intervals/i })).not.toBeInTheDocument();
  });

  it("omits every absent optional metric and cadence until its catalog semantics are verified", () => {
    render(<RunResultDetail run={{ ...base, source: "intervals", externalSource: { provider: "intervals", activityId: "a1", sourceUpdatedAt: null, importedAt: "now" }, importedMetrics: { averageCadence: 172 } }} />);
    expect(screen.getByText("Synced via Intervals.icu")).toBeInTheDocument();
    expect(screen.queryByText(/Average HR|Max HR|Elevation gain|Training Load|Cadence/)).not.toBeInTheDocument();
  });

  it("shows each approved optional summary and accessible HR-zone text without guessed zeroes", () => {
    render(<RunResultDetail run={{ ...base, source: "intervals", externalSource: { provider: "intervals", activityId: "a1", sourceUpdatedAt: null, importedAt: "now" }, importedMetrics: { averageHeartRate: 151, maxHeartRate: 177, elevationGainFeet: 432.4, trainingLoad: 68, hrZoneSeconds: [600, 1200, 600] } }} />);
    expect(screen.getByText("151 bpm")).toBeInTheDocument();
    expect(screen.getByText("177 bpm")).toBeInTheDocument();
    expect(screen.getByText("432 ft")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
    const zones = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(zones).toHaveTextContent("Zone 1");
    expect(zones).toHaveTextContent("10:00 · 25%");
    expect(zones).toHaveTextContent("20:00 · 50%");
    expect(zones).not.toHaveTextContent("Zone 4");
  });

  it("fetches structured intervals on demand and exposes understandable rows", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ icu_intervals: [{ name: "Rep 1", moving_time: 180, distance: 800 }] })));
    const run = { ...base, source: "intervals" as const, externalSource: { provider: "intervals" as const, activityId: "a1", sourceUpdatedAt: null, importedAt: "now" } };
    render(<RunResultDetail run={run} syncToken="token" />);
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "View intervals" }));
    expect(await screen.findByRole("list", { name: "Structured workout intervals" })).toHaveTextContent("Rep 1");
    expect(screen.getByText(/0.50 mi/)).toBeInTheDocument();
  });
});
