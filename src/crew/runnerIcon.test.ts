import { describe, expect, it } from "vitest";
import {
  RUNNER_ICON_PARTS,
  RUNNER_ICON_SHAPES,
  cycleRunnerIconPart,
  decodeRunnerIcon,
  encodeRunnerIcon,
  randomRunnerIcon,
  resolveRunnerIcon,
  runnerIconFromSeed,
  runnerIconPartName,
  sameRunnerIcon,
  selectableRunnerIconIndices,
  type RunnerIcon,
} from "./runnerIcon";

const icon: RunnerIcon = { head: 1, face: 3, body: 5, extra: 2 };

describe("Runner icon codes", () => {
  it("round-trips every choice through the stored code", () => {
    expect(encodeRunnerIcon(icon)).toBe("R1-1.3.5.2");
    expect(decodeRunnerIcon(encodeRunnerIcon(icon))).toEqual(icon);
  });

  it("rejects anything that is not a runner icon code", () => {
    expect(decodeRunnerIcon(null)).toBeNull();
    expect(decodeRunnerIcon("")).toBeNull();
    expect(decodeRunnerIcon("R1-1.3.5")).toBeNull();
    expect(decodeRunnerIcon("R2-1.3.5.2")).toBeNull();
    expect(decodeRunnerIcon("R1-1.3.5.2.1")).toBeNull();
    expect(decodeRunnerIcon("E1-1.2-3.0-5.4-2.1")).toBeNull();
    expect(decodeRunnerIcon({ head: 1 })).toBeNull();
  });

  /**
   * An icon saved against a later part library must still draw here rather
   * than throw, so an index this client does not have falls back to that
   * part's first option instead of failing the whole icon.
   */
  it("degrades an unknown index to a drawable one", () => {
    expect(decodeRunnerIcon("R1-99.99.99.99")).toEqual({
      head: 0,
      face: 0,
      body: 0,
      extra: 0,
    });
  });

  it("clamps an out-of-range index on the way out too", () => {
    expect(encodeRunnerIcon({ head: 99, face: -1, body: 1.5, extra: 3 })).toBe("R1-0.0.0.3");
  });
});

describe("Default runner icons", () => {
  it("gives an account with no saved icon the same mark on every device", () => {
    const first = runnerIconFromSeed("user-1");
    expect(runnerIconFromSeed("user-1")).toEqual(first);
    expect(runnerIconFromSeed("user-2")).not.toEqual(first);
  });

  it("draws every derived part from the real library", () => {
    for (const seed of ["user-1", "user-2", "user-3", "user-4", "user-5"]) {
      const derived = runnerIconFromSeed(seed);
      for (const part of RUNNER_ICON_PARTS) {
        expect(derived[part]).toBeGreaterThanOrEqual(0);
        expect(derived[part]).toBeLessThan(RUNNER_ICON_SHAPES[part].length);
      }
    }
  });

  /** An icon nobody chose should not also be wearing a bolt. */
  it("leaves the extra empty until the runner picks one", () => {
    expect(runnerIconFromSeed("user-7").extra).toBe(0);
  });

  it("prefers a saved icon over the derived one, and falls back when absent", () => {
    expect(resolveRunnerIcon("R1-1.3.5.2", "user-1")).toEqual(icon);
    expect(resolveRunnerIcon(null, "user-1")).toEqual(runnerIconFromSeed("user-1"));
    expect(resolveRunnerIcon("not-an-icon", "user-1")).toEqual(runnerIconFromSeed("user-1"));
  });
});

describe("Editing a runner icon", () => {
  it("steps a part forward and backward, wrapping at both ends", () => {
    const heads = RUNNER_ICON_SHAPES.head.length;
    expect(cycleRunnerIconPart(icon, "head", 1).head).toBe(2);
    expect(cycleRunnerIconPart({ ...icon, head: heads - 1 }, "head", 1).head).toBe(0);
    expect(cycleRunnerIconPart({ ...icon, head: 0 }, "head", -1).head).toBe(heads - 1);
  });

  it("changes only the part being cycled", () => {
    const next = cycleRunnerIconPart(icon, "body", 1);
    expect(next).toEqual({ ...icon, body: 0 });
  });

  it("names every option in every part", () => {
    for (const part of RUNNER_ICON_PARTS) {
      RUNNER_ICON_SHAPES[part].forEach((shape, index) => {
        expect(runnerIconPartName(part, index)).toBe(shape.name);
      });
      expect(runnerIconPartName(part, 999)).toBe(RUNNER_ICON_SHAPES[part][0].name);
    }
  });

  it("only ever surprises a runner with a drawable icon", () => {
    let seed = 0;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const random_icon = randomRunnerIcon(random);
      expect(decodeRunnerIcon(encodeRunnerIcon(random_icon))).toEqual(random_icon);
    }
  });

  it("compares icons by what they encode to", () => {
    expect(sameRunnerIcon(icon, { ...icon })).toBe(true);
    expect(sameRunnerIcon(icon, { ...icon, extra: 4 })).toBe(false);
    // Out-of-range and clamped are the same saved icon.
    expect(sameRunnerIcon({ head: 99, face: 0, body: 0, extra: 0 }, { head: 0, face: 0, body: 0, extra: 0 })).toBe(true);
  });
});

describe("The part library itself", () => {
  /**
   * Small on purpose. Six selectable options per part is the ceiling: past
   * that the options stop being distinguishable at the size Crew draws them,
   * and the editor stops being four compact rows.
   */
  it("keeps every part small enough to stay distinct at crew size", () => {
    for (const part of RUNNER_ICON_PARTS) {
      expect(selectableRunnerIconIndices(part)).toHaveLength(6);
    }
  });

  /**
   * A retired option must keep its index and keep drawing. Anything else
   * silently changes what an already-saved icon means.
   */
  it("keeps retired options addressable but out of the editor", () => {
    const sideStripe = RUNNER_ICON_SHAPES.extra.findIndex(
      (shape) => shape.name === "Side Stripe",
    );
    expect(sideStripe).toBe(4);
    expect(RUNNER_ICON_SHAPES.extra[sideStripe].deprecated).toBe(true);
    expect(selectableRunnerIconIndices("extra")).not.toContain(sideStripe);

    // Still decodes, still draws, still means what it always meant.
    expect(decodeRunnerIcon("R1-0.0.0.4")).toEqual({ head: 0, face: 0, body: 0, extra: 4 });
    expect(RUNNER_ICON_SHAPES.extra[sideStripe].plates.length).toBeGreaterThan(0);
  });

  it("never lands a runner on a retired option by cycling", () => {
    const onSideStripe = { head: 0, face: 0, body: 0, extra: 4 };
    expect(cycleRunnerIconPart(onSideStripe, "extra", 1).extra).toBe(5);
    expect(cycleRunnerIconPart(onSideStripe, "extra", -1).extra).toBe(3);
    // And Surprise Me never offers it either.
    let seed = 0;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(randomRunnerIcon(random).extra).not.toBe(4);
    }
  });

  it("gives every option a name and something to draw", () => {
    for (const part of RUNNER_ICON_PARTS) {
      for (const shape of RUNNER_ICON_SHAPES[part]) {
        expect(shape.name).toMatch(/\S/);
        // "None" is the one deliberately empty option, and only for Extra.
        if (shape.plates.length === 0) {
          expect(part).toBe("extra");
          expect(shape.name).toBe("None");
        }
      }
    }
  });
});
