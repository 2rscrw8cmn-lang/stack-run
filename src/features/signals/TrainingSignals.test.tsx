import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { addDaysToLocalDate } from "../../domain/dates";
import { historicalRun, stackRun } from "../../history/runnerFixtures";
import { unifiedRunnerHistory } from "../../history/runnerRun";
import type { HistoricalActivity } from "../../history/historicalActivity";
import type { RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { RunsScreen } from "../runs/RunsScreen";

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
  return [...document.querySelectorAll<HTMLElement>(".signal-card")];
}

function cardOrder() {
  return signalCards().map((card) => card.dataset.signal);
}

const RISING_VOLUME: HistorySpec = {
  current: [8, 3.1],
  baseline: [8, 2.45],
};

describe("Training Signals cards", () => {
  it("leads with the sentence and evidence, and states the shared window once", () => {
    renderRuns(history(RISING_VOLUME));

    const volume = screen.getByRole("button", { name: /^Volume is building/ });
    expect(volume).toHaveAccessibleName(
      "Volume is building. 24.8 mi in the last 28 days, up from 19.6 mi in the 28 before. Last 28d vs prior 28d. Open Volume detail.",
    );
    expect(volume).toHaveTextContent("Volume is building");
    expect(volume).toHaveTextContent("24.8 mi in the last 28 days");
    expect(volume).not.toHaveTextContent("Last 28d vs prior 28d");
    expect(screen.getByText("Last 28 days vs prior 28 days")).toBeInTheDocument();
  });

  it("stays under the Run History rather than moving to the top of Runs", () => {
    renderRuns(history(RISING_VOLUME));

    const sections = [...document.querySelectorAll(".section__title")].map(
      (title) => title.textContent,
    );
    expect(sections).toEqual(["Recent Volume", "Run History", "Training Signals"]);
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
      "plan-completion",
    ]);
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
  it("opens the working behind a card, with both windows' exact dates", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME));

    await user.click(screen.getByRole("button", { name: /^Volume is building/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Volume");
    expect(dialog).toHaveTextContent("Jul 19 — Aug 15");
    expect(dialog).toHaveTextContent("Jun 21 — Jul 18");
    expect(dialog).toHaveTextContent("24.8 mi");
    expect(dialog).toHaveTextContent("19.6 mi");
    expect(dialog).toHaveTextContent("+5.2 mi");
  });

  it("explains what the signal means rather than asking to be trusted", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME));

    await user.click(screen.getByRole("button", { name: /^Volume is building/ }));

    expect(screen.getByText(/Both windows are the same length/)).toBeInTheDocument();
  });

  it("opens from the keyboard and closes back to the list", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME));

    const card = screen.getByRole("button", { name: /^Volume is building/ });
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
      screen.getByRole("button", { name: /^Longest runs are getting longer/ }),
    );
    await user.click(
      screen.getByRole("button", { name: /Open the longest run of the last 28 days/ }),
    );
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Run Detail");

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

    await user.click(screen.getByRole("button", { name: /workload is higher/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAccessibleName("Workload");
    expect(dialog).toHaveTextContent(
      /Training Load available for 10\/10 recent runs and 10\/10 prior runs/,
    );
    expect(dialog).toHaveTextContent(
      /does not turn it into a readiness, recovery or fatigue reading/,
    );
    expect(dialog.textContent).not.toMatch(
      /readiness[:\s]+\d|recovery score|you are (over|under)trained/i,
    );
  });

  it("keeps plan context available and last", async () => {
    const user = userEvent.setup();
    renderRuns(history(RISING_VOLUME), [
      stackRun("planned", "2026-08-04", { workoutId: "workout-002" }),
    ]);

    expect(cardOrder().at(-1)).toBe("plan-completion");
    await user.click(screen.getByRole("button", { name: /planned runs recorded/ }));
    expect(screen.getByRole("dialog")).toHaveAccessibleName("Plan context");
  });
});
