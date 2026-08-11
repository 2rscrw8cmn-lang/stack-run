import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { AvailabilityCalendar } from "../../domain/availability";
import { CalendarFetchError } from "../../domain/calendarSource";
import { findWorkout } from "../../domain/planEdit";
import type { TrainingPlan } from "../../domain/types";
import { loadSeedPlan } from "../../seed/loadSeedPlan";
import { OpenSettings } from "../../test/OpenSettings";
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

/** A stand-in for the network, so these tests never touch it. */
function stubFetch(result: string | Error) {
  return vi.fn(async () => {
    if (result instanceof Error) throw result;
    return result;
  });
}

/**
 * Importing a calendar is a setting and lives in Settings; what the imported
 * days do to the schedule is Plan's, and still lives there. Two surfaces, two
 * helpers.
 */
function renderPlan(props: Partial<Parameters<typeof OpenSettings>[0]> = {}) {
  const onSaveAvailability = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <OpenSettings
      plan={plan}
      runLogs={[]}
      today="2026-08-01"
      onSaveAvailability={onSaveAvailability}
      {...props}
    />,
  );
  return { onSaveAvailability, user, ...utils };
}

function renderSchedule(props: Partial<Parameters<typeof PlanScreen>[0]> = {}) {
  const onEditPlan = vi.fn();
  const user = userEvent.setup();
  const utils = render(
    <PlanScreen
      plan={plan}
      runLogs={[]}
      today="2026-08-01"
      onEditPlan={onEditPlan}
      {...props}
    />,
  );
  return { onEditPlan, user, ...utils };
}

describe("importing a calendar", () => {
  it("reads a pasted calendar and lists its shifts to choose from", async () => {
    const { user, onSaveAvailability } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.type(screen.getByLabelText(/Calendar link/), ICS);
    await user.click(screen.getByRole("button", { name: "Import" }));

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
  }, 15_000);

  it("explains a file it cannot read instead of failing quietly", async () => {
    const { user, onSaveAvailability } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.type(screen.getByLabelText(/Calendar link/), "just some text");
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(screen.getByText(/does not look like a calendar/)).toBeInTheDocument();
    expect(onSaveAvailability).not.toHaveBeenCalled();
  });

  it("takes a downloaded file whatever the phone called it", async () => {
    // A calendar saved on a phone often has no extension and no type. An
    // accept list greys exactly that file out in the picker, which breaks the
    // fallback for the person who has already been let down once.
    const { user, onSaveAvailability } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    const picker = screen.getByLabelText(/choose a downloaded file/);
    expect(picker).not.toHaveAttribute("accept");

    await user.upload(picker, new File([ICS], "text", { type: "" }));

    expect(await screen.findByText(/2 days imported/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.shifts).toHaveLength(2);
    // "text" is not a name worth keeping.
    expect(saved.name).toBe("Imported calendar");
    expect(saved.sourceUrl).toBeNull();
  });

  it("follows a chosen file that turns out to hold only the link", async () => {
    // What "download the calendar" actually produces on a phone as often as
    // not: a 68-byte file containing the subscription URL.
    const fetchIcs = stubFetch(ICS);
    const { user, onSaveAvailability } = renderPlan({ fetchIcs });

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.upload(
      screen.getByLabelText(/choose a downloaded file/),
      new File(["https://app.example.com/ical?key=abc\n"], "text", { type: "" }),
    );

    expect(fetchIcs).toHaveBeenCalledWith("https://app.example.com/ical?key=abc");
    expect(await screen.findByText(/2 days imported/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    // And it is remembered as a link, so refreshing stays one tap.
    expect(saved.sourceUrl).toBe("https://app.example.com/ical?key=abc");
    expect(saved.name).toBe("app.example.com");
  });

  it("names a chosen file's calendar after the file", async () => {
    const { user, onSaveAvailability } = renderPlan();

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.upload(
      screen.getByLabelText(/choose a downloaded file/),
      new File([ICS], "Sarah shifts.ics", { type: "text/calendar" }),
    );

    expect(await screen.findByText(/2 days imported/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.name).toBe("Sarah shifts");
  });

  it("fetches a pasted subscription link", async () => {
    const fetchIcs = stubFetch(ICS);
    const { user, onSaveAvailability } = renderPlan({ fetchIcs });

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.type(
      screen.getByLabelText(/Calendar link/),
      "https://app.example.com/ical?key=abc",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(fetchIcs).toHaveBeenCalledWith("https://app.example.com/ical?key=abc");
    expect(await screen.findByText(/2 days imported/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.sourceUrl).toBe("https://app.example.com/ical?key=abc");
    expect(saved.name).toBe("app.example.com");
  });

  it("turns a webcal link into the request it really is", async () => {
    const fetchIcs = stubFetch(ICS);
    const { user } = renderPlan({ fetchIcs });

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.type(
      screen.getByLabelText(/Calendar link/),
      "webcal://example.com/x.ics",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(fetchIcs).toHaveBeenCalledWith("https://example.com/x.ics");
  });

  it("explains a link the browser is not allowed to read", async () => {
    const fetchIcs = stubFetch(
      new CalendarFetchError(
        "Could not reach that link. Either the calendar provider does not allow apps to read it directly, or the connection failed. Download the .ics file and choose it below instead.",
      ),
    );
    const { user, onSaveAvailability } = renderPlan({ fetchIcs });

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.type(
      screen.getByLabelText(/Calendar link/),
      "https://app.example.com/ical?key=abc",
    );
    await user.click(screen.getByRole("button", { name: "Import" }));

    expect(
      await screen.findByText(/does not allow apps to read it directly/),
    ).toBeInTheDocument();
    // The fallback that always works is named in the same breath.
    expect(screen.getByText(/choose it below/)).toBeInTheDocument();
    expect(onSaveAvailability).not.toHaveBeenCalled();
  });

  it("refreshes from a remembered link, keeping the shifts already chosen", async () => {
    const fetchIcs = stubFetch(ICS);
    const { user, onSaveAvailability } = renderPlan({
      fetchIcs,
      availability: calendarOf({
        sourceUrl: "https://app.example.com/ical?key=abc",
      }),
    });

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    expect(
      screen.getByText("https://app.example.com/ical?key=abc"),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Refresh" }));
    expect(fetchIcs).toHaveBeenCalledWith("https://app.example.com/ical?key=abc");

    await user.click(await screen.findByRole("button", { name: "Save" }));
    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.blockingLabels).toEqual(["MICU Day"]);
  });

  it("forgets a link without discarding the shifts", async () => {
    const { user, onSaveAvailability } = renderPlan({
      availability: calendarOf({
        sourceUrl: "https://app.example.com/ical?key=abc",
      }),
    });

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.click(screen.getByRole("button", { name: "Forget Link" }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    const saved = onSaveAvailability.mock.calls[0][0] as AvailabilityCalendar;
    expect(saved.sourceUrl).toBeNull();
    expect(saved.shifts).toHaveLength(2);
  });

  it("can be switched off without losing the import", async () => {
    const { user, onSaveAvailability } = renderPlan({
      availability: calendarOf(),
    });

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
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

    await user.click(screen.getByRole("button", { name: /^Availability/ }));
    await user.click(screen.getByRole("button", { name: "Remove Calendar" }));

    expect(onSaveAvailability).toHaveBeenCalledWith(null);
    confirm.mockRestore();
  });
});

describe("blocked days on the schedule", () => {
  it("marks a blocked run day, and shows the hours rather than the shift", () => {
    renderSchedule({
      availability: calendarOf({
        shifts: [
          { date: "2026-08-04", label: "CCM ORMC APP Day 1R", startTime: "06:00", endTime: "18:00" },
        ],
        blockingLabels: ["CCM ORMC APP Day 1R"],
      }),
    });

    // The roster's own shorthand belongs in the availability sheet, where
    // choosing it is the task. Here the useful fact is the hours.
    expect(screen.getByText("Blocked 6 AM – 6 PM")).toBeInTheDocument();
    expect(screen.queryByText(/CCM ORMC APP/)).not.toBeInTheDocument();
    // A screen reader still hears which shift it was.
    expect(
      screen.getByRole("button", {
        name: /Tuesday, August 4.*blocked 6 am – 6 pm by CCM ORMC APP Day 1R/i,
      }),
    ).toBeInTheDocument();
  });

  it("says all day when the shift has no hours", () => {
    renderSchedule({ availability: calendarOf() });

    expect(screen.getByText("Blocked all day")).toBeInTheDocument();
    // Night Float was not marked as blocking, so Saturday is an ordinary day.
    expect(
      screen.queryByRole("button", { name: /Saturday, August 8.*blocked/ }),
    ).not.toBeInTheDocument();
  });

  it("leaves rest days unmarked: nothing is owed, so nothing is in the way", () => {
    renderSchedule({
      availability: calendarOf({
        // Aug 3 and Aug 5 are rest days in week 1; Aug 4 asks for a run.
        shifts: [
          { date: "2026-08-03", label: "MICU Day", startTime: null, endTime: null },
          { date: "2026-08-05", label: "MICU Day", startTime: null, endTime: null },
        ],
      }),
    });

    expect(screen.queryByText(/^Blocked/)).not.toBeInTheDocument();
    expect(screen.queryByText(/lands on a blocked day/)).not.toBeInTheDocument();
  });

  it("marks nothing while the calendar is switched off", () => {
    renderSchedule({ availability: calendarOf({ enabled: false }) });

    expect(
      screen.queryByRole("button", { name: /blocked by/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/lands on a blocked day/)).not.toBeInTheDocument();
  });
});

describe("reviewing blocked days", () => {
  it("proposes a move and applies only the ones accepted", async () => {
    const { user, onEditPlan } = renderSchedule({ availability: calendarOf() });

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
    const { user } = renderSchedule({
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
    const { user } = renderSchedule({
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
    renderSchedule({
      availability: calendarOf({
        shifts: [
          // Monday Aug 3 is already a rest day, so nothing has to move.
          { date: "2026-08-03", label: "Admin", startTime: null, endTime: null },
        ],
        blockingLabels: ["Admin"],
      }),
    });

    expect(screen.queryByText(/lands on a blocked day/)).not.toBeInTheDocument();
    // And the rest day itself stays quiet about it.
    expect(screen.queryByText(/^Blocked/)).not.toBeInTheDocument();
  });
});
