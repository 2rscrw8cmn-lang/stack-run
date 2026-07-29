import { describe, expect, it } from "vitest";
import { validateRunEntry } from "./runValidation";

describe("validateRunEntry", () => {
  it("accepts and normalizes documented values", () => {
    const result = validateRunEntry({ distance: "3.25", duration: "31:42", effort: "great", notes: "  strong finish  " });
    expect(result).toEqual({ valid: true, value: { distanceMiles: 3.25, durationSeconds: 1902, effort: "great", notes: "strong finish" } });
  });
  it("requires every run value and limits distance", () => {
    const result = validateRunEntry({ distance: "101", duration: "", effort: null, notes: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toMatchObject({ distance: expect.any(String), duration: expect.any(String), effort: expect.any(String) });
  });
  it("rejects excess distance precision and invalid duration", () => {
    const result = validateRunEntry({ distance: "2.123", duration: "1:60", effort: "solid", notes: "" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toMatchObject({ distance: expect.any(String), duration: expect.any(String) });
  });
});
