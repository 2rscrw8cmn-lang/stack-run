import { describe, expect, it } from "vitest";
import { defaultSelectedIndex, defaultSelectedKey } from "./chartDefaultSelection";

describe("Chart default selection", () => {
  it("opens on the latest completed period with something in it", () => {
    expect(
      defaultSelectedIndex([
        { value: 20 },
        { value: 26 },
        { value: 0, isPartial: true },
      ]),
    ).toBe(1);
  });

  it("does not open on a current period that has no running in it yet", () => {
    // The exact review finding: a Monday-morning chart opened on `0 mi`.
    expect(defaultSelectedIndex([{ value: 31 }, { value: 0, isPartial: true }])).toBe(0);
    expect(defaultSelectedIndex([{ value: 31 }, { value: 4, isPartial: true }])).toBe(0);
  });

  it("skips completed periods with no recorded value", () => {
    expect(defaultSelectedIndex([{ value: 12 }, { value: null }, { value: 0 }])).toBe(0);
  });

  it("falls back to the latest period with a value, then to the last period", () => {
    expect(defaultSelectedIndex([{ value: 8, isPartial: true }])).toBe(0);
    expect(defaultSelectedIndex([{ value: 0 }, { value: null }])).toBe(1);
    expect(defaultSelectedIndex([])).toBe(-1);
  });

  it("answers in keys for the components that select by key", () => {
    expect(
      defaultSelectedKey([
        { key: "w1", value: 10 },
        { key: "w2", value: 0, isPartial: true },
      ]),
    ).toBe("w1");
    expect(defaultSelectedKey([])).toBeNull();
  });
});
