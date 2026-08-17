import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { addDaysToLocalDate } from "../../domain/dates";
import { historicalRun, stackRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import { sparseTickIndices } from "../../components/charts/chartTickDensity";
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

function renderExplorer(onOpenRun = vi.fn()) {
  return render(
    <HistoryExplorer runs={runs()} today={TODAY} onBack={vi.fn()} onOpenRun={onOpenRun} />,
  );
}

describe("History Explorer", () => {
  it("opens on the largest fully known range up to 3M with all R2 metrics", () => {
    renderExplorer();

    expect(screen.getByRole("heading", { name: "History" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "3M" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "Miles",
      "Runs",
      "Time",
      "Load",
      "Gain",
      "Zones",
    ]);
    expect(screen.getByRole("slider", { name: "Select Miles period" })).toHaveAttribute(
      "aria-valuetext",
      expect.stringMatching(/mi · \d+ runs?/),
    );
  });

  it("lets touch/keyboard selection traverse every bucket through one full chart scrubber", () => {
    renderExplorer();
    const scrubber = screen.getByRole("slider", { name: "Select Miles period" });
    const previous = scrubber.getAttribute("aria-valuetext");

    scrubber.focus();
    fireEvent.change(scrubber, { target: { value: Number(scrubber.getAttribute("value")) - 1 } });

    expect(scrubber).toHaveFocus();
    expect(scrubber.getAttribute("aria-valuetext")).not.toBe(previous);
    expect(Number(scrubber.getAttribute("max")) + 1).toBeGreaterThan(4);
  });

  it("filters on stable Planned, Extra, and History-only facts", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("button", { name: "Planned" }));
    expect(screen.getByText("1 RUN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Monday, August 10/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Extra" }));
    expect(screen.getByText("1 RUN")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Wednesday, August 12/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "History only" }));
    expect(screen.queryByRole("button", { name: /Extra run/ })).not.toBeInTheDocument();
  });

  it("shows source coverage instead of zero-filling optional metrics", async () => {
    const user = userEvent.setup();
    renderExplorer();

    await user.click(screen.getByRole("tab", { name: "Load" }));
    expect(screen.getByText(/Source-provided for \d+ of \d+ runs/)).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "Select Load period" })).toHaveAccessibleName(
      "Select Load period",
    );

    await user.click(screen.getByRole("tab", { name: "Zones" }));
    expect(screen.getByLabelText("Heart-rate zone composition")).toBeInTheDocument();
    expect(screen.getByText(/Recorded for \d+ of \d+ runs/)).toBeInTheDocument();
  });

  it("routes a contributing row through the existing run-detail callback", async () => {
    const user = userEvent.setup();
    const onOpenRun = vi.fn();
    renderExplorer(onOpenRun);

    await user.click(screen.getByRole("button", { name: "History only" }));
    await user.click(screen.getAllByRole("button", { name: /Not logged in STACK/ })[0]);
    expect(onOpenRun).toHaveBeenCalledTimes(1);
  });
});

describe("History chart tick density", () => {
  it("keeps four to six readable labels while preserving the selected bucket", () => {
    for (const count of [6, 14, 26, 48]) {
      const selected = Math.floor(count / 3);
      const ticks = sparseTickIndices(count, selected);
      expect(ticks).toContain(selected);
      expect(ticks.length).toBeGreaterThanOrEqual(4);
      expect(ticks.length).toBeLessThanOrEqual(6);
    }
  });
});
