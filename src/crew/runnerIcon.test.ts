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
  setRunnerIconPart,
  type RunnerIcon,
  type RunnerIconShape,
} from "./runnerIcon.js";

const icon: RunnerIcon = { head: 1, face: 3, body: 5, flair: 2, background: 3 };

describe("Runner icon codes", () => {
  it("round-trips every choice through the stored code", () => {
    expect(encodeRunnerIcon(icon)).toBe("R2-1.3.5.2.3");
    expect(decodeRunnerIcon(encodeRunnerIcon(icon))).toEqual(icon);
  });

  it("rejects anything that is not a runner icon code", () => {
    expect(decodeRunnerIcon(null)).toBeNull();
    expect(decodeRunnerIcon("")).toBeNull();
    expect(decodeRunnerIcon("R2-1.3.5.2")).toBeNull();
    expect(decodeRunnerIcon("R3-1.3.5.2.3")).toBeNull();
    expect(decodeRunnerIcon("R2-1.3.5.2.3.1")).toBeNull();
    expect(decodeRunnerIcon("E1-1.2-3.0-5.4-2.1")).toBeNull();
    expect(decodeRunnerIcon({ head: 1 })).toBeNull();
  });

  /**
   * The four-part code shipped before backdrops existed. Those runners keep
   * the four parts they chose and get the empty backdrop for the one they
   * never did — the alternative, picking a shape on their behalf, changes
   * what an already-saved icon means.
   */
  it("still decodes an icon saved before backdrops existed", () => {
    expect(decodeRunnerIcon("R1-1.3.5.2")).toEqual({
      head: 1,
      face: 3,
      body: 5,
      flair: 2,
      background: 0,
    });
  });

  /**
   * An icon saved against a later part library must still draw here rather
   * than throw, so an index this client does not have falls back to that
   * part's first option instead of failing the whole icon.
   */
  it("degrades an unknown index to a drawable one", () => {
    expect(decodeRunnerIcon("R2-99.99.99.99.99")).toEqual({
      head: 0,
      face: 0,
      body: 0,
      flair: 0,
      background: 0,
    });
  });

  it("clamps an out-of-range index on the way out too", () => {
    expect(
      encodeRunnerIcon({ head: 99, face: -1, body: 1.5, flair: 3, background: 2 }),
    ).toBe("R2-0.0.0.3.2");
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

  /** An icon nobody chose should not be wearing a bolt or standing on a badge. */
  it("leaves the chosen-looking parts empty until the runner picks them", () => {
    expect(runnerIconFromSeed("user-7").flair).toBe(0);
    expect(runnerIconFromSeed("user-7").background).toBe(0);
  });

  it("prefers a saved icon over the derived one, and falls back when absent", () => {
    expect(resolveRunnerIcon("R2-1.3.5.2.3", "user-1")).toEqual(icon);
    expect(resolveRunnerIcon(null, "user-1")).toEqual(runnerIconFromSeed("user-1"));
    expect(resolveRunnerIcon("not-an-icon", "user-1")).toEqual(runnerIconFromSeed("user-1"));
  });
});

describe("Editing a runner icon", () => {
  it("sets a part directly, which is what the option grid does", () => {
    expect(setRunnerIconPart(icon, "background", 5)).toEqual({ ...icon, background: 5 });
    expect(setRunnerIconPart(icon, "head", 4).head).toBe(4);
    // An index the library does not have is not a way to store one.
    expect(setRunnerIconPart(icon, "head", 99).head).toBe(0);
  });

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
    expect(sameRunnerIcon(icon, { ...icon, flair: 5 })).toBe(false);
    expect(sameRunnerIcon(icon, { ...icon, background: 0 })).toBe(false);
    // Out-of-range and clamped are the same saved icon.
    expect(
      sameRunnerIcon(
        { head: 99, face: 0, body: 0, flair: 0, background: 0 },
        { head: 0, face: 0, body: 0, flair: 0, background: 0 },
      ),
    ).toBe(true);
  });
});

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** The bounding box of a path, for the subset of commands this library draws. */
function boxOf(d: string): Box {
  const tokens = d.match(/[MLHVAZ]|-?\d*\.?\d+/gi) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  let index = 0;
  let command = "M";
  let x = 0;
  let y = 0;
  const next = (): number => Number(tokens[index++]);
  while (index < tokens.length) {
    if (/^[MLHVAZ]$/i.test(tokens[index])) {
      command = tokens[index].toUpperCase();
      index += 1;
      if (command === "Z") continue;
    }
    if (command === "H") {
      x = next();
    } else if (command === "V") {
      y = next();
    } else if (command === "A") {
      // rx ry rotation large-arc sweep x y. Every arc in this library is a
      // half sweep, so its center is the midpoint of the two endpoints and
      // the radii off that center bound it.
      const rx = next();
      const ry = next();
      index += 3;
      const fromX = x;
      const fromY = y;
      x = next();
      y = next();
      const centerX = (fromX + x) / 2;
      const centerY = (fromY + y) / 2;
      xs.push(centerX - rx, centerX + rx);
      ys.push(centerY - ry, centerY + ry);
    } else {
      x = next();
      y = next();
    }
    xs.push(x);
    ys.push(y);
  }
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
  };
}

function shapeBox(shape: RunnerIconShape): Box {
  const boxes = shape.plates.map(boxOf);
  return {
    minX: Math.min(...boxes.map((box) => box.minX)),
    maxX: Math.max(...boxes.map((box) => box.maxX)),
    minY: Math.min(...boxes.map((box) => box.minY)),
    maxY: Math.max(...boxes.map((box) => box.maxY)),
  };
}

/**
 * The library's landmarks, asserted as geometry rather than trusted by eye.
 *
 * Every part is drawn against fixed edges — the chassis runs x 30–70, the
 * face plate is exactly y 38–64, every body's first twelve units are the full
 * chassis width — and those edges are the whole reason one chest band lands
 * identically on six different bodies. A path nudged two units still looks
 * fine on its own, and is exactly the change that makes flair look pasted on.
 */
describe("The part library itself", () => {
  /**
   * Small on purpose. Six selectable options per part is the ceiling: past
   * that the options stop being distinguishable at the size Crew draws them,
   * and the editor stops fitting its whole library on one screen.
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
    const sideStripe = RUNNER_ICON_SHAPES.flair.findIndex(
      (shape) => shape.name === "Side Stripe",
    );
    expect(sideStripe).toBe(4);
    expect(RUNNER_ICON_SHAPES.flair[sideStripe].deprecated).toBe(true);
    expect(selectableRunnerIconIndices("flair")).not.toContain(sideStripe);

    // Still decodes, still draws, still means what it always meant.
    expect(decodeRunnerIcon("R2-0.0.0.4.0")).toEqual({
      head: 0,
      face: 0,
      body: 0,
      flair: 4,
      background: 0,
    });
    expect(RUNNER_ICON_SHAPES.flair[sideStripe].plates.length).toBeGreaterThan(0);
  });

  it("never lands a runner on a retired option by cycling", () => {
    const onSideStripe = { head: 0, face: 0, body: 0, flair: 4, background: 0 };
    expect(cycleRunnerIconPart(onSideStripe, "flair", 1).flair).toBe(5);
    expect(cycleRunnerIconPart(onSideStripe, "flair", -1).flair).toBe(3);
    // And Surprise Me never offers it either.
    let seed = 0;
    const random = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let attempt = 0; attempt < 200; attempt += 1) {
      expect(randomRunnerIcon(random).flair).not.toBe(4);
    }
  });

  it("gives every option a name and something to draw", () => {
    for (const part of RUNNER_ICON_PARTS) {
      for (const shape of RUNNER_ICON_SHAPES[part]) {
        expect(shape.name).toMatch(/\S/);
        // The two deliberately empty options: no flair, and no backdrop.
        if (shape.plates.length === 0) {
          expect(part === "flair" || part === "background").toBe(true);
          expect(shape.name).toBe("None");
        }
      }
    }
  });

  it("stacks head, face and body on the same chassis", () => {
    for (const shape of RUNNER_ICON_SHAPES.face) {
      // The one plate every face shares, and the edge flair attaches to.
      expect(shapeBox(shape)).toEqual({ minX: 30, maxX: 70, minY: 38, maxY: 64 });
    }
    for (const shape of RUNNER_ICON_SHAPES.head) {
      const box = shapeBox(shape);
      expect(box.maxY).toBe(34);
      expect(box.minX).toBeGreaterThanOrEqual(26);
      expect(box.maxX).toBeLessThanOrEqual(74);
    }
    for (const shape of RUNNER_ICON_SHAPES.body) {
      const box = shapeBox(shape);
      expect(box.minY).toBe(68);
      expect(box.maxY).toBeLessThanOrEqual(90);
      // Chassis width at the top, whatever the body does lower down: this is
      // what makes one chest band land identically on all six.
      expect(shape.plates[0].startsWith("M30 68 H70")).toBe(true);
    }
  });

  /**
   * Flair is either on the runner or off it, never in between. On it means
   * flush against a landmark edge; off it means clear of the chassis by real
   * space, so a spark reads as a spark beside the runner rather than as a
   * chip out of their shoulder.
   */
  it("either attaches flair to a landmark edge or gives it honest space", () => {
    const CHASSIS_LEFT = 30;
    const CHASSIS_RIGHT = 70;
    const GAP = 4;
    for (const index of selectableRunnerIconIndices("flair")) {
      const shape = RUNNER_ICON_SHAPES.flair[index];
      for (const plate of shape.plates) {
        const box = boxOf(plate);
        const attached =
          box.maxX === CHASSIS_LEFT ||
          box.minX === CHASSIS_RIGHT ||
          (box.minX === CHASSIS_LEFT && box.maxX === CHASSIS_RIGHT);
        const detached =
          box.minX >= CHASSIS_RIGHT + GAP || box.maxX <= CHASSIS_LEFT - GAP;
        expect(attached || detached, `${shape.name} floats halfway`).toBe(true);
      }
    }
  });

  /**
   * Nothing a runner can build may spill out of the box every crew surface
   * draws it in — including the widest head, the widest foot, and the flair
   * that hangs furthest off the shoulder.
   */
  it("keeps every option inside the icon's own box", () => {
    for (const part of RUNNER_ICON_PARTS) {
      for (const shape of RUNNER_ICON_SHAPES[part]) {
        if (shape.plates.length === 0) continue;
        const box = shapeBox(shape);
        expect(box.minX).toBeGreaterThanOrEqual(3);
        expect(box.minY).toBeGreaterThanOrEqual(3);
        expect(box.maxX).toBeLessThanOrEqual(97);
        expect(box.maxY).toBeLessThanOrEqual(97);
      }
    }
  });
});
