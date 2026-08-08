import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AvailabilityCalendar } from "../../domain/availability";
import { findWorkout } from "../../domain/planEdit";
import type { TrainingPlan } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { PlanScreen } from "../plan/PlanScreen";

const plan = loadSeedPlan();

// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest, easy (006),
// long (007).
const ICS = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "SUMMARY:MICU Day",
  "DTSTART;VALUE=DATE:20260804",
  "DTEND;VALUE=DATE:20260805",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "SUMMARY:Night Float",
  "DTSTART;VALUE=DATE:20260808",
  "DTEND;VALUE=DATE:20260809",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

function calendarOf(
  overrides: Partial<AvailabilityCalendar> = {},
): AvailabilityCalendar {
  return {
    name: "Partner shifts",
    importedAt: "2026-08-01T12:00:00.000Z",
    shifts: [
      { date: "2026-08-04", label: "MICU Day", startTime: null, endTime: null },
      { date: "2026-08-08", label: "Night Float", startTime: null, endTime: null },
    ],
    blockingLabels: ["MICU Day"],
    enabled: true,
    ...overrides,
  };
}

function renderPlan(props: Partial<Parameters<typeof PlanScreen>[0]> = {}) {
  const onSaveAvailability = vi.fn();
  const onEditPlan = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <PlanScreen
      plan={plan}
      runLogs={[]}
      today="2026-08-01"
      onEditPlan={onEditPlan}
      onSaveAvailability={onSaveAvailability}
      {...props}
    />,
  );
  return { onSaveAvailability, onEditPlan, user, ...utils };
}

describe("importing a calendar", () => {
  it("reads a pasted calendar and lists its shifts to choose from", async () => {
    const { user, onSaveAvailability } = renderPlan();

    await user.click(screen.getByRole("button", { name: "Availability" }));
    await user.type(screen.getByLabelText(/Paste calendar/), ICS);
    await user.click(
      screen.getByRole("button", { name: "Import Pasted Calendar" }),
    );

    expect(screen.getByText(/2 days imported/)).toBeInTheDocument();
    const shifts = screen.getByRole("button", { name: /MICU Day/ });
    expect(shifts).toHaveAttribute("aria-pressed", "false");

    // Nothing blocks anything until the user says which shifts do.
    await user.click(shifts);
    expect(screen.getByRole("button", { name: /MICU Day/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.shifts).toHaveLength(2);
    expect(saved.blockingLabels).toEqual(["MICU Day"]);
    expect(saved.enabled).toBe(true);
  });

  it("explains a file it cannot read instead of failing quietly", async () => {
    const { user, onSaveAvailability } = renderPlan();

    await user.click(screen.getByRole("button", { name: "Availability" }));
    await user.type(screen.getByLabelText(/Paste calendar/), "just some text");
    await user.click(
      screen.getByRole("button", { name: "Import Pasted Calendar" }),
    );

    expect(screen.getByText(/does not look like a calendar/)).toBeInTheDocument();
    expect(onSaveAvailability).not.toHaveBeenCalled();
  });

  it("can be switched off without losing the import", async () => {
    const { user, onSaveAvailability } = renderPlan({
      availability: calendarOf(),
    });

    await user.click(screen.getByRole("button", { name: "Availability" }));
    await user.click(screen.getByLabelText("Use this calendar"));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.enabled).toBe(false);
    expect(saved.shifts).toHaveLength(2);
  });

  it("removes the calendar after confirming", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    const { user, onSaveAvailability } = renderPlan({
      availability: calendarOf(),
    });

    await user.click(screen.getByRole("button", { name: "Availability" }));
    await user.click(screen.getByRole("button", { name: "Remove Calendar" }));

    expect(onSaveAvailability).toHaveBeenCalledWith(null);
    confirm.mockRestore();
  });
});

describe("blocked days on the schedule", () => {
  it("marks a blocked day on its row and names the shift", () => {
    renderPlan({ availability: calendarOf() });

    expect(
      screen.getByRole("button", { name: /Tuesday, August 4.*blocked by MICU Day/ }),
    ).toBeInTheDocument();
    // Night Float was not marked as blocking, so Saturday is an ordinary day.
    expect(
      screen.queryByRole("button", { name: /Saturday, August 8.*blocked/ }),
    ).not.toBeInTheDocument();
  });

  it("marks nothing while the calendar is switched off", () => {
    renderPlan({ availability: calendarOf({ enabled: false }) });

    expect(
      screen.queryByRole("button", { name: /blocked by/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/lands on a blocked day/)).not.toBeInTheDocument();
  });
});

describe("reviewing blocked days", () => {
  it("proposes a move and applies only the ones accepted", async () => {
    const { user, onEditPlan } = renderPlan({ availability: calendarOf() });

    await user.click(screen.getByText("1 run lands on a blocked day"));

    const sheet = screen.getByRole("dialog");
    expect(within(sheet).getByText("2 Miles")).toBeInTheDocument();
    expect(within(sheet).getByText(/MICU Day/)).toBeInTheDocument();

    // Monday and Wednesday are both rest and both a day away; the earlier wins.
    await user.click(
      within(sheet).getByRole("button", { name: "Move to Monday, Aug 3" }),
    );

    const edited = onEditPlan.mock.calls[0][0] as TrainingPlan;
    expect(findWorkout(edited, "workout-002")!.date).toBe("2026-08-03");
  });

  it("keeps the review open so several conflicts can be worked through", async () => {
    const { user } = renderPlan({
      availability: calendarOf({ blockingLabels: ["MICU Day", "Night Float"] }),
    });

    await user.click(screen.getByText("2 runs land on a blocked day"));
    const sheet = screen.getByRole("dialog");
    await user.click(
      within(sheet).getByRole("button", { name: "Move to Monday, Aug 3" }),
    );

    // The sheet is still up, with the other conflict in it.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("says so plainly when a week has no free day left", async () => {
    const { user } = renderPlan({
      availability: calendarOf({
        shifts: [
          // Every rest day in week 1, plus the day of the run itself.
          { date: "2026-08-03", label: "MICU Day", startTime: null, endTime: null },
          { date: "2026-08-04", label: "MICU Day", startTime: null, endTime: null },
          { date: "2026-08-05", label: "MICU Day", startTime: null, endTime: null },
          { date: "2026-08-07", label: "MICU Day", startTime: null, endTime: null },
        ],
      }),
    });

    await user.click(screen.getByText("1 run lands on a blocked day"));
    expect(
      screen.getByText(/No free day left in this week/),
    ).toBeInTheDocument();
  });

  it("offers no banner when the blocked days are all rest days anyway", () => {
    renderPlan({
      availability: calendarOf({
        shifts: [
          // Monday Aug 3 is already a rest day, so nothing has to move.
          { date: "2026-08-03", label: "Admin", startTime: null, endTime: null },
        ],
        blockingLabels: ["Admin"],
      }),
    });

    expect(screen.queryByText(/lands on a blocked day/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Monday, August 3.*blocked by Admin/ }),
    ).toBeInTheDocument();
  });
});
