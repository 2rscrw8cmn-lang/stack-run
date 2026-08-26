import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntervalsRunProfile } from "../../connected/intervals.js";
import { SourceDetailReaderProvider, type SourceDetailReaderFactory } from "../../connected/sourceDetail.js";
import type { RunLog } from "../../domain/types.js";
import { RunResultDetail } from "./RunResultDetail.js";

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

/**
 * The August 13 HealthFit → Intervals activity, as the real-device review
 * reported it: 2.76 mi in 30:18 for a 10:59 /mi pace, 153 average and 174 max
 * heart rate, 116 ft of climbing and a cadence of 79.
 */
const augustRun: RunLog = {
  ...syncedRun,
  distanceMiles: 2.76,
  durationSeconds: 1818,
  importedMetrics: {
    averageHeartRate: 153,
    maxHeartRate: 174,
    elevationGainFeet: 115.6,
    trainingLoad: 42,
    averageCadence: 79,
  },
};

/** Answers the interval read first and the stream read second, as the sheet issues them. */
function respondWith(detail: object, streams: object) {
  return vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(detail)))
    .mockResolvedValueOnce(new Response(JSON.stringify(streams)));
}

const NO_INTERVALS = { icu_intervals: [] };

/** A stream long enough for the robust pace domain, with a near-stop in it. */
const augustStreams = {
  time: Array.from({ length: 12 }, (_, index) => index * 165),
  heartrate: [140, 148, 152, 155, 158, 160, 157, 154, 151, 149, 153, 156],
  altitude: [
    22.0, 24.5, 27.0, 30.0, 32.5, 34.4, 31.0, 28.0, 25.5, 23.5, 22.5, 22.0,
  ],
  // 2.44 m/s ≈ 11:00 /mi, with one near-stop that must not define the y-scale.
  velocity_smooth: [2.44, 2.42, 2.45, 2.40, 2.43, 2.46, 0.5, 2.41, 2.44, 2.47, 2.42, 2.45],
  cadence: [79, 79, 80, 79, 78, 79, 0, 79, 80, 79, 79, 80],
};

function profileFacts() {
  const facts = document.querySelector(".run-profile-chart__facts");
  return [...(facts?.querySelectorAll("div") ?? [])].map((cell) => ({
    label: cell.querySelector("dt")?.textContent,
    value: cell.querySelector("dd")?.textContent,
  }));
}

afterEach(() => vi.restoreAllMocks());

describe("connected run result", () => {
  it("leaves a minimum-field manual run unchanged apart from derived pace", () => {
    render(<RunResultDetail run={base} />);
    expect(screen.getByText("5 mi")).toBeInTheDocument();
    expect(screen.getByText("40:00")).toBeInTheDocument();
    expect(screen.getByText("8:00 /MI")).toBeInTheDocument();
    expect(screen.getByText("Solid")).toBeInTheDocument();
    expect(screen.getByText("Felt controlled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /intervals/i })).not.toBeInTheDocument();
  });

  /*
   * Issue #129: where a run came from is said the same way for every run, not
   * only the synced ones, and it stays in the meta line — secondary to the
   * result it qualifies.
   */
  it("names the source of a hand-logged run and of a synced one", () => {
    const { unmount } = render(<RunResultDetail run={base} />);
    expect(screen.getByText("Manual entry")).toBeInTheDocument();
    expect(screen.queryByText("Intervals.icu")).not.toBeInTheDocument();
    unmount();

    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: {} }} />);
    expect(screen.getByText("Intervals.icu")).toBeInTheDocument();
    expect(screen.queryByText("Manual entry")).not.toBeInTheDocument();
  });

  it("omits every absent optional metric", () => {
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: {} }} />);
    expect(screen.getByText("Intervals.icu")).toBeInTheDocument();
    expect(screen.queryByText(/Avg HR|Max HR|Gain|Load|Cadence/)).not.toBeInTheDocument();
  });

  it("shows each approved optional summary with mobile-fit labels, and accessible HR-zone text without guessed zeroes", () => {
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 151, maxHeartRate: 177, elevationGainFeet: 432.4, trainingLoad: 68, hrZoneSeconds: [600, 1200, 600] } }} />);
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
  });

  it("shows a hand-typed heart rate on a manual run that has no imported one", () => {
    render(<RunResultDetail run={{ ...base, manualHeartRate: 142 }} />);
    expect(screen.getByText("142 bpm")).toBeInTheDocument();
    expect(screen.getByText("Avg HR")).toBeInTheDocument();
  });

  it("never shows a manual heart rate beside an imported one", () => {
    render(
      <RunResultDetail
        run={{ ...syncedRun, importedMetrics: { averageHeartRate: 151 }, manualHeartRate: 999 }}
      />,
    );
    expect(screen.getByText("151 bpm")).toBeInTheDocument();
    expect(screen.queryByText("999 bpm")).not.toBeInTheDocument();
    expect(screen.getAllByText("Avg HR")).toHaveLength(1);
  });

  it("keeps the phone summary metrics to one 2×2 grid, with cadence living in the profile", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    // Exactly four cells, in source order, so the CSS 2×2 lands as designed
    // rather than three across with a fifth stranded underneath.
    const grid = screen.getByLabelText("Imported run metrics");
    expect([...grid.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Max HR", "Gain", "Load"]);
    expect(screen.getByRole("button", { name: "Cadence" })).toBeInTheDocument();
  });

  it("keeps Gain as the source's own climbing total rather than anything recomputed from altitude", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    // Intervals reports 115 ft of climbing and STACK shows 116; the altitude
    // stream only ever spans 72–113 ft, so a recomputed gain would disagree
    // with every other source the runner can check.
    expect(screen.getByText("116 ft")).toBeInTheDocument();
    expect(screen.getByText("Gain")).toBeInTheDocument();
  });

  it("fetches richer detail automatically once shown, with no explicit tap and no button at all", async () => {
    const fetchMock = respondWith(
      { icu_intervals: [{ name: "Rep 1", moving_time: 180, distance: 800 }] },
      {},
    );

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
    respondWith(NO_INTERVALS, { time: [0, 30], heartrate: [140, 150] });

    render(<RunResultDetail run={syncedRun} syncToken="token" />);
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
    respondWith({ icu_intervals: [{ name: "Rep 1", moving_time: 180, distance: 800 }] }, {});

    render(<RunResultDetail run={syncedRun} syncToken="token" />);
    await screen.findByRole("list", { name: "Structured workout intervals" });

    expect(screen.queryByText("Run Profile")).not.toBeInTheDocument();
  });

  it("plots only the metrics the stream data actually contains, with a working selector", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60],
      heartrate: [140, 150, 160],
      velocity_smooth: [3.0, 3.1, 3.2],
      // No altitude and no cadence stream: neither may appear as a selector.
    });

    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 150, maxHeartRate: 160 } }} syncToken="token" />);

    expect(await screen.findByText("Run Profile")).toBeInTheDocument();
    const paceButton = screen.getByRole("button", { name: "Pace" });
    const hrButton = screen.getByRole("button", { name: "Heart Rate" });
    expect(paceButton).toHaveAttribute("aria-pressed", "true");
    expect(hrButton).toHaveAttribute("aria-pressed", "false");
    expect(screen.queryByRole("button", { name: "Elevation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cadence" })).not.toBeInTheDocument();

    await userEvent.click(hrButton);
    expect(hrButton).toHaveAttribute("aria-pressed", "true");
    expect(paceButton).toHaveAttribute("aria-pressed", "false");
  });
});

/**
 * The corrections the August 13 real-device review asked for. Every number
 * below is one the runner can check against Intervals or HealthFit.
 */
describe("Run Profile facts come from the source's own aggregates", () => {
  it("states the run's own pace, never an average of instantaneous samples", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    // 2.76 mi in 30:18 is 10:59 /mi, which is what Intervals (10:58) and
    // HealthFit (11:00) agree on. The samples' arithmetic mean is not this.
    expect(profileFacts()).toEqual([{ label: "Avg pace", value: "10:59 /MI" }]);
  });

  it("never turns a near-stop into a displayed worst pace, or a spike into a best one", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    const profile = document.querySelector(".run-result-detail__profile")!;
    // The 0.5 m/s sample is a 53:38 /mi instant. It stays in the series and
    // out of the facts: no Low, no High, no Best, no Worst for pace at all.
    expect(within(profile as HTMLElement).queryByText(/53:/)).not.toBeInTheDocument();
    expect(within(profile as HTMLElement).queryByText("Low")).not.toBeInTheDocument();
    expect(within(profile as HTMLElement).queryByText("High")).not.toBeInTheDocument();
    expect(within(profile as HTMLElement).queryByText(/Best|Worst|Fastest|Slowest/)).not.toBeInTheDocument();
  });

  it("states imported average and max heart rate rather than sample extremes", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");
    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));

    // 153/174 are the imported aggregates; the stream's own extremes are
    // 140 and 160 and must not be what is stated.
    expect(profileFacts()).toEqual([
      { label: "Avg", value: "153 bpm" },
      { label: "Max", value: "174 bpm" },
    ]);
  });

  it("uses the stream for elevation low and high, which are properties of the series", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");
    await userEvent.click(screen.getByRole("button", { name: "Elevation" }));

    // 22.0 m and 34.4 m are 72 ft and 113 ft, the altitude span the review saw.
    expect(profileFacts()).toEqual([
      { label: "Low", value: "72 ft" },
      { label: "High", value: "113 ft" },
    ]);
  });

  it("gives every profile an elapsed-time axis running from 0:00 to the run's duration", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    const axis = document.querySelector(".run-profile-chart__axis")!;
    expect(axis).toHaveTextContent("0:00");
    expect(axis).toHaveTextContent("30:15");
  });
});

describe("Run Profile cadence", () => {
  it("offers cadence as the fourth metric and reports it exactly as Intervals does", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    expect(screen.getByRole("group", { name: "Run Profile metric" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Run Profile metric" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Pace", "Heart Rate", "Elevation", "Cadence"]);

    await userEvent.click(screen.getByRole("button", { name: "Cadence" }));
    // 79 is what the source says, so 79 is what STACK shows: not 158, and not
    // dressed in a unit this repository has not verified.
    expect(profileFacts()).toEqual([{ label: "Avg cadence", value: "79" }]);
    expect(screen.queryByText("158")).not.toBeInTheDocument();
    expect(screen.queryByText(/79 spm|79 rpm|79 steps/i)).not.toBeInTheDocument();
  });

  it("offers no cadence at all when neither the stream nor the imported average has it", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60],
      heartrate: [140, 150, 160],
    });
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 150 } }} syncToken="token" />);
    await screen.findByText("Run Profile");

    expect(screen.queryByRole("button", { name: "Cadence" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cadence")).not.toBeInTheDocument();
  });

  it("falls back to the summary grid when the verified average exists but the stream carried none", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60],
      heartrate: [140, 150, 160],
    });
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    expect(screen.queryByRole("button", { name: "Cadence" })).not.toBeInTheDocument();
    const grid = screen.getByLabelText("Imported run metrics");
    expect([...grid.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Max HR", "Gain", "Load", "Cadence"]);
    expect(within(grid).getByText("79")).toBeInTheDocument();
  });
});

describe("Run Profile gaps", () => {
  it("breaks the line where the stream stopped rather than joining across it", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60, 90, 120, 150],
      // The middle of the run has no heart rate at all.
      heartrate: [140, 145, 0, 0, 150, 155],
    });
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 148, maxHeartRate: 155 } }} syncToken="token" />);
    await screen.findByText("Run Profile");

    const lines = document.querySelectorAll(".run-profile-chart polyline.chart__line");
    expect(lines).toHaveLength(2);
    // Two measured stretches, never one line drawn straight over the hole.
    expect(lines[0].getAttribute("points")!.split(" ")).toHaveLength(2);
    expect(lines[1].getAttribute("points")!.split(" ")).toHaveLength(2);
  });

  it("treats a standing-still cadence as a gap rather than a measured zero", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");
    await userEvent.click(screen.getByRole("button", { name: "Cadence" }));

    // The single 0 in the cadence stream is a stop, so the line breaks there
    // instead of plunging to the floor and implying a measured zero.
    expect(document.querySelectorAll(".run-profile-chart polyline.chart__line")).toHaveLength(2);
  });
});

describe("Run Detail heart-rate zones", () => {
  const zoned = {
    ...syncedRun,
    importedMetrics: { hrZoneSeconds: [305, 412, 463, 430, 171, 0, 0] },
  };

  it("drops the visible legend and lets the ring itself be selected", async () => {
    render(<RunResultDetail run={zoned} />);

    const legend = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(legend).toHaveClass("visually-hidden");

    const centreName = () => document.querySelector(".donut__center-label")?.textContent;
    const centreDetail = () => document.querySelector(".donut__center-detail")?.textContent;
    expect(centreName()).toBe("Zone 3");
    expect(centreDetail()).toBe("7:43");

    await userEvent.click(screen.getByRole("button", { name: "Zone 2, 6:52, 23%" }));
    expect(centreName()).toBe("Zone 2");
    expect(centreDetail()).toBe("6:52");
  });

  it("keeps the complete composition available to a screen reader without the legend being visible", () => {
    render(<RunResultDetail run={zoned} />);
    const legend = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(5);
    expect(legend).toHaveTextContent("Zone 5");
    expect(legend).toHaveTextContent("2:51 · 10%");
  });
});

/**
 * R3 moved the source-owned half of this component into `SourceRunDetail`,
 * which a historical-only run renders too. These are the accepted run's own
 * guarantees, restated against the shared path so the refactor cannot quietly
 * change what a logged run does.
 */
describe("accepted run through the shared source-detail path", () => {
  it("keeps a valid summary when only the optional profile fails", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify(NO_INTERVALS)))
      .mockRejectedValueOnce(new Error("streams unavailable"));

    render(<RunResultDetail run={augustRun} syncToken="token" />);

    // Everything the source already stated survives the failed enrichment,
    // including the cadence that would have lived in the profile.
    await screen.findByText("79");
    expect(screen.getByText("2.76 mi")).toBeInTheDocument();
    expect(screen.getByText("10:59 /MI")).toBeInTheDocument();
    expect(screen.getByText("153 bpm")).toBeInTheDocument();
    expect(screen.getByText("116 ft")).toBeInTheDocument();
    expect(screen.queryByText("Run Profile")).not.toBeInTheDocument();
    // A missing profile is not an error worth alarming anybody about.
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never lets a superseded run's slow answer land in the run now open", async () => {
    const pending = new Map<string, (profile: IntervalsRunProfile | null) => void>();
    const factory: SourceDetailReaderFactory = () => ({
      readDetail: async () => ({ intervals: [] }),
      readProfile: (id) =>
        new Promise<IntervalsRunProfile | null>((resolve) => pending.set(id, resolve)),
    });
    const other: RunLog = {
      ...syncedRun,
      id: "run-2",
      externalSource: { provider: "intervals", activityId: "a2", sourceUpdatedAt: null, importedAt: "now" },
    };

    const view = render(
      <SourceDetailReaderProvider value={factory}>
        <RunResultDetail run={syncedRun} syncToken="token" />
      </SourceDetailReaderProvider>,
    );
    view.rerender(
      <SourceDetailReaderProvider value={factory}>
        <RunResultDetail run={other} syncToken="token" />
      </SourceDetailReaderProvider>,
    );

    pending.get("a1")?.({
      samples: [
        { timeSeconds: 0, heartRate: 140 },
        { timeSeconds: 30, heartRate: 150 },
      ],
    });
    await Promise.resolve();

    expect(screen.queryByText("Run Profile")).not.toBeInTheDocument();
  });

  it("asks the source for nothing when the run was never synced", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<RunResultDetail run={base} syncToken="token" />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Run Profile")).not.toBeInTheDocument();
  });

  it("keeps every touch target for the profile selectors a real button", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Run Profile");

    for (const selector of within(screen.getByRole("group", { name: "Run Profile metric" }))
      .getAllByRole("button")) {
      expect(selector.tagName).toBe("BUTTON");
      expect(selector).toHaveAttribute("aria-pressed");
      expect(selector).toHaveClass("run-profile__selector");
    }
  });
});
