import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDaysToLocalDate } from "../../domain/dates.js";
import { historicalRun, stackRun } from "../../history/runnerFixtures.js";
import { unifiedRunnerHistory } from "../../history/runnerRun.js";
import type { HistoricalActivity } from "../../history/historicalActivity.js";
import type { RunLog } from "../../domain/types.js";
import { loadSeedPlan } from "../../seed/loadSeedPlan.js";
import { RunsScreen } from "../runs/RunsScreen.js";

/** Training Signals v2 on the Runs screen. Domain arithmetic is tested in src/signals/. */

const plan = loadSeedPlan();
const TODAY = "2026-08-15";

interface HistorySpec {
  current: [count: number, miles: number];
  baseline: [count: number, miles: number];
  currentOptions?: Parameters<typeof historicalRun>[2];
  baselineOptions?: Parameters<typeof historicalRun>[2];
}

function history({
  current: [currentCount, currentMiles],
  baseline: [baselineCount, baselineMiles],
  currentOptions = {},
  baselineOptions = {},
}: HistorySpec): HistoricalActivity[] {
  const spread = (
    prefix: string,
    startDate: string,
    count: number,
    miles: number,
    options: Parameters<typeof historicalRun>[2],
  ) =>
    Array.from({ length: count }, (_, index) =>
      historicalRun(
        `${prefix}-${index}`,
        addDaysToLocalDate(startDate, Math.round((index * 27) / Math.max(count, 1))),
        { miles, ...options },
      ),
    );

  return [
    ...spread("cur", "2026-07-19", currentCount, currentMiles, currentOptions),
    ...spread("base", "2026-06-21", baselineCount, baselineMiles, baselineOptions),
    historicalRun("anchor", "2026-06-20", { miles: 3 }),
  ];
}

function renderRuns(
  activities: HistoricalActivity[] = [],
  runLogs: RunLog[] = [],
  today = TODAY,
) {
  return render(
    <RunsScreen
      plan={plan}
      runLogs={runLogs}
      runnerRuns={unifiedRunnerHistory({ activities, runLogs })}
      today={today}
    />,
  );
}

function signalCards() {
  return [
    ...document.querySelectorAll<HTMLElement>(".signal-cards.section .signal-card"),
  ];
}

function cardOrder() {
  return signalCards().map((card) => card.dataset.signal);
}

const RISING_VOLUME: HistorySpec = {
  current: [8, 3.1],
  baseline: [8, 2.45],
};

describe("Training Signals cards", () => {
  it("leads with one factual reading and visual without visible explanatory copy", () => {
    renderRuns(history(RISING_VOLUME));

    const volume = screen.getByRole("button", { name: /^Volume\. Last 28 days/ });
    expect(volume).toHaveAccessibleName(
      "Volume. Last 28 days: 24.8 mi. Change: +5.2 mi. Prior 28 days: 19.6 mi. Open detail.",
    );
    expect(volume).toHaveTextContent("Volume");
    expect(volume).toHaveTextContent("24.8 mi");
    expect(volume).toHaveTextContent("+5.2 mi");
    expect(volume).toHaveTextContent("19.6 mi");
    expect(volume).not.toHaveTextContent("Volume is building");
    expect(volume.querySelector("p")).toBeNull();
  });

  it("sits between Recent Training and the three-run preview", () => {
    renderRuns(history(RISING_VOLUME));

    const sections = [...document.querySelectorAll(".section__title")].map(
      (title) => title.textContent,
    );
    expect(sections).toEqual(["Recent Training", "Training Signals", "Recent Activity"]);
  });

  it("orders what changed above what did not, then by family", () => {
    renderRuns(
      history({
        current: [8, 3.1],
        baseline: [8, 2],
      }),
    );

    expect(cardOrder()).toEqual([
      "volume-trend",
      "long-run-progression",
      "run-frequency",
    ]);
  });

  it("caps the visual overview at three and reveals the remaining domain-ordered signals inline", async () => {
    const user = userEvent.setup();
    renderRuns(
      history({
        current: [10, 4],
        baseline: [10, 3],
        currentOptions: {
          trainingLoad: 60,
          hrZoneSeconds: [600, 600, 600],
        },
        baselineOptions: {
          trainingLoad: 40,
          hrZoneSeconds: [200, 200, 1_600],
        },
      }),
    );

    expect(signalCards()).toHaveLength(3);
    expect(signalCards().every((card) => card.querySelector(".signal-card__visual"))).toBe(true);
    await user.click(screen.getByRole("button", { name: "Show all signals" }));

    const allCards = signalCards();
    expect(allCards).toHaveLength(6);
    expect(allCards.map((card) => card.dataset.signal)).toEqual([
      "volume-trend",
      "long-run-progression",
      "workload-trend",
      "zone-distribution",
      "run-frequency",
      "plan-completion",
    ]);
    expect(screen.queryByRole("dialog", { name: "All Training Signals" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Show fewer signals" }));
    expect(signalCards()).toHaveLength(3);
  });

  it("suppresses a signal with nothing to say rather than showing an empty card", () => {
    renderRuns(history(RISING_VOLUME));

    expect(cardOrder()).not.toContain("workload-trend");
    expect(cardOrder()).not.toContain("zone-distribution");
    expect(screen.queryByText(/not enough data/i)).not.toBeInTheDocument();
  });

  it("says once that it needs more history rather than six times", () => {
    renderRuns(
      [
        historicalRun("r-1", "2026-07-24"),
        historicalRun("r-2", "2026-07-28"),
        historicalRun("r-3", "2026-08-01"),
      ],
      [],
      "2026-08-02",
    );

    expect(signalCards()).toHaveLength(0);
    expect(screen.getByText(/More history needed/)).toBeInTheDocument();
  });

  it("shows nothing at all when there is no running to describe", () => {
    renderRuns();

    expect(
      screen.queryByRole("heading", { name: "Training Signals" }),
    ).not.toBeInTheDocument();
  });

  it("gives a manual-only runner the signals their own runs support", () => {
    const runLogs = [
      ...Array.from({ length: 8 }, (_, index) =>
        stackRun(`c-${index}`, addDaysToLocalDate("2026-07-19", index * 3), {
          distanceMiles: 4,
        }),
      ),
      ...Array.from({ length: 8 }, (_, index) =>
        stackRun(`b-${index}`, addDaysToLocalDate("2026-06-21", index * 3), {
          distanceMiles: 2,
        }),
      ),
      stackRun("anchor", "2026-06-20", { distanceMiles: 3 }),
    ];
    renderRuns([], runLogs);

    expect(cardOrder()).toContain("volume-trend");
    expect(cardOrder()).not.toContain("workload-trend");
  });

  it("does not colour a direction, and carries no score", () => {
    renderRuns(history(RISING_VOLUME));

    for (const card of signalCards()) {
      expect(card.className).not.toMatch(/good|bad|positive|negative|success|danger/);
    }
    expect(screen.queryByText(/score/i)).not.toBeInTheDocument();
  });
});

describe("Training Signal detail", () => {
  it("opens result-first and keeps exact window dates behind methodology", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME));

    await user.click(screen.getByRole("button", { name: /^Volume\. Last 28 days/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Volume");
    expect(dialog).toHaveTextContent("24.8 mi");
    expect(dialog).toHaveTextContent("19.6 mi");
    expect(dialog).toHaveTextContent("+5.2 mi");
    expect(dialog.querySelector(".signal-methodology")).not.toHaveAttribute("open");

    await user.click(screen.getByText("How STACK calculates this"));
    expect(dialog.querySelector(".signal-methodology")).toHaveAttribute("open");
    expect(dialog).toHaveTextContent("Jul 19 — Aug 15");
    expect(dialog).toHaveTextContent("Jun 21 — Jul 18");
  });

  it("keeps methodology behind a keyboard-accessible disclosure", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME));

    await user.click(screen.getByRole("button", { name: /^Volume\. Last 28 days/ }));

    const summary = screen.getByText("How STACK calculates this").closest("summary");
    expect(summary).not.toBeNull();
    expect(summary?.closest("details")).not.toHaveAttribute("open");
    summary?.focus();
    expect(summary).toHaveFocus();
    expect(summary?.tabIndex).toBe(0);
    await user.keyboard("{Enter}");
    expect(screen.getByText(/Both windows are the same length/)).toBeInTheDocument();
    expect(summary?.closest("details")).toHaveAttribute("open");
  });

  it("opens from the keyboard and closes back to the list", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME));

    const card = screen.getByRole("button", { name: /^Volume\. Last 28 days/ });
    card.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Volume");

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("reaches the run behind a long-run comparison, and comes back to it", async () => {
    const user = userEvent.setup();
    renderRuns(
      history({
        current: [8, 3.1],
        baseline: [8, 2],
      }),
    );

    await user.click(
      screen.getByRole("button", { name: /^Long runs\. Last 28 days/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Open the longest run of the last 28 days/ }),
    );
    // The run's own identity titles the sheet. This history row's source
    // stated no activity name, so what is left is what it verifiably was.
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run");

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Long runs");
  });

  it("states coverage beside a connected-metric comparison", async () => {
    const user = userEvent.setup();
    renderRuns(
      history({
        current: [10, 4],
        baseline: [10, 4],
        currentOptions: { trainingLoad: 60 },
        baselineOptions: { trainingLoad: 40 },
      }),
    );

    await user.click(screen.getByRole("button", { name: /^Workload\. Last 28 days/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Workload");
    expect(dialog).toHaveTextContent(
      /Training Load available for 10\/10 recent runs and 10\/10 prior runs/,
    );
    expect(dialog.querySelector(".signal-methodology")).not.toHaveAttribute("open");
    await user.click(screen.getByText("How STACK calculates this"));
    expect(dialog.querySelector(".signal-methodology")).toHaveAttribute("open");
    expect(dialog).toHaveTextContent(/does not turn it into a readiness or recovery figure/);
    expect(dialog.querySelectorAll(".signal-methodology__body > p")).toHaveLength(1);
    expect(dialog.textContent).not.toMatch(
      /readiness[:\s]+\d|recovery score|you are (over|under)trained/i,
    );
  });

  it("keeps plan context available and last", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME), [
      stackRun("planned", "2026-08-04", { workoutId: "workout-002" }),
    ]);

    await user.click(screen.getByRole("button", { name: "Show all signals" }));
    const allCards = signalCards();
    expect(allCards.at(-1)?.dataset.signal).toBe("plan-completion");
    await user.click(screen.getByRole("button", { name: /^Plan context\./ }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Plan context");
  });
});
