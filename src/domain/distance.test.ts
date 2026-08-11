import { describe, expect, it } from "vitest";
import { formatCompactMiles, formatMiles, formatMilesBuilt } from "./distance";

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

describe("formatCompactMiles", () => {
  it("fits a distance onto a brick without inventing precision", () => {
    expect(formatCompactMiles(5)).toBe("5");
    expect(formatCompactMiles(3.2)).toBe("3.2");
    expect(formatCompactMiles(10.25)).toBe("10.3");
    expect(formatCompactMiles(13.11)).toBe("13.1");
  });

  it("drops a converted distance to the same one decimal", () => {
    expect(formatCompactMiles(3.1068559611866697)).toBe("3.1");
  });
});

describe("formatMilesBuilt", () => {
  it("always formats aggregate Build mileage to one decimal place", () => {
    expect(formatMilesBuilt(11.34)).toBe("11.3");
    expect(formatMilesBuilt(5)).toBe("5.0");
  });
});
