import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { IntervalsCandidate } from "../../connected/intervals";
import type { RunLog } from "../../domain/types";
import { createInitialAppState } from "../../storage/migrations";
import { RunDataSheet } from "./RunDataSheet";

const state = createInitialAppState();
const workouts = state.plan.weeks.flatMap((week) => week.workouts);
const firstRun = workouts.find((workout) => workout.type !== "rest")!;
/** Five days past the run, so it is eligible but never a suggestion. */
const farLongRun = workouts.find((workout) => workout.type === "long")!;
const restDay = workouts.find((workout) => workout.type === "rest")!;

function runLog(overrides: Partial<RunLog>): RunLog {
  return { id: "other", workoutId: null, completedDate: firstRun.date, activityType: "easy", distanceMiles: 3, durationSeconds: 1500, effort: "solid", notes: "", createdAt: "now", updatedAt: "now", source: "manual", externalSource: null, importedMetrics: null, ...overrides };
}
const matchOptions = () =>
  within(screen.getByLabelText("Match")).getAllByRole("option").map((option) => option.textContent ?? "");

const candidate: IntervalsCandidate = {
  externalId: "i1",
  sourceType: "Run",
  completedDate: firstRun.date,
  distanceMiles: 3.11,
  durationSeconds: 1500,
  sourceUpdatedAt: null,
  metrics: { averageHeartRate: 152 },
  inferredActivityType: "easy",
};

function renderSheet(props: Partial<Parameters<typeof RunDataSheet>[0]> = {}) {
  const onImport = vi.fn();
  const onSettle = vi.fn();
  const onIgnore = vi.fn();
  const onSync = vi.fn();
  const onFindOlderRuns = vi.fn<() => Promise<number | null>>(async () => 0);
  const user = userEvent.setup();
  render(
    <RunDataSheet
      isOpen
      onClose={vi.fn()}
      state={state}
      initialToken="token"
      candidates={[candidate]}
      isSyncing={false}
      syncError={null}
      onSync={onSync}
      onFindOlderRuns={onFindOlderRuns}
      onSettle={onSettle}
      onConnect={vi.fn()}
      onForget={vi.fn()}
      onImport={onImport}
      onAttach={vi.fn()}
      onIgnore={onIgnore}
      onClearIgnored={vi.fn()}
      {...props}
    />,
  );
  return { user, onImport, onSettle, onIgnore, onSync, onFindOlderRuns };
}

describe("RunDataSheet", () => {
  it("opens on the run Today handed it, already matched to its workout", () => {
    renderSheet({ initialReview: { candidate, asExtra: false } });

    expect(screen.getByText("Review synced run")).toBeInTheDocument();
    expect(screen.getByLabelText("Match")).toHaveValue(firstRun.id);
    expect(screen.getByLabelText("Match")).toHaveClass("stack-select__control");
    expect(screen.getByRole("button", { name: "Confirm Match" })).toBeInTheDocument();
  });

  it("respects a run Today sent through as an extra", () => {
    renderSheet({ initialReview: { candidate, asExtra: true } });

    expect(screen.getByLabelText("Match")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "Easy" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("button", { name: "Add as Extra Run" })).toBeInTheDocument();
  });

  it("defaults an unmatched Cross Training import to Cross Training, not Easy", () => {
    const hiitCandidate: IntervalsCandidate = {
      ...candidate,
      externalId: "i-hiit",
      sourceType: "HighIntensityIntervalTraining",
      distanceMiles: 0,
      inferredActivityType: "cross",
    };
    renderSheet({ initialReview: { candidate: hiitCandidate, asExtra: true } });

    expect(screen.getByRole("radio", { name: "Cross Training" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
  });

  it("lets an extra imported run use the shared STACK activity picker", async () => {
    const { user, onImport } = renderSheet({
      initialReview: { candidate, asExtra: true },
    });

    await user.click(screen.getByRole("radio", { name: "Long Run" }));
    await user.click(screen.getByRole("button", { name: "Add as Extra Run" }));

    expect(onImport).toHaveBeenCalledWith(candidate, null, "long", "solid", "");
    expect(
      screen.queryByRole("combobox", { name: "STACK activity type" }),
    ).not.toBeInTheDocument();
  });

  it("imports the run and says what it earned", async () => {
    const { user, onImport, onSettle } = renderSheet({ initialReview: { candidate, asExtra: false } });

    await user.click(screen.getByRole("button", { name: "Confirm Match" }));

    expect(onImport).toHaveBeenCalledWith(candidate, firstRun.id, firstRun.type, "solid", "");
    // The candidate leaves the shared list, so Today stops offering it too.
    expect(onSettle).toHaveBeenCalledWith("i1");
    expect(screen.getByRole("status")).toHaveTextContent(/You earned/);
  });

  it("shows a sync failure where the user asked for the sync", () => {
    renderSheet({ syncError: "Intervals.icu could not be reached." });
    expect(screen.getByRole("alert")).toHaveTextContent("Intervals.icu could not be reached.");
  });

  it("says so plainly when a sync found nothing", () => {
    renderSheet({ candidates: [] });
    expect(screen.getByText("No runs are waiting to be reviewed.")).toBeInTheDocument();
  });

  it("can look further back for runs an older release lost, and says what it found", async () => {
    const { user, onFindOlderRuns } = renderSheet();

    await user.click(screen.getByRole("button", { name: "Find Older Runs" }));
    expect(onFindOlderRuns).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("status")).toHaveTextContent("No additional runs found.");

    onFindOlderRuns.mockResolvedValueOnce(2);
    await user.click(screen.getByRole("button", { name: "Find Older Runs" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Older runs checked.");
  });

  it("stays quiet about a failed older-runs read, which the sync error already covers", async () => {
    const { user, onFindOlderRuns } = renderSheet({ syncError: "Run Data could not be reached." });
    onFindOlderRuns.mockResolvedValueOnce(null);

    await user.click(screen.getByRole("button", { name: "Find Older Runs" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Run Data could not be reached.");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

/**
 * Issue #40. The ±2-day heuristic decides what STACK proposes; it used to
 * decide what the user was allowed to say, which is a different question. A
 * plan moves — a long run gets done midweek, history gets imported after the
 * plan was built — and the workout that run really was has to be reachable.
 */
describe("RunDataSheet manual match list", () => {
  it("still defaults to the suggested workout", () => {
    renderSheet({ initialReview: { candidate, asExtra: false } });
    expect(screen.getByLabelText("Match")).toHaveValue(firstRun.id);
  });

  it("offers every unmatched non-rest workout, grouped and never twice", () => {
    renderSheet({ initialReview: { candidate, asExtra: false } });
    const options = matchOptions();

    expect(options[0]).toBe("Add as Extra Run");
    expect(options).toContain(`${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(`${farLongRun.date}T00:00:00`))} — ${farLongRun.title}`);
    expect(options).toEqual([...new Set(options)]);
    expect(options.some((label) => label.includes("Rest"))).toBe(false);
    expect(screen.getByRole("group", { name: "Suggested" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Other plan runs" })).toBeInTheDocument();
    // The suggestion is offered once, in the group that explains why.
    expect(within(screen.getByRole("group", { name: "Suggested" })).getAllByRole("option").map((option) => option.getAttribute("value"))).toContain(firstRun.id);
    expect(within(screen.getByRole("group", { name: "Other plan runs" })).getAllByRole("option").map((option) => option.getAttribute("value"))).not.toContain(firstRun.id);
  });

  it("never offers a rest day or a workout another run already satisfies", () => {
    renderSheet({
      initialReview: { candidate, asExtra: false },
      state: { ...state, runLogs: [runLog({ workoutId: farLongRun.id })] },
    });
    const values = within(screen.getByLabelText("Match")).getAllByRole("option").map((option) => option.getAttribute("value"));

    expect(values).not.toContain(farLongRun.id);
    expect(values).not.toContain(restDay.id);
    expect(values).toContain(firstRun.id);
  });

  it("matches a run to a workout well outside the suggestion window", async () => {
    const { user, onImport } = renderSheet({ initialReview: { candidate, asExtra: false } });

    await user.selectOptions(screen.getByLabelText("Match"), farLongRun.id);

    // The plan link changes and the activity type follows the workout; when
    // the run happened does not, because that is not a matter of opinion.
    expect(screen.getByText(/Actual date .*planned date/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Confirm Match" }));
    expect(onImport).toHaveBeenCalledWith(candidate, farLongRun.id, "long", "solid", "");
    expect(onImport.mock.calls[0][0].completedDate).toBe(firstRun.date);
  });

  it("keeps Add as Extra Run available whatever the plan offers", async () => {
    const { user, onImport } = renderSheet({ initialReview: { candidate, asExtra: false } });

    await user.selectOptions(screen.getByLabelText("Match"), "");
    expect(screen.getByRole("radio", { name: "Easy" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("button", { name: "Add as Extra Run" }));
    expect(onImport).toHaveBeenCalledWith(candidate, null, "easy", "solid", "");
  });
});
