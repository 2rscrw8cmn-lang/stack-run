import { describe, expect, it } from "vitest";
import { formatMiles } from "./distance";

describe("formatMiles", () => {
  it("keeps a typed distance exactly as it reads", () => {
    expect(formatMiles(5)).toBe("5");
    expect(formatMiles(6.2)).toBe("6.2");
    expect(formatMiles(13.11)).toBe("13.11");
  });

  it("stops a converted distance from printing its conversion", () => {
    expect(formatMiles(5000 / 1609.344)).toBe("3.11");
    expect(formatMiles(3.1068559611866697)).toBe("3.11");
  });
});
