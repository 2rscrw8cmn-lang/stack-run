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

const syncedRun = {
  ...base,
  source: "intervals" as const,
  externalSource: { provider: "intervals" as const, activityId: "a1", sourceUpdatedAt: null, importedAt: "now" },
};

afterEach(() => vi.restoreAllMocks());

describe("connected run result", () => {
  it("leaves a minimum-field manual run unchanged apart from derived pace", () => {
    render(<RunResultDetail run={base} />);
    expect(screen.getByText("5 mi")).toBeInTheDocument();
    expect(screen.getByText("40:00")).toBeInTheDocument();
    expect(screen.getByText("8:00 /MI")).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();
    expect(screen.getByText("Felt controlled.")).toBeInTheDocument();
    expect(screen.queryByText(/Synced via/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /intervals/i })).not.toBeInTheDocument();
  });

  it("omits every absent optional metric and cadence until its catalog semantics are verified", () => {
    render(<RunResultDetail run={{ ...base, source: "intervals", externalSource: { provider: "intervals", activityId: "a1", sourceUpdatedAt: null, importedAt: "now" }, importedMetrics: { averageCadence: 172 } }} />);
    expect(screen.getByText("Synced via Intervals.icu")).toBeInTheDocument();
    expect(screen.queryByText(/Avg HR|Max HR|Gain|Load|Cadence/)).not.toBeInTheDocument();
  });

  it("shows each approved optional summary, with mobile-fit labels, and accessible HR-zone text without guessed zeroes", () => {
    render(<RunResultDetail run={{ ...base, source: "intervals", externalSource: { provider: "intervals", activityId: "a1", sourceUpdatedAt: null, importedAt: "now" }, importedMetrics: { averageHeartRate: 151, maxHeartRate: 177, elevationGainFeet: 432.4, trainingLoad: 68, hrZoneSeconds: [600, 1200, 600] } }} />);
    expect(screen.getByText("151 bpm")).toBeInTheDocument();
    expect(screen.getByText("Avg HR")).toBeInTheDocument();
    expect(screen.getByText("177 bpm")).toBeInTheDocument();
    expect(screen.getByText("432 ft")).toBeInTheDocument();
    expect(screen.getByText("Gain")).toBeInTheDocument();
    expect(screen.getByText("68")).toBeInTheDocument();
    expect(screen.getByText("Load")).toBeInTheDocument();
    expect(screen.queryByText("Elevation gain")).not.toBeInTheDocument();
    expect(screen.queryByText("Training Load")).not.toBeInTheDocument();
    const zones = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(zones).toHaveTextContent("Zone 1");
    expect(zones).toHaveTextContent("10:00 · 25%");
    expect(zones).toHaveTextContent("20:00 · 50%");
    expect(zones).not.toHaveTextContent("Zone 4");
    // The improved large centered donut treatment, shared with Training Signals' HR Zones.
    expect(document.querySelector(".donut--large")).toBeInTheDocument();
  });

  it("fetches richer detail automatically once shown, with no explicit tap and no button at all", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ icu_intervals: [{ name: "Rep 1", moving_time: 180, distance: 800 }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({})));

    render(<RunResultDetail run={syncedRun} syncToken="token" />);

    expect(screen.queryByRole("button", { name: "View intervals" })).not.toBeInTheDocument();
    expect(await screen.findByRole("list", { name: "Structured workout intervals" })).toHaveTextContent("Rep 1");
    expect(screen.getByText(/0.50 mi/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("resource=activity&id=a1&intervals=true"),
      expect.anything(),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("resource=activity-streams&id=a1"),
      expect.anything(),
    );
  });

  it("shows nothing at all for an ordinary run with no structured interval groups — no button, no empty message", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ icu_intervals: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ time: [0, 30], heartrate: [140, 150] })));

    render(<RunResultDetail run={syncedRun} syncToken="token" />);
    // The profile fetch resolving is the synchronization point: both fetches
    // fire together, so by the time this appears the interval fetch (an
    // equally shallow mocked response) has settled too.
    await screen.findByText("Run Profile");

    expect(screen.queryByRole("button", { name: "View intervals" })).not.toBeInTheDocument();
    expect(screen.queryByText(/understandable interval groups/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Structured workout intervals" })).not.toBeInTheDocument();
  });

  it("shows a concise recoverable error with Retry on a genuine detail fetch failure", async () => {
    const fetchMock = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({})));

    render(<RunResultDetail run={syncedRun} syncToken="token" />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not be loaded/i);
    const retry = screen.getByRole("button", { name: "Retry" });

    fetchMock
      .mockResolvedValueOnce(new Response(JSON.stringify({ icu_intervals: [{ name: "Rep 1", moving_time: 180, distance: 800 }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({})));
    await userEvent.click(retry);

    expect(await screen.findByRole("list", { name: "Structured workout intervals" })).toHaveTextContent("Rep 1");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows no Run Profile section when the stream response carries no recognizable data", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ icu_intervals: [{ name: "Rep 1", moving_time: 180, distance: 800 }] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({})));

    render(<RunResultDetail run={syncedRun} syncToken="token" />);
    // The interval section appearing is the synchronization point for both
    // fetches, the same way a positive Run Profile appearance is elsewhere.
    await screen.findByRole("list", { name: "Structured workout intervals" });

    expect(screen.queryByText("Run Profile")).not.toBeInTheDocument();
  });

  it("plots only the metrics the stream data actually contains, with a working selector", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ icu_intervals: [] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({
        time: [0, 30, 60],
        heartrate: [140, 150, 160],
        velocity_smooth: [3.0, 3.1, 3.2],
        // No altitude stream at all — Elevation must not appear as a selector.
      })));

    render(<RunResultDetail run={syncedRun} syncToken="token" />);

    expect(await screen.findByText("Run Profile")).toBeInTheDocument();
    const paceButton = screen.getByRole("button", { name: "Pace" });
    const hrButton = screen.getByRole("button", { name: "Heart Rate" });
    expect(paceButton).toHaveAttribute("aria-pressed", "true");
    expect(hrButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Elevation" })).not.toBeInTheDocument();

    await userEvent.click(hrButton);
    expect(hrButton).toHaveAttribute("aria-pressed", "true");
    expect(paceButton).toHaveAttribute("aria-pressed", "false");
  });
});
