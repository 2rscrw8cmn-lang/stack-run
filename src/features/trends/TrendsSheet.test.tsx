import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import type { RunActivityType, RunLog } from "../../domain/types";
import { TrendsSheet } from "./TrendsSheet";

const plan = loadSeedPlan();
const week1 = plan.weeks[0];

function run(completedDate: string, options: { activityType?: RunActivityType; distanceMiles?: number; durationSeconds?: number; workoutId?: string | null; averageHeartRate?: number } = {}): RunLog {
  const { activityType = "easy", distanceMiles = 3, durationSeconds = 1800, workoutId = null, averageHeartRate } = options;
  return {
    id: `run-${completedDate}-${activityType}-${distanceMiles}-${durationSeconds}`,
    workoutId, completedDate, activityType, distanceMiles, durationSeconds,
    effort: "solid", notes: "", createdAt: `${completedDate}T12:00:00Z`, updatedAt: `${completedDate}T12:00:00Z`,
    source: "manual", externalSource: null,
    importedMetrics: averageHeartRate ? { averageHeartRate } : null,
  };
}

function renderTrends(runLogs: RunLog[], today = "2026-08-09") {
  return render(<TrendsSheet plan={plan} runLogs={runLogs} today={today} isOpen onClose={() => undefined} />);
}

/** The table view each chart carries, found by its caption. */
function table(name: RegExp) {
  return within(screen.getByRole("table", { name }));
}

describe("Training Trends", () => {
  it("gives every chart the same numbers as a table", () => {
    renderTrends([
      run(week1.startDate, { distanceMiles: 3 }),
      run("2026-08-08", { activityType: "long", distanceMiles: 6 }),
    ]);

    const mileage = table(/Weekly mileage/);
    expect(mileage.getByRole("rowheader", { name: "Week 1" })).toBeInTheDocument();
    expect(mileage.getByRole("cell", { name: "9 mi" })).toBeInTheDocument();
    expect(mileage.getByRole("columnheader", { name: "Miles" })).toBeInTheDocument();
  });

  it("says what each chart covers, in weeks and in dates", () => {
    renderTrends([run(week1.startDate)]);
    expect(screen.getByRole("heading", { name: "Weekly mileage" })).toBeInTheDocument();
    // Every chart states its own period rather than leaving it to be inferred.
    expect(screen.getAllByText(/Aug 3/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/scheduled runs? due so far/).length).toBeGreaterThan(0);
  });

  it("keeps extra runs out of consistency while counting their miles", () => {
    const scheduled = week1.workouts.find((workout) => workout.type !== "rest")!;
    renderTrends([
      run(scheduled.date, { workoutId: scheduled.id, distanceMiles: 3 }),
      run(scheduled.date, { distanceMiles: 4 }),
    ], scheduled.date);

    expect(table(/Weekly mileage/).getByRole("cell", { name: "7 mi" })).toBeInTheDocument();
    const consistency = table(/Consistency/);
    expect(consistency.getByRole("rowheader", { name: "Completed" })).toBeInTheDocument();
    expect(consistency.getByRole("cell", { name: "100%" })).toBeInTheDocument();
    expect(screen.getByText(/Extra runs are not counted here/)).toBeInTheDocument();
  });

  it("does not claim a direction from three Easy runs", () => {
    renderTrends([run("2026-08-03"), run("2026-08-05"), run("2026-08-07")]);

    expect(screen.getByText(/too few to say which way this is going/)).toBeInTheDocument();
    expect(screen.getByText(/1 more Easy run will start it/)).toBeInTheDocument();
    expect(screen.queryByText(/getting quicker|getting slower/)).not.toBeInTheDocument();
  });

  it("draws Easy pace once there are four of them", () => {
    renderTrends([
      run("2026-08-03", { durationSeconds: 1800 }),
      run("2026-08-05", { durationSeconds: 1800 }),
      run("2026-08-07", { durationSeconds: 1620 }),
      run("2026-08-09", { durationSeconds: 1620 }),
    ]);

    const pace = table(/Easy pace/);
    expect(pace.getAllByRole("cell", { name: "10:00 /mi" })).toHaveLength(2);
    expect(pace.getAllByRole("cell", { name: "9:00 /mi" })).toHaveLength(2);
    expect(screen.getByText(/getting quicker/)).toBeInTheDocument();
  });

  it("counts only the Easy runs that carried heart rate, and says so", () => {
    renderTrends([
      run("2026-08-03", { averageHeartRate: 150 }),
      run("2026-08-05"),
      run("2026-08-07", { averageHeartRate: 148 }),
      run("2026-08-09", { averageHeartRate: 149 }),
    ]);

    expect(screen.getByText(/3 of 4 Easy runs carried heart rate/)).toBeInTheDocument();
    expect(screen.getByText(/left out rather than counted as zero/)).toBeInTheDocument();
    expect(table(/Easy heart rate/).queryByRole("cell", { name: "0 bpm" })).not.toBeInTheDocument();
  });

  it("says what would make a trend rather than drawing an empty one", () => {
    renderTrends([]);

    expect(screen.getByText("No miles recorded yet. Every run counts here, scheduled or not.")).toBeInTheDocument();
    expect(screen.getByText(/No long runs recorded yet/)).toBeInTheDocument();
    expect(screen.getByText(/No Easy runs recorded yet\. 4 of them make a trend\./)).toBeInTheDocument();
    expect(screen.getByText(/No Easy run has carried heart rate yet/)).toBeInTheDocument();
  });

  it("never predicts a race result", () => {
    renderTrends([run("2026-08-03"), run("2026-08-05"), run("2026-08-07"), run("2026-08-09")]);
    expect(screen.queryByText(/predict|projected|finish time|readiness|score/i)).not.toBeInTheDocument();
  });
});
