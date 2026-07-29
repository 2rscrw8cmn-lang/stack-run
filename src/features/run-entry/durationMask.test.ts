import { describe, expect, it } from "vitest";
import { parseDurationInput } from "../../domain/duration";
import { maskDurationInput } from "./durationMask";

describe("maskDurationInput", () => {
  it("fills digits from the seconds up", () => {
    expect(maskDurationInput("")).toBe("");
    expect(maskDurationInput("3")).toBe("0:03");
    expect(maskDurationInput("31")).toBe("0:31");
    expect(maskDurationInput("314")).toBe("3:14");
    expect(maskDurationInput("3142")).toBe("31:42");
    expect(maskDurationInput("10530")).toBe("1:05:30");
    expect(maskDurationInput("240000")).toBe("24:00:00");
  });

  it("ignores everything that is not a digit", () => {
    expect(maskDurationInput("31:42")).toBe("31:42");
    expect(maskDurationInput("31m 42s")).toBe("31:42");
    expect(maskDurationInput("::")).toBe("");
  });

  it("keeps growing when its own output gets another digit", () => {
    // What the field actually does keystroke by keystroke for 31:42.
    expect(maskDurationInput("3")).toBe("0:03");
    expect(maskDurationInput("0:03" + "1")).toBe("0:31");
    expect(maskDurationInput("0:31" + "4")).toBe("3:14");
    expect(maskDurationInput("3:14" + "2")).toBe("31:42");
  });

  it("drops leading zeros", () => {
    expect(maskDurationInput("01:05:30")).toBe("1:05:30");
    expect(maskDurationInput("0")).toBe("");
    expect(maskDurationInput("00:00")).toBe("");
  });

  it("stops accepting digits past H:MM:SS", () => {
    expect(maskDurationInput("1234567")).toBe("12:34:56");
  });

  it("produces values the domain parser accepts", () => {
    expect(parseDurationInput(maskDurationInput("31"))).toBe(31);
    expect(parseDurationInput(maskDurationInput("3142"))).toBe(1902);
    expect(parseDurationInput(maskDurationInput("10530"))).toBe(3930);
    expect(parseDurationInput(maskDurationInput("240000"))).toBe(86_400);
  });
});
