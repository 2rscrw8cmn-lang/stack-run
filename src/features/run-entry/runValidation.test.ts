import { describe, expect, it } from "vitest";
import { validateRunEntry, type RunEntryValues } from "./runValidation";

function errorsFor(values: Partial<RunEntryValues>) {
  const result = validateRunEntry({
    distance: "3.2",
    duration: "31:42",
    effort: "solid",
    notes: "",
    ...values,
  });
  expect(result.valid).toBe(false);
  return result.valid ? {} : result.errors;
}

describe("validateRunEntry", () => {
  it("accepts and normalizes documented values", () => {
    const result = validateRunEntry({
      distance: "3.25",
      duration: "31:42",
      effort: "great",
      notes: "  strong finish  ",
    });

    expect(result).toEqual({
      valid: true,
      value: {
        distanceMiles: 3.25,
        durationSeconds: 1902,
        effort: "great",
        notes: "strong finish",
      },
    });
  });

  it("requires every run value", () => {
    const result = validateRunEntry({
      distance: "",
      duration: "",
      effort: null,
      notes: "",
    });

    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toEqual({
        distance: "Enter your distance.",
        duration: "Enter your duration.",
        effort: "Choose how the run felt.",
      });
    }
  });

  it("bounds distance and its precision", () => {
    expect(errorsFor({ distance: "101" }).distance).toMatch(/no more than 100/);
    expect(errorsFor({ distance: "0" }).distance).toMatch(/greater than 0/);
    expect(errorsFor({ distance: "2.123" }).distance).toMatch(/two decimal/);
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
