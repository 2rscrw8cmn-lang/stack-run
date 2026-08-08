import { describe, expect, it } from "vitest";
import { loadSeedPlan } from "../seed/loadSeedPlan";
import {
  blockedDates,
  findAvailabilityConflicts,
  proposeDateFor,
  shiftKinds,
  type AvailabilityCalendar,
} from "./availability";
import type { CalendarShift } from "./ics";
import { findWorkout, moveWorkout } from "./planEdit";
import type { RunLog } from "./types";

const plan = loadSeedPlan();

// Week 1 is Aug 3-9 2026: rest, easy (002), rest, easy (004), rest, easy (006),
// long (007). The rest days are Mon 3, Wed 5, Fri 7.
function shift(date: string, label = "MICU Day"): CalendarShift {
  return { date, label, startTime: "07:00", endTime: "19:00" };
}

function calendarOf(
  shifts: CalendarShift[],
  overrides: Partial<AvailabilityCalendar> = {},
): AvailabilityCalendar {
  return {
    name: "Partner shifts",
    importedAt: "2026-08-01T12:00:00.000Z",
    shifts,
    blockingLabels: ["MICU Day"],
    enabled: true,
    ...overrides,
  };
}

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
  };
}

describe("shiftKinds", () => {
  it("groups the calendar by shift, commonest first", () => {
    const calendar = calendarOf([
      shift("2026-08-04", "MICU Day"),
      shift("2026-08-06", "MICU Day"),
      shift("2026-08-08", "Clinic"),
    ]);

    expect(shiftKinds(calendar)).toEqual([
      {
        label: "MICU Day",
        days: 2,
        startTime: "07:00",
        endTime: "19:00",
        blocks: true,
      },
      {
        label: "Clinic",
        days: 1,
        startTime: "07:00",
        endTime: "19:00",
        blocks: false,
      },
    ]);
  });
});

describe("blockedDates", () => {
  it("blocks only the shifts the user marked", () => {
    const calendar = calendarOf([
      shift("2026-08-04", "MICU Day"),
      shift("2026-08-06", "Night"),
    ]);

    expect([...blockedDates(calendar).keys()]).toEqual(["2026-08-04"]);
  });

  it("names every shift responsible for a day", () => {
    const calendar = calendarOf(
      [shift("2026-08-04", "MICU Day"), shift("2026-08-04", "Clinic")],
      { blockingLabels: ["MICU Day", "Clinic"] },
    );

    expect(blockedDates(calendar).get("2026-08-04")).toEqual([
      "MICU Day",
      "Clinic",
    ]);
  });

  it("blocks nothing while the calendar is switched off", () => {
    const calendar = calendarOf([shift("2026-08-04")], { enabled: false });
    expect(blockedDates(calendar).size).toBe(0);
  });

  it("blocks nothing when no calendar has been imported", () => {
    expect(blockedDates(null).size).toBe(0);
  });
});

describe("proposeDateFor", () => {
  it("offers the nearest unblocked rest day in the same week", () => {
    const blocked = blockedDates(calendarOf([shift("2026-08-04")]));
    const workout = findWorkout(plan, "workout-002")!;

    // Tuesday's run: Monday and Wednesday are both rest and both one day away,
    // so the earlier one wins the tie.
    expect(proposeDateFor(plan, blocked, workout, "2026-08-01")).toBe(
      "2026-08-03",
    );
  });

  it("steps over a rest day that is blocked too", () => {
    const blocked = blockedDates(
      calendarOf([shift("2026-08-04"), shift("2026-08-03"), shift("2026-08-05")]),
    );
    const workout = findWorkout(plan, "workout-002")!;

    // Monday and Wednesday are blocked as well, so Friday is what is left.
    expect(proposeDateFor(plan, blocked, workout, "2026-08-01")).toBe(
      "2026-08-07",
    );
  });

  it("never proposes a day that has already gone", () => {
    const blocked = blockedDates(calendarOf([shift("2026-08-06")]));
    const workout = findWorkout(plan, "workout-004")!;

    // Thursday's run, with today already Thursday: Wednesday is out, Friday is
    // the only rest day left in the week.
    expect(proposeDateFor(plan, blocked, workout, "2026-08-06")).toBe(
      "2026-08-07",
    );
  });

  it("never proposes another run's day, which would only move the problem", () => {
    // Every rest day in week 1 is blocked, so only run days remain — and a
    // swap would put that run onto the blocked day instead.
    const blocked = blockedDates(
      calendarOf([
        shift("2026-08-03"),
        shift("2026-08-05"),
        shift("2026-08-07"),
        shift("2026-08-04"),
      ]),
    );
    const workout = findWorkout(plan, "workout-002")!;

    expect(proposeDateFor(plan, blocked, workout, "2026-08-01")).toBeNull();
  });

  it("stays inside the workout's own training week", () => {
    const blocked = blockedDates(
      calendarOf([
        shift("2026-08-03"),
        shift("2026-08-05"),
        shift("2026-08-07"),
        shift("2026-08-09"),
      ]),
    );
    const workout = findWorkout(plan, "workout-007")!;

    // Week 2 has rest days going spare, but the week is the training unit.
    expect(proposeDateFor(plan, blocked, workout, "2026-08-01")).toBeNull();
  });
});

describe("findAvailabilityConflicts", () => {
  it("finds scheduled runs that land on blocked days", () => {
    const calendar = calendarOf([shift("2026-08-04"), shift("2026-08-08")]);
    const conflicts = findAvailabilityConflicts(plan, calendar, [], "2026-08-01");

    expect(conflicts.map((conflict) => conflict.workout.id)).toEqual([
      "workout-002",
      "workout-006",
    ]);
    expect(conflicts[0].labels).toEqual(["MICU Day"]);
    expect(conflicts[0].proposedDate).toBe("2026-08-03");
  });

  it("ignores a blocked day the plan leaves as rest", () => {
    const calendar = calendarOf([shift("2026-08-03")]);
    expect(findAvailabilityConflicts(plan, calendar, [], "2026-08-01")).toEqual(
      [],
    );
  });

  it("ignores a run that has already been logged", () => {
    const calendar = calendarOf([shift("2026-08-04")]);
    const conflicts = findAvailabilityConflicts(
      plan,
      calendar,
      [runLogFor("workout-002")],
      "2026-08-01",
    );

    expect(conflicts).toEqual([]);
  });

  it("ignores days that have already passed", () => {
    const calendar = calendarOf([shift("2026-08-04")]);
    expect(
      findAvailabilityConflicts(plan, calendar, [], "2026-08-05"),
    ).toEqual([]);
  });

  it("never reports the race, which does not move", () => {
    const calendar = calendarOf([shift("2026-12-05")]);
    expect(
      findAvailabilityConflicts(plan, calendar, [], "2026-12-01"),
    ).toEqual([]);
  });

  it("reports a conflict it cannot solve rather than hiding it", () => {
    const calendar = calendarOf([
      shift("2026-08-03"),
      shift("2026-08-04"),
      shift("2026-08-05"),
      shift("2026-08-07"),
    ]);
    const conflicts = findAvailabilityConflicts(plan, calendar, [], "2026-08-01");

    expect(conflicts.map((conflict) => conflict.workout.id)).toEqual([
      "workout-002",
    ]);
    expect(conflicts[0].proposedDate).toBeNull();
  });

  it("is empty once the conflicting run has been moved", () => {
    const calendar = calendarOf([shift("2026-08-04")]);
    const moved = moveWorkout(plan, "workout-002", "2026-08-03");

    expect(findAvailabilityConflicts(moved, calendar, [], "2026-08-01")).toEqual(
      [],
    );
  });

  it("is empty while the calendar is switched off", () => {
    const calendar = calendarOf([shift("2026-08-04")], { enabled: false });
    expect(findAvailabilityConflicts(plan, calendar, [], "2026-08-01")).toEqual(
      [],
    );
  });
});
