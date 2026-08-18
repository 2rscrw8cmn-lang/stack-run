import { describe, expect, it } from "vitest";
import { validateRunEntry, type RunEntryValues } from "./runValidation";

const TODAY = "2026-08-06";

function errorsFor(values: Partial<RunEntryValues>) {
  const result = validateRunEntry(
    {
      date: TODAY,
      activityType: "easy",
      distance: "3.2",
      duration: "31:42",
      effort: "solid",
      notes: "",
      ...values,
    },
    TODAY,
  );
  expect(result.valid).toBe(false);
  return result.valid ? {} : result.errors;
}

describe("validateRunEntry", () => {
  it("accepts and normalizes documented values", () => {
    const result = validateRunEntry(
      {
        date: "2026-08-04",
        activityType: "intervals",
        distance: "3.25",
        duration: "31:42",
        effort: "great",
        notes: "  strong finish  ",
      },
      TODAY,
    );

    expect(result).toEqual({
      valid: true,
      value: {
        completedDate: "2026-08-04",
        activityType: "intervals",
        distanceMiles: 3.25,
        durationSeconds: 1902,
        effort: "great",
        notes: "strong finish",
      },
    });
  });

  it("requires every run value", () => {
    const result = validateRunEntry(
      {
        date: "",
        activityType: "easy",
        distance: "",
        duration: "",
        effort: null,
        notes: "",
      },
      TODAY,
    );

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual({
        date: "Enter the date you ran.",
        distance: "Enter your distance.",
        duration: "Enter your duration.",
        effort: "Choose how the run felt.",
      });
    }
  });

  it("accepts a run dated today or earlier", () => {
    expect(validateRunEntry(
      {
        date: TODAY,
        activityType: "easy",
        distance: "3",
        duration: "30:00",
        effort: "solid",
        notes: "",
      },
      TODAY,
    ).valid).toBe(true);
  });

  it("refuses to log a run that has not happened yet", () => {
    expect(errorsFor({ date: "2026-08-07" }).date).toBe(
      "A run cannot be logged in the future.",
    );
  });

  it("rejects a date that is not a local calendar date", () => {
    expect(errorsFor({ date: "08/04/2026" }).date).toBe(
      "Enter a date like 2026-08-04.",
    );
  });

  it("bounds distance and its precision", () => {
    expect(errorsFor({ distance: "101" }).distance).toMatch(/no more than 100/);
    expect(errorsFor({ distance: "0" }).distance).toMatch(/greater than 0/);
    expect(errorsFor({ distance: "2.123" }).distance).toMatch(/two decimal/);
  });

  it("lets Cross Training leave distance blank or zero", () => {
    const blank = validateRunEntry(
      {
        date: TODAY,
        activityType: "cross",
        distance: "",
        duration: "45:00",
        effort: "solid",
        notes: "",
      },
      TODAY,
    );
    expect(blank).toEqual({
      valid: true,
      value: {
        completedDate: TODAY,
        activityType: "cross",
        distanceMiles: 0,
        durationSeconds: 2700,
        effort: "solid",
        notes: "",
      },
    });

    const zero = validateRunEntry(
      {
        date: TODAY,
        activityType: "cross",
        distance: "0",
        duration: "45:00",
        effort: "solid",
        notes: "",
      },
      TODAY,
    );
    expect(zero.valid).toBe(true);
  });

  it("still bounds Cross Training distance when one is entered", () => {
    expect(
      errorsFor({ activityType: "cross", distance: "101" }).distance,
    ).toMatch(/no more than 100/);
    expect(
      errorsFor({ activityType: "cross", distance: "-1" }).distance,
    ).toMatch(/0 or more/);
    expect(
      errorsFor({ activityType: "cross", distance: "2.123" }).distance,
    ).toMatch(/two decimal/);
  });

  it("explains why a duration was rejected", () => {
    expect(errorsFor({ duration: "1:60" }).duration).toBe(
      "Minutes and seconds must be under 60.",
    );
    expect(errorsFor({ duration: "25:00:00" }).duration).toBe(
      "Duration must be between 0:01 and 24:00:00.",
    );
    expect(errorsFor({ duration: "nope" }).duration).toBe(
      "Enter a duration like 31:42.",
    );
  });

  it("limits notes to 120 characters", () => {
    expect(errorsFor({ notes: "x".repeat(121) }).notes).toMatch(/120/);
  });
});
