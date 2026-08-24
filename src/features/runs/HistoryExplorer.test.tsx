import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addDaysToLocalDate } from "../../domain/dates";
import { historicalRun, stackRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { HistoryExplorer } from "./HistoryExplorer";

const TODAY = "2026-08-17";

function runs() {
  const activities = Array.from({ length: 16 }, (_, index) =>
    historicalRun(`history-${index}`, addDaysToLocalDate("2026-05-01", index * 7), {
      miles: 3 + (index % 4),
      durationSeconds: index % 3 === 0 ? 2_400 : undefined,
      trainingLoad: index % 2 === 0 ? 40 + index : null,
      elevationGainMeters: index % 4 === 0 ? 100 + index : null,
      hrZoneSeconds: index % 3 === 0 ? [300, 600, 180, 60] : null,
    }),
  );
  const runLogs = [
    stackRun("planned", "2026-08-10", { workoutId: "workout-002" }),
    stackRun("extra", "2026-08-12"),
  ];
  return unifiedRunnerHistory({ activities, runLogs });
}

function renderExplorer(onOpenRun = vi.fn(), onBack = vi.fn()) {
  return render(
    <HistoryExplorer runs={runs()} today={TODAY} onBack={onBack} onOpenRun={onOpenRun} />,
  );
}

function chart(): HTMLElement | null {
  return document.querySelector<HTMLElement>(".history-chart");
}

describe("History Explorer shell", () => {
  it("leads with one destination header and no explanatory page copy", () => {
    renderExplorer();

    const heading = screen.getByRole("heading", { name: "History", level: 1 });
    expect(heading).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to Runs" })).toBeInTheDocument();
    expect(screen.queryByText("RUNS · HISTORY")).not.toBeInTheDocument();
    expect(screen.queryByText(/Explore what you actually ran/)).not.toBeInTheDocument();
    // The title is normal STACK sans; machine type is reserved for the data.
    expect(heading.className).not.toContain("machine");
  });

  it("focuses its own title so the child screen reads from its top", () => {
    renderExplorer();
    expect(screen.getByRole("heading", { name: "History", level: 1 })).toHaveFocus();
  });

  it("returns to Runs Overview from the back affordance", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    renderExplorer(vi.fn(), onBack);

    await user.click(screen.getByRole("button", { name: "Back to Runs" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("offers metric and range as the only persistent controls", () => {
    renderExplorer();

    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Miles",
      "Runs",
      "Time",
      "Load",
      "Gain",
      "Zones",
    ]);
    for (const range of ["4W", "3M", "6M", "YTD", "1Y", "All"]) {
      expect(screen.getByRole("button", { name: range })).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute("aria-pressed", "true");
  });

  it("has no permanent Planned / Extra / History-only filter row", () => {
    renderExplorer();

    for (const label of ["Planned", "Extra", "History only"]) {
      expect(screen.queryByRole("button", { name: label })).not.toBeInTheDocument();
    }
    expect(document.querySelector(".history-selector--filter")).toBeNull();
  });

  it("switches metric and range without a second readout under the chart", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "4W" }));
    expect(screen.getByRole("button", { name: "4W" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("tab", { name: "Time" }));
    expect(screen.getByRole("tab", { name: "Time" })).toHaveAttribute("aria-selected", "true");
    // One readout owns the result: the selected-period line lives inside it.
    expect(document.querySelectorAll(".history-readout")).toHaveLength(1);
    expect(document.querySelector(".history-chart__selection")).toBeNull();
  });
});

describe("History Explorer readout", () => {
  it("states the value, the covered dates and one context line", () => {
    renderExplorer();

    const readout = document.querySelector<HTMLElement>(".history-readout")!;
    expect(within(readout).getByText("Miles")).toBeInTheDocument();
    expect(readout.querySelector(".history-readout__unit")).toHaveTextContent("mi");
    expect(readout.querySelector(".history-readout__period")?.textContent).toMatch(
      /\w{3} \d+, \d{4} – \w{3} \d+, \d{4}/,
    );
    expect(readout.querySelector(".history-readout__context")?.textContent).toMatch(/avg .* mi\/wk/);
  });

  it("presents mileage at one decimal rather than leaking aggregation precision", async () => {
    const user = userEvent.setup();
    render(
      <HistoryExplorer
        runs={unifiedRunnerHistory({
          activities: [
            historicalRun("a", "2026-08-10", { miles: 3.125 }),
            historicalRun("b", "2026-08-12", { miles: 4.128 }),
          ],
        })}
        today={TODAY}
        onBack={vi.fn()}
        onOpenRun={vi.fn()}
      />,
    );

    const value = document.querySelector(".history-readout__value strong")!;
    expect(value.textContent).toBe("7.3");

    await user.click(screen.getByRole("tab", { name: "Runs" }));
    expect(document.querySelector(".history-readout__value strong")?.textContent).toBe("2");
  });

  it("keeps optional-metric coverage beside the result instead of implying a full total", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("tab", { name: "Load" }));
    expect(
      document.querySelector(".history-readout__context")?.textContent,
    ).toMatch(/Source-provided for \d+ of \d+ runs/);
  });

  it("names the selected period in the readout, marking one still in progress", async () => {
    const user = userEvent.setup();
    renderExplorer();

    const selection = document.querySelector(".history-readout__selection")!;
    expect(selection.textContent).toMatch(/\w{3} \d+ – \w{3} \d+ · .* · \d+ runs?/);
    expect(selection.textContent).not.toMatch(/In progress/);

    const scrubber = screen.getByRole("slider", { name: "Select Miles period" });
    fireEvent.change(scrubber, { target: { value: Number(scrubber.getAttribute("max")) } });
    await user.click(screen.getByRole("tab", { name: "Miles" }));
    expect(document.querySelector(".history-readout__selection")).toBeInTheDocument();
  });
});

describe("History Explorer charts", () => {
  it("draws each metric as what the metric means", async () => {
    const user = userEvent.setup();
    renderExplorer();

    expect(chart()).toHaveAttribute("data-kind", "bar");

    await user.click(screen.getByRole("tab", { name: "Time" }));
    expect(chart()).toHaveAttribute("data-kind", "bar");

    for (const metric of ["Runs", "Load", "Gain"]) {
      await user.click(screen.getByRole("tab", { name: metric }));
      expect(chart()).toHaveAttribute("data-kind", "line");
      expect(document.querySelector(".history-chart__line")).toBeInTheDocument();
    }

    await user.click(screen.getByRole("tab", { name: "Zones" }));
    expect(chart()).toBeNull();
    expect(screen.getByLabelText("Heart-rate zone composition")).toBeInTheDocument();
  });

  it("opens on the latest completed non-empty period, not an empty current one", () => {
    render(
      <HistoryExplorer
        runs={unifiedRunnerHistory({
          activities: [
            historicalRun("a", "2026-07-27", { miles: 6 }),
            historicalRun("b", "2026-08-05", { miles: 8 }),
          ],
        })}
        today={TODAY}
        onBack={vi.fn()}
        onOpenRun={vi.fn()}
      />,
    );

    // 4W trailing buckets end Jul 27 / Aug 3 / Aug 10 / Aug 17; the last one
    // holds no runs, so the chart opens on the completed week that does.
    expect(
      screen.getByRole("slider", { name: "Select Miles period" }),
    ).toHaveAttribute("aria-valuetext", expect.stringContaining("8.0 mi"));
  });

  it("draws exactly four columns for 4W", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "4W" }));
    expect(document.querySelectorAll(".history-chart__bar-slot")).toHaveLength(4);
    expect(document.querySelectorAll(".history-chart__x span")).toHaveLength(4);
  });

  it("labels the axis sparsely and separates every visible label", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "6M" }));
    const buckets = document.querySelectorAll(".history-chart__bar-slot").length;
    const labels = [...document.querySelectorAll<HTMLElement>(".history-chart__x span")];

    expect(buckets).toBeGreaterThan(6);
    expect(labels.length).toBeLessThanOrEqual(4);
    expect(labels.every((label) => label.textContent?.trim())).toBe(true);
    expect(labels[0]).toHaveAttribute("data-edge", "start");
    expect(labels.at(-1)).toHaveAttribute("data-edge", "end");

    const positions = labels
      .slice(1, -1)
      .map((label) => Number.parseFloat(label.style.getPropertyValue("--tick-x")));
    for (let index = 1; index < positions.length; index += 1) {
      expect(positions[index] - positions[index - 1]).toBeGreaterThan(15);
    }
  });

  it("traverses every bucket through one full-plot scrubber", () => {
    renderExplorer();
    const scrubber = screen.getByRole("slider", { name: "Select Miles period" });
    const previous = scrubber.getAttribute("aria-valuetext");

    scrubber.focus();
    fireEvent.change(scrubber, {
      target: { value: Number(scrubber.getAttribute("value")) - 1 },
    });

    expect(scrubber).toHaveFocus();
    expect(scrubber.getAttribute("aria-valuetext")).not.toBe(previous);
    expect(Number(scrubber.getAttribute("max")) + 1).toBeGreaterThan(4);
  });
});

describe("History Explorer zones", () => {
  it("leads with composition and keeps recorded time as the supporting fact", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("tab", { name: "Zones" }));
    const readout = document.querySelector<HTMLElement>(".history-readout")!;
    expect(readout.querySelector(".history-readout__value strong")?.textContent).toMatch(/^\d+%$/);
    expect(readout.querySelector(".history-readout__unit")).toHaveTextContent("Z1–Z2");
    expect(readout.querySelector(".history-readout__context")?.textContent).toMatch(
      /recorded · \d+ of \d+ runs/,
    );
    expect(screen.getByLabelText("Heart-rate zone composition")).toBeInTheDocument();
  });
});

describe("History Explorer run list", () => {
  it("names the mixed activity list and covers the whole selected range", () => {
    renderExplorer();

    expect(screen.getByRole("heading", { name: "Activities in period" })).toBeInTheDocument();
    expect(screen.queryByText(/CONTRIBUTING RUNS/i)).not.toBeInTheDocument();
    const count = document.querySelector(".history-explorer__runs-count")!.textContent;
    expect(count).toMatch(/^\d+ ACTIVIT(?:Y|IES)$/);
    expect(document.querySelectorAll(".history-explorer__run-list .run-row").length).toBe(
      Number.parseInt(count!, 10),
    );
  });

  it("narrows to one selected period and can widen back to the range", async () => {
    const user = userEvent.setup();
    renderExplorer();

    const all = document.querySelectorAll(".history-explorer__run-list .run-row").length;
    const scrubber = screen.getByRole("slider", { name: "Select Miles period" });
    fireEvent.change(scrubber, { target: { value: 0 } });

    const narrowed = document.querySelectorAll(".history-explorer__run-list .run-row").length;
    expect(narrowed).toBeLessThan(all);

    await user.click(screen.getByRole("button", { name: "Show the whole range" }));
    expect(document.querySelectorAll(".history-explorer__run-list .run-row").length).toBe(all);
  });

  it("routes a row through the existing run-detail callback", async () => {
    const user = userEvent.setup();
    const onOpenRun = vi.fn();
    renderExplorer(onOpenRun);

    await user.click(screen.getAllByRole("button", { name: /Not logged in STACK/ })[0]);
    expect(onOpenRun).toHaveBeenCalledTimes(1);
  });

  it("keeps historical-only and STACK runs in one newest-first record", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "All" }));
    const rows = [...document.querySelectorAll(".history-explorer__run-list .run-row")];
    expect(rows.length).toBeGreaterThan(3);
    expect(rows.some((row) => row.getAttribute("data-origin") === "historical-activity")).toBe(true);
  });
});
