import { fireEvent, render, screen, within } from "@testing-library/react";
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

function analysisFacts() {
  const facts = document.querySelector(".run-analysis__facts");
  return [...(facts?.querySelectorAll("div") ?? [])].map((cell) => ({
    label: cell.querySelector("dt")?.textContent,
    value: cell.querySelector("dd")?.textContent,
  }));
}

function hero() {
  return screen.getByLabelText("Primary activity results");
}

/** The drawn metric line(s). One per contiguous stretch of measured samples. */
function chartLines() {
  return document.querySelectorAll(".activity-chart path.activity-chart__line");
}

/** The scrub surface, sized as a real 320px-wide plot would be. */
function scrubSurface() {
  const surface = document.querySelector(".activity-chart__scrub") as HTMLElement;
  vi.spyOn(surface, "getBoundingClientRect").mockReturnValue({
    x: 0, y: 0, top: 0, left: 0, right: 320, bottom: 150, width: 320, height: 150,
    toJSON: () => ({}),
  });
  return surface;
}

afterEach(() => vi.restoreAllMocks());

describe("connected run result", () => {
  it("leaves a minimum-field manual run unchanged apart from derived pace", () => {
    render(<RunResultDetail run={base} />);
    expect(hero()).toHaveTextContent("5 mi");
    expect(hero()).toHaveTextContent("40:00");
    expect(hero()).toHaveTextContent("8:00 /MI");
    expect(screen.getByText("Solid")).toBeInTheDocument();
    expect(screen.getByText("Felt controlled.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /intervals/i })).not.toBeInTheDocument();
  });

  /*
   * Issue #129: where a run came from is said the same way for every run, not
   * only the synced ones. Issue #214 moved that statement behind Run Detail's
   * own `…` control; on a surface with no such control — a Build block, a
   * planned workout — it stays in this compact line.
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

  it("hands provenance to the surrounding sheet when that sheet owns a run-options control", () => {
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: {} }} detailsBehindOptions />);
    expect(screen.queryByText("Intervals.icu")).not.toBeInTheDocument();
    expect(screen.queryByText("Solid")).not.toBeInTheDocument();
    // The run itself is untouched by that decision.
    expect(hero()).toHaveTextContent("5 mi");
  });

  it("omits every absent optional metric", () => {
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: {} }} />);
    expect(screen.getByText("Intervals.icu")).toBeInTheDocument();
    expect(screen.queryByText(/Avg HR|Max HR|Gain|Load|Cadence/)).not.toBeInTheDocument();
  });

  it("shows each approved optional summary with mobile-fit labels, and accessible HR-zone text without guessed zeroes", async () => {
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
    // With no stream there is no heart-rate chart to hold them, so the zones
    // keep a compact section of their own — still rows, never the standalone
    // donut module the redesign removed.
    const zones = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(zones).toHaveTextContent("Zone 2");
    expect(zones).toHaveTextContent("20:00 · 50%");
    expect(zones).not.toHaveTextContent("Zone 4");
    // And the insight line does not headline what the rows below state in full.
    expect(screen.queryByText(/of this run was in Zone/)).not.toBeInTheDocument();
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

  it("keeps the supporting metric strip to the source's own aggregates, with max HR moving into the heart-rate chart", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

    // Four compact facts, each with its own semantic identity. Max HR is not
    // among them: it is a supporting fact of the heart-rate chart, which this
    // run has, rather than a second heart-rate module above it.
    const strip = screen.getByLabelText("Imported run metrics");
    expect([...strip.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Gain", "Cadence", "Load"]);
    expect([...strip.querySelectorAll("div")].map((cell) => cell.dataset.metric))
      .toEqual(["heart-rate", "elevation", "cadence", "load"]);
  });

  it("keeps Gain as the source's own climbing total rather than anything recomputed from altitude", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

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
    await screen.findByText("Analysis");

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

  it("shows no Analysis section when the stream response carries no recognizable data", async () => {
    respondWith({ icu_intervals: [{ name: "Rep 1", moving_time: 180, distance: 800 }] }, {});

    render(<RunResultDetail run={syncedRun} syncToken="token" />);
    await screen.findByRole("list", { name: "Structured workout intervals" });

    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
  });

  it("plots only the metrics the stream data actually contains, with a working selector", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60],
      heartrate: [140, 150, 160],
      velocity_smooth: [3.0, 3.1, 3.2],
      // No altitude and no cadence stream: neither may appear as a selector.
    });

    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 150, maxHeartRate: 160 } }} syncToken="token" />);

    expect(await screen.findByText("Analysis")).toBeInTheDocument();
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
describe("Analysis facts come from the source's own aggregates", () => {
  it("states the run's own pace, never an average of instantaneous samples", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

    // 2.76 mi in 30:18 is 10:59 /mi, which is what Intervals (10:58) and
    // HealthFit (11:00) agree on. The samples' arithmetic mean is not this.
    expect(analysisFacts()).toEqual([{ label: "Avg pace", value: "10:59 /MI" }]);
  });

  it("never turns a near-stop into a displayed worst pace, or a spike into a best one", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

    const analysis = document.querySelector(".run-analysis")!;
    // The 0.5 m/s sample is a 53:38 /mi instant. It stays in the series and
    // out of the facts: no Low, no High, no Best, no Worst for pace at all.
    expect(within(analysis as HTMLElement).queryByText(/53:/)).not.toBeInTheDocument();
    expect(within(analysis as HTMLElement).queryByText("Low")).not.toBeInTheDocument();
    expect(within(analysis as HTMLElement).queryByText("High")).not.toBeInTheDocument();
    expect(within(analysis as HTMLElement).queryByText(/Best|Worst|Fastest|Slowest/)).not.toBeInTheDocument();
  });

  it("states imported average and max heart rate rather than sample extremes", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));

    // 153/174 are the imported aggregates; the stream's own extremes are
    // 140 and 160 and must not be what is stated.
    expect(analysisFacts()).toEqual([
      { label: "Avg", value: "153 bpm" },
      { label: "Max", value: "174 bpm" },
    ]);
  });

  it("states the source's Gain beside the series' own low and high for elevation", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Elevation" }));

    // 22.0 m and 34.4 m are 72 ft and 113 ft, the altitude span the review saw.
    // Gain stays the source's climbing total, which is a different question and
    // is never recomputed from those samples.
    expect(analysisFacts()).toEqual([
      { label: "Gain", value: "116 ft" },
      { label: "Low", value: "72 ft" },
      { label: "High", value: "113 ft" },
    ]);
  });

  it("gives every chart an elapsed-time axis running from 0:00 to the run's duration", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

    const axis = document.querySelector(".activity-chart__axis")!;
    expect(axis).toHaveTextContent("0:00");
    expect(axis).toHaveTextContent("30:15");
  });

  it("labels the y-axis in the metric's own units rather than leaving the shape unscaled", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));

    const ticks = [...document.querySelectorAll(".activity-chart__ticks span")].map((tick) => tick.textContent);
    expect(ticks.length).toBeGreaterThanOrEqual(2);
    // Round values inside the series' own 140–160 window.
    for (const tick of ticks) {
      expect(Number(tick)).toBeGreaterThanOrEqual(140);
      expect(Number(tick)).toBeLessThanOrEqual(160);
    }
  });
});

describe("Analysis cadence", () => {
  it("offers cadence as the fourth metric and reports it exactly as Intervals does", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

    expect(screen.getByRole("group", { name: "Run Profile metric" })).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Run Profile metric" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Pace", "Heart Rate", "Elevation", "Cadence"]);

    await userEvent.click(screen.getByRole("button", { name: "Cadence" }));
    // 79 is what the source says, so 79 is what STACK shows: not 158, and not
    // dressed in a unit this repository has not verified.
    expect(analysisFacts()).toEqual([{ label: "Avg cadence", value: "79" }]);
    expect(screen.queryByText("158")).not.toBeInTheDocument();
    expect(screen.queryByText(/79 spm|79 rpm|79 steps/i)).not.toBeInTheDocument();
  });

  it("offers no cadence at all when neither the stream nor the imported average has it", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60],
      heartrate: [140, 150, 160],
    });
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 150 } }} syncToken="token" />);
    await screen.findByText("Analysis");

    expect(screen.queryByRole("button", { name: "Cadence" })).not.toBeInTheDocument();
    expect(screen.queryByText("Cadence")).not.toBeInTheDocument();
  });

  it("keeps the verified average in the metric strip when the stream carried no cadence", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60],
      heartrate: [140, 150, 160],
    });
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

    expect(screen.queryByRole("button", { name: "Cadence" })).not.toBeInTheDocument();
    const strip = screen.getByLabelText("Imported run metrics");
    expect([...strip.querySelectorAll("dt")].map((label) => label.textContent))
      .toEqual(["Avg HR", "Gain", "Cadence", "Load"]);
    expect(within(strip).getByText("79")).toBeInTheDocument();
  });
});

describe("Analysis gaps", () => {
  it("breaks the line where the stream stopped rather than joining across it", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 30, 60, 90, 120, 150],
      // The middle of the run has no heart rate at all.
      heartrate: [140, 145, 0, 0, 150, 155],
    });
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 148, maxHeartRate: 155 } }} syncToken="token" />);
    await screen.findByText("Analysis");

    // Two measured stretches, never one line drawn straight over the hole.
    expect(chartLines()).toHaveLength(2);
  });

  it("treats a standing-still cadence as a gap rather than a measured zero", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Cadence" }));

    // The single 0 in the cadence stream is a stop, so the step breaks there
    // instead of plunging to the floor and implying a measured zero.
    expect(chartLines()).toHaveLength(2);
  });
});

/**
 * Issue #214's headline behaviour: a chart a runner can interrogate.
 *
 * The rules being protected are that the reading follows the finger, that it
 * stays put when the finger lifts, that it is available to a keyboard and a
 * screen reader in text, and that it never states a number STACK does not have
 * for that moment.
 */
describe("chart scrubbing", () => {
  async function renderAugust() {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");
  }

  it("selects the nearest recorded sample under a dragging finger and states it", async () => {
    await renderAugust();
    const surface = scrubSurface();

    // 320px wide for a 1815s run: two thirds across is about 20:00 elapsed,
    // whose nearest recorded sample is the one at 19:15.
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 214, clientY: 60 });

    const callout = document.querySelector(".activity-chart__callout")!;
    expect(callout).toHaveTextContent("19:15");
    expect(callout).toHaveTextContent("/MI");
    // What else was measured at that moment, and only what was measured.
    expect(callout).toHaveTextContent("154 bpm");

    fireEvent.pointerMove(surface, { pointerId: 1, clientX: 320, clientY: 60 });
    expect(document.querySelector(".activity-chart__callout")).toHaveTextContent("30:15");

    // The reading survives the finger lifting, which is the only way a phone
    // can offer a tooltip at all.
    fireEvent.pointerUp(surface, { pointerId: 1, clientX: 320, clientY: 60 });
    expect(document.querySelector(".activity-chart__callout")).toHaveTextContent("30:15");
  });

  it("draws a crosshair and a marker for the selected point, and clears both on a tap away", async () => {
    await renderAugust();
    const surface = scrubSurface();
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 160, clientY: 60 });

    expect(document.querySelector(".activity-chart__crosshair")).toBeInTheDocument();
    expect(document.querySelector(".activity-chart__marker")).toBeInTheDocument();

    fireEvent.pointerDown(document.body, { pointerId: 2, clientX: 10, clientY: 400 });
    expect(document.querySelector(".activity-chart__crosshair")).not.toBeInTheDocument();
    expect(document.querySelector(".activity-chart__callout")).not.toBeInTheDocument();
  });

  it("gives the cursor to the keyboard and states the reading as text", async () => {
    await renderAugust();
    const scrub = screen.getByRole("slider", { name: "Pace over elapsed time" });
    expect(scrub).toHaveAttribute("aria-valuetext", expect.stringContaining("Whole run"));

    fireEvent.keyDown(scrub, { key: "End" });
    expect(scrub.getAttribute("aria-valuetext")).toContain("30:15 elapsed");
    expect(scrub.getAttribute("aria-valuetext")).toContain("Pace");

    fireEvent.keyDown(scrub, { key: "Home" });
    expect(scrub.getAttribute("aria-valuetext")).toContain("0:00 elapsed");

    // Escape gives the whole run back rather than leaving a locked reading.
    fireEvent.keyDown(scrub, { key: "Escape" });
    expect(scrub.getAttribute("aria-valuetext")).toContain("Whole run");
  });

  it("says a metric was not recorded at that moment rather than inventing a value", async () => {
    respondWith(NO_INTERVALS, {
      time: [0, 60, 120, 180],
      heartrate: [140, 0, 0, 150],
    });
    render(<RunResultDetail run={{ ...syncedRun, importedMetrics: { averageHeartRate: 145 } }} syncToken="token" />);
    await screen.findByText("Analysis");

    const scrub = screen.getByRole("slider", { name: "Heart Rate over elapsed time" });
    fireEvent.keyDown(scrub, { key: "Home" });
    fireEvent.keyDown(scrub, { key: "ArrowRight" });

    expect(scrub.getAttribute("aria-valuetext")).toContain("no heart rate recorded here");
    expect(document.querySelector(".activity-chart__callout")).toHaveTextContent("No data");
    // A time position with no reading gets no marker, because there is nothing
    // there to mark.
    expect(document.querySelector(".activity-chart__marker")).not.toBeInTheDocument();
  });

  it("keeps the selection with the metric it was made on", async () => {
    await renderAugust();
    const surface = scrubSurface();
    fireEvent.pointerDown(surface, { pointerId: 1, clientX: 214, clientY: 60 });
    expect(document.querySelector(".activity-chart__callout")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Elevation" }));
    expect(document.querySelector(".activity-chart__callout")).not.toBeInTheDocument();
  });
});

/**
 * Issue #214 moved heart-rate zones inside heart rate. The composition is still
 * fully available as ordered text — that is what makes it accessible — but it
 * is no longer a standalone module competing with the analysis it belongs to.
 */
describe("heart-rate zones inside heart-rate analysis", () => {
  const zoned = {
    ...syncedRun,
    importedMetrics: { averageHeartRate: 150, hrZoneSeconds: [305, 412, 463, 430, 171, 0, 0] },
  };

  it("shows the distribution under the heart-rate chart and nowhere else", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={zoned} syncToken="token" />);
    await screen.findByText("Analysis");

    expect(screen.queryByRole("list", { name: "Heart rate zone distribution" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));

    const zones = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(within(zones).getAllByRole("listitem")).toHaveLength(5);
    expect(zones).toHaveTextContent("Zone 3");
    expect(zones).toHaveTextContent("7:43 · 26%");
    // A zone with no time in it is absent rather than shown as a zero.
    expect(zones).not.toHaveTextContent("Zone 6");
    expect(zones.closest(".run-analysis")).not.toBeNull();
  });

  it("gives every zone an ordered, selectable row with its duration and share", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={zoned} syncToken="token" />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));

    const row = screen.getByRole("button", { name: "Zone 2, 6:52, 23%" });
    expect(row).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "false");
  });

  it("shows no zone distribution at all when the source stated none", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));

    expect(screen.queryByRole("list", { name: "Heart rate zone distribution" })).not.toBeInTheDocument();
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
    // including the cadence and the max heart rate the analysis would have held.
    await screen.findByText("79");
    expect(hero()).toHaveTextContent("2.76 mi");
    expect(hero()).toHaveTextContent("10:59 /MI");
    expect(screen.getByText("153 bpm")).toBeInTheDocument();
    expect(screen.getByText("174 bpm")).toBeInTheDocument();
    expect(screen.getByText("116 ft")).toBeInTheDocument();
    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
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

    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
  });

  it("asks the source for nothing when the run was never synced", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<RunResultDetail run={base} syncToken="token" />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
  });

  it("keeps every touch target for the analysis tabs a real button", async () => {
    respondWith(NO_INTERVALS, augustStreams);
    render(<RunResultDetail run={augustRun} syncToken="token" />);
    await screen.findByText("Analysis");

    for (const selector of within(screen.getByRole("group", { name: "Run Profile metric" }))
      .getAllByRole("button")) {
      expect(selector.tagName).toBe("BUTTON");
      expect(selector).toHaveAttribute("aria-pressed");
      expect(selector).toHaveClass("run-profile__selector");
    }
  });
});
