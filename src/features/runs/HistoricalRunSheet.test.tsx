import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { IntervalsRunProfile } from "../../connected/intervals.js";
import { SourceDetailReaderProvider, type SourceDetailReaderFactory } from "../../connected/sourceDetail.js";
import { historicalRun } from "../../history/runnerFixtures.js";
import { unifiedRunnerHistory, type RunnerRun } from "../../history/runnerRun.js";
import { HistoricalRunSheet } from "./HistoricalRunSheet.js";

/**
 * R3B: a historical-only run reaching the same source-owned detail an accepted
 * run already had, without becoming a STACK run to do it.
 *
 * The two halves these cover are the ones that could go wrong quietly. The
 * summary must never wait on a network read, because the run's facts are
 * already in hand; and the enrichment must never add a fact the source did not
 * state, or an action the runner has not earned the right to take.
 */

/** One run the source recorded, as the unified history hands it over. */
function run(sourceId: string | null, overrides: Partial<RunnerRun> = {}): RunnerRun {
  const [base] = unifiedRunnerHistory({
    activities: [
      historicalRun(sourceId ?? "unused", "2026-08-12", {
        miles: 6.2,
        durationSeconds: 3_720,
        name: "Morning Run",
        averageHeartRate: 148,
        maxHeartRate: 170,
        elevationGainMeters: 61,
        averageCadence: 79,
        trainingLoad: 71,
      }),
    ],
  });
  return { ...base, externalActivityId: sourceId, ...overrides };
}

const STREAMS = {
  time: [0, 30, 60, 90, 120, 150],
  heartrate: [141, 146, 150, 0, 152, 155],
  altitude: [30.0, 33.5, 36.0, 34.0, 31.5, 30.5],
  velocity_smooth: [2.6, 2.62, 2.58, 2.64, 2.61, 2.59],
  cadence: [79, 79, 80, 79, 78, 79],
};

/** Answers the detail read first and the stream read second, as the sheet issues them. */
function respondWith(detail: object, streams: object) {
  return vi.spyOn(globalThis, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify(detail)))
    .mockResolvedValueOnce(new Response(JSON.stringify(streams)));
}

/** A reader whose profile read behaves however one test needs it to. */
function readerFactory(
  readProfile: (id: string) => Promise<IntervalsRunProfile | null>,
): SourceDetailReaderFactory {
  return () => ({ readDetail: async () => ({ intervals: [] }), readProfile });
}

/** The result panel, whose figures and units are separate elements by design. */
function hero() {
  return screen.getByLabelText("Primary activity results");
}

afterEach(() => vi.restoreAllMocks());

describe("historical-only run detail", () => {
  it("states the source's own facts and offers nothing STACK-owned to act on", () => {
    render(<HistoricalRunSheet run={run("a-1")} isOpen onClose={() => undefined} />);

    const sheet = within(screen.getByRole("dialog"));
    expect(hero()).toHaveTextContent("6.2 mi");
    expect(hero()).toHaveTextContent("1:02:00");
    expect(hero()).toHaveTextContent("10:00 /MI");
    expect(sheet.getByText("148 bpm")).toBeInTheDocument();
    expect(sheet.getByText("History")).toBeInTheDocument();
    // The source's own name for the activity leads, rather than "Run Detail".
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Morning Run");

    // No effort, no notes, no plan link, no block, no import: nothing has been
    // decided about this run, so nothing here pretends otherwise.
    expect(sheet.queryByText(/Effort/)).not.toBeInTheDocument();
    expect(sheet.queryByText(/^(Plan|Extra)$/)).not.toBeInTheDocument();
    expect(sheet.queryByRole("button", { name: /edit|connect to plan|import|accept|place/i }))
      .not.toBeInTheDocument();
  });

  it("renders the summary immediately rather than waiting for the source read", () => {
    // A read that never resolves: everything below is on screen regardless.
    render(
      <SourceDetailReaderProvider value={readerFactory(() => new Promise(() => undefined))}>
        <HistoricalRunSheet run={run("a-1")} connection="token" isOpen onClose={() => undefined} />
      </SourceDetailReaderProvider>,
    );

    const sheet = within(screen.getByRole("dialog"));
    expect(hero()).toHaveTextContent("6.2 mi");
    expect(hero()).toHaveTextContent("10:00 /MI");
    expect(sheet.getByText("71")).toBeInTheDocument();
    // And no chart frame standing empty while it waits.
    expect(sheet.queryByText("Analysis")).not.toBeInTheDocument();
  });

  it("asks the source for nothing when the run has no stable source id", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<HistoricalRunSheet run={run(null)} connection="token" isOpen onClose={() => undefined} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
  });

  it("asks the source for nothing when this device has no connection", () => {
    const fetchMock = vi.spyOn(globalThis, "fetch");
    render(<HistoricalRunSheet run={run("a-1")} isOpen onClose={() => undefined} />);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
  });

  it("reveals the shared Analysis module when a source id and a connection resolve one", async () => {
    const fetchMock = respondWith({ icu_intervals: [] }, STREAMS);
    render(<HistoricalRunSheet run={run("a-1")} connection="token" isOpen onClose={() => undefined} />);

    expect(await screen.findByText("Analysis")).toBeInTheDocument();
    expect(
      within(screen.getByRole("group", { name: "Run Profile metric" }))
        .getAllByRole("button")
        .map((button) => button.textContent),
    ).toEqual(["Pace", "Heart Rate", "Elevation", "Cadence"]);

    // On open, for this one run — never during history sync, and never for the
    // archive: only the two reads this sheet needs.
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => !String(url).includes("resource=activities")))
      .toBe(true);
  });

  it("keeps the summary and stays quiet when the source profile is unrecognized", async () => {
    respondWith({ icu_intervals: [] }, { unexpected: true });
    render(<HistoricalRunSheet run={run("a-1")} connection="token" isOpen onClose={() => undefined} />);

    const sheet = within(screen.getByRole("dialog"));
    await vi.waitFor(() => expect(sheet.getByText("148 bpm")).toBeInTheDocument());
    expect(sheet.queryByText("Analysis")).not.toBeInTheDocument();
    expect(sheet.queryByRole("alert")).not.toBeInTheDocument();
    expect(hero()).toHaveTextContent("6.2 mi");
  });

  it("keeps the summary when the profile read fails outright", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({ icu_intervals: [] })))
      .mockRejectedValueOnce(new Error("network down"));

    render(<HistoricalRunSheet run={run("a-1")} connection="token" isOpen onClose={() => undefined} />);

    const sheet = within(screen.getByRole("dialog"));
    await vi.waitFor(() => expect(sheet.getByText("148 bpm")).toBeInTheDocument());
    expect(hero()).toHaveTextContent("6.2 mi");
    expect(sheet.queryByText("Analysis")).not.toBeInTheDocument();
    expect(sheet.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("never lets a superseded run's slow answer land in the run now open", async () => {
    const pending = new Map<string, (profile: IntervalsRunProfile | null) => void>();
    const factory = readerFactory(
      (id) => new Promise<IntervalsRunProfile | null>((resolve) => pending.set(id, resolve)),
    );

    const view = render(
      <SourceDetailReaderProvider value={factory}>
        <HistoricalRunSheet run={run("slow-run")} connection="token" isOpen onClose={() => undefined} />
      </SourceDetailReaderProvider>,
    );

    view.rerender(
      <SourceDetailReaderProvider value={factory}>
        <HistoricalRunSheet run={run("current-run")} connection="token" isOpen onClose={() => undefined} />
      </SourceDetailReaderProvider>,
    );

    // The first run finally answers, after the sheet has moved on.
    pending.get("slow-run")?.({
      samples: [
        { timeSeconds: 0, heartRate: 140 },
        { timeSeconds: 30, heartRate: 150 },
      ],
    });
    await Promise.resolve();

    expect(screen.queryByText("Analysis")).not.toBeInTheDocument();
  });
});

describe("historical-only source truth", () => {
  it("states the run's own pace and the source's own aggregates, never the stream's", async () => {
    respondWith({ icu_intervals: [] }, STREAMS);
    render(<HistoricalRunSheet run={run("a-1")} connection="token" isOpen onClose={() => undefined} />);
    await screen.findByText("Analysis");

    const sheet = within(screen.getByRole("dialog"));
    // 6.2 mi in 1:02:00 is 10:00 /mi. The velocity samples are around 2.6 m/s,
    // which is 10:19 /mi, and must not be what the sheet states.
    // Stated twice — as the result, and as the pace chart's own Avg pace fact —
    // and it is the same trusted number both times.
    expect(hero()).toHaveTextContent("10:00 /MI");
    expect(sheet.getByText("10:00 /MI")).toBeInTheDocument();
    expect(sheet.queryByText("10:19 /MI")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Heart Rate" }));
    // The imported aggregates, not the stream's own 141/155 extremes.
    expect(sheet.getAllByText("148 bpm").length).toBeGreaterThan(0);
    expect(sheet.getAllByText("170 bpm").length).toBeGreaterThan(0);
    expect(sheet.queryByText("141 bpm")).not.toBeInTheDocument();
    expect(sheet.queryByText("155 bpm")).not.toBeInTheDocument();

    // 61 m of source-stated climbing is 200 ft; the altitude series only spans
    // 30.0–36.0 m, so a recomputed gain would be a different number entirely.
    expect(sheet.getByText("200 ft")).toBeInTheDocument();
  });

  it("shows cadence exactly as the source stated it, undoubled and unlabelled", async () => {
    respondWith({ icu_intervals: [] }, STREAMS);
    render(<HistoricalRunSheet run={run("a-1")} connection="token" isOpen onClose={() => undefined} />);
    await screen.findByText("Analysis");
    await userEvent.click(screen.getByRole("button", { name: "Cadence" }));

    const sheet = within(screen.getByRole("dialog"));
    // The stated average is the source's own figure. The cadence axis happens
    // to carry a 79 too, which is the same number for the same reason.
    const facts = document.querySelector(".run-analysis__facts") as HTMLElement;
    expect(within(facts).getByText("79")).toBeInTheDocument();
    expect(within(facts).getByText("Avg cadence")).toBeInTheDocument();
    expect(sheet.queryByText("158")).not.toBeInTheDocument();
    expect(sheet.queryByText(/79 spm|79 rpm|79 steps/i)).not.toBeInTheDocument();
  });

  it("omits every metric the source never measured rather than showing a zero", () => {
    const bare = run("a-1", {
      averageHeartRate: null,
      maxHeartRate: null,
      hrZoneSeconds: null,
      elevationGainFeet: null,
      averageCadence: null,
      trainingLoad: null,
    });
    render(<HistoricalRunSheet run={bare} isOpen onClose={() => undefined} />);

    const sheet = within(screen.getByRole("dialog"));
    expect(hero()).toHaveTextContent("6.2 mi");
    expect(sheet.queryByLabelText("Imported run metrics")).not.toBeInTheDocument();
    expect(sheet.queryByText(/0 bpm|0 ft/)).not.toBeInTheDocument();
    expect(sheet.queryByRole("list", { name: "Heart rate zone distribution" })).not.toBeInTheDocument();
  });
});

/**
 * Issue #214: the run leads, and everything administrative is one tap away.
 *
 * A historical run has nothing STACK-owned to act on, so what lives behind its
 * `…` is provenance and methodology only — no edit, no plan link, no effort.
 */
describe("historical-only identity and run options", () => {
  it("falls back to what the source type verifiably is when it stated no name", () => {
    render(
      <HistoricalRunSheet run={run("a-1", { sourceName: null })} isOpen onClose={() => undefined} />,
    );

    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run");
    // Nothing invented to fill the gap: no workout title, no "Morning Run".
    expect(screen.queryByText("Morning Run")).not.toBeInTheDocument();
  });

  it("keeps source and methodology behind the run options control", async () => {
    render(<HistoricalRunSheet run={run("a-1")} isOpen onClose={() => undefined} />);

    const sheet = within(screen.getByRole("dialog"));
    expect(sheet.queryByText("Intervals.icu")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Run options" }));
    const options = within(screen.getByRole("dialog", { name: "Run Options" }));
    expect(options.getByText("Intervals.icu")).toBeInTheDocument();
    expect(options.getByText("How STACK calculates this")).toBeInTheDocument();
    // Still nothing to act on: a historical run remains read-only.
    expect(options.queryByRole("button", { name: /edit|connect to plan|unlink/i }))
      .not.toBeInTheDocument();
  });
});
