import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { BottomNav } from "../../components/shared/BottomNav";
import type { AvailabilityCalendar } from "../../domain/availability";
import type { RunLog } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { OpenSettings } from "../../test/OpenSettings";

const plan = loadSeedPlan();

function runLogFor(workoutId: string): RunLog {
  return {
    id: `run-${workoutId}`,
    workoutId,
    completedDate: "2026-08-04",
    activityType: "easy",
    distanceMiles: 2,
    durationSeconds: 1200,
    effort: "solid",
    notes: "",
    createdAt: "2026-08-04T12:00:00.000Z",
    updatedAt: "2026-08-04T12:00:00.000Z",
    source: "manual",
    externalSource: null,
    importedMetrics: null,
  };
}

const calendar: AvailabilityCalendar = {
  name: "Partner shifts",
  importedAt: "2026-08-01T12:00:00.000Z",
  shifts: [
    { date: "2026-08-04", label: "MICU Day", startTime: null, endTime: null },
    { date: "2026-08-08", label: "MICU Day", startTime: null, endTime: null },
  ],
  blockingLabels: ["MICU Day"],
  enabled: true,
};

function renderSettings(props: Partial<Parameters<typeof OpenSettings>[0]> = {}) {
  const user = userEvent.setup();
  const utils = render(
    <OpenSettings plan={plan} runLogs={[]} today="2026-08-06" {...props} />,
  );
  return { user, ...utils };
}

describe("the settings list", () => {
  it("says what each setting is currently set to without being opened", () => {
    renderSettings({
      runDays: [1, 3, 5],
      availability: calendar,
      isConnected: false,
    });

    expect(
      screen.getByRole("button", { name: /^Race OUC Half Marathon/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Run Days Mon, Wed, Fri" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "Availability Partner shifts · 2 blocked days",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Intervals.icu Not connected" }),
    ).toBeInTheDocument();
  });

  it("falls back to the shape the plan already has when no run days are set", () => {
    renderSettings();

    expect(
      screen.getByRole("button", { name: /Run Days Tue, Thu, Sat, Sun/ }),
    ).toBeInTheDocument();
  });

  it("says a calendar is off rather than counting days it is not blocking", () => {
    renderSettings({ availability: { ...calendar, enabled: false } });

    expect(
      screen.getByRole("button", { name: "Availability Partner shifts · off" }),
    ).toBeInTheDocument();
  });

  it("hands Run Data off to the shell, which also opens it from Today", async () => {
    const onOpenRunData = vi.fn();
    const { user } = renderSettings({ onOpenRunData });

    await user.click(screen.getByRole("button", { name: /^Intervals\.icu/ }));

    expect(onOpenRunData).toHaveBeenCalledTimes(1);
  });

  it("labels an Intervals connection as device-local", () => {
    renderSettings({ isConnected: true });
    expect(
      screen.getByRole("button", {
        name: "Intervals.icu Connected on this device · no sync yet",
      }),
    ).toBeInTheDocument();
  });

  it("offers the app tour as a quiet replay action", async () => {
    const onReplayTour = vi.fn();
    const { user } = renderSettings({ onReplayTour });

    await user.click(screen.getByRole("button", { name: /^App Tour/ }));
    expect(onReplayTour).toHaveBeenCalledTimes(1);
  });
});

describe("moving between settings and the sheet it opens", () => {
  it("shows one sheet at a time, and comes back here when one is dismissed", async () => {
    const { user } = renderSettings();

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));
    // The settings list is gone: its rows are not still underneath.
    expect(
      screen.queryByRole("button", { name: /^Availability/ }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(
      screen.getByRole("button", { name: /^Availability/ }),
    ).toBeInTheDocument();
  });

  it("leaves settings behind once a change has been applied", async () => {
    const onSaveRunDays = vi.fn();
    const { user } = renderSettings({ onSaveRunDays });

    await user.click(screen.getByRole("button", { name: /^Run Days/ }));
    await user.click(screen.getByRole("button", { name: "Sunday" }));
    await user.click(screen.getByRole("button", { name: /Move \d+ Runs/ }));

    expect(onSaveRunDays).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog", { name: "Settings" })).not.toBeInTheDocument();
  });
});

describe("resetting the plan", () => {
  it("needs two deliberate steps", async () => {
    const onResetPlan = vi.fn();
    const { user } = renderSettings({
      runLogs: [runLogFor("workout-002")],
      onResetPlan,
    });

    await user.click(screen.getByRole("button", { name: /^Reset Plan/ }));
    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("1 recorded run")).toBeInTheDocument();

    // The first press only arms it.
    await user.click(within(sheet).getByRole("button", { name: "Reset Plan" }));
    expect(onResetPlan).not.toHaveBeenCalled();

    await user.click(
      within(sheet).getByRole("button", { name: "Yes, Erase Everything" }),
    );
    expect(onResetPlan).toHaveBeenCalledTimes(1);
  });

  it("can be backed out of, back to settings", async () => {
    const onResetPlan = vi.fn();
    const { user } = renderSettings({ onResetPlan });

    await user.click(screen.getByRole("button", { name: /^Reset Plan/ }));
    await user.click(screen.getByRole("button", { name: "Keep My Data" }));

    expect(onResetPlan).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: /^Reset Plan Erases/ }),
    ).toBeInTheDocument();
  });
});

describe("the bottom bar", () => {
  it("is four equal destinations, in order, and no longer carries Settings", async () => {
    const onTabChange = vi.fn();
    const user = userEvent.setup();
    render(<BottomNav activeTab="runs" onTabChange={onTabChange} />);

    expect(
      screen.getAllByRole("button").map((tab) => tab.textContent),
    ).toEqual(["Today", "Build", "Runs", "Plan"]);
    // Settings is a gear in the header now: it configures the app rather than
    // being one of the places the app can be.
    expect(
      screen.queryByRole("button", { name: "Settings" }),
    ).not.toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Runs" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("button", { name: "Plan" })).not.toHaveAttribute(
      "aria-current",
    );

    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(onTabChange).toHaveBeenCalledWith("plan");
  });
});
