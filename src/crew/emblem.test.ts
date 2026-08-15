import { describe, expect, it } from "vitest";
import {
  CREW_EMBLEM_BACKGROUND_BOUNDS,
  CREW_EMBLEM_BACKGROUND_CLEAR_RADIUS,
  CREW_EMBLEM_CENTER,
  CREW_EMBLEM_COLORS,
  CREW_EMBLEM_DRAW_ORDER,
  CREW_EMBLEM_INK,
  CREW_EMBLEM_LAYERS,
  CREW_EMBLEM_MAIN_BOUNDS,
  CREW_EMBLEM_SECONDARY_RADIUS,
  CREW_EMBLEM_SHAPES,
  DEFAULT_CREW_EMBLEM,
  crewEmblemColorContrast,
  crewEmblemDrawing,
  crewEmblemShapeIndices,
  crewEmblemShapeName,
  crewEmblemSvgMarkup,
  decodeCrewEmblem,
  encodeCrewEmblem,
  randomCrewEmblem,
  readableCrewEmblemColorRecipes,
  resolveCrewEmblem,
  sameCrewEmblem,
  setCrewEmblemColor,
  setCrewEmblemShape,
  type CrewEmblem,
  type CrewEmblemLayer,
} from "./emblem";

const emblem: CrewEmblem = {
  main: { shape: 4, color: 2 },
  secondary: { shape: 7, color: 0 },
  background: { shape: 3, color: 5 },
};

interface Point {
  x: number;
  y: number;
}

/**
 * Every point a path actually visits — curves sampled along the curve rather
 * than at their control points, which sit well outside a circle they describe
 * and would fail a shape that is comfortably inside its budget.
 */
function pathPoints(d: string): Point[] {
  const points: Point[] = [];
  let cursor: Point = { x: 0, y: 0 };
  const to = (point: Point): void => {
    cursor = point;
    points.push(point);
  };
  const sample = (at: (t: number) => Point): void => {
    for (let step = 1; step <= 16; step += 1) points.push(at(step / 16));
    cursor = at(1);
  };

  for (const match of d.matchAll(/([MLHVQCZ])([^MLHVQCZ]*)/g)) {
    const values = (match[2].match(/-?\d*\.?\d+/g) ?? []).map(Number);
    switch (match[1]) {
      case "H":
        for (const value of values) to({ x: value, y: cursor.y });
        break;
      case "V":
        for (const value of values) to({ x: cursor.x, y: value });
        break;
      case "Q":
        for (let index = 0; index + 3 < values.length; index += 4) {
          const from = cursor;
          const control = { x: values[index], y: values[index + 1] };
          const end = { x: values[index + 2], y: values[index + 3] };
          sample((t) => {
            const inverse = 1 - t;
            return {
              x: inverse ** 2 * from.x + 2 * inverse * t * control.x + t ** 2 * end.x,
              y: inverse ** 2 * from.y + 2 * inverse * t * control.y + t ** 2 * end.y,
            };
          });
        }
        break;
      case "C":
        for (let index = 0; index + 5 < values.length; index += 6) {
          const from = cursor;
          const first = { x: values[index], y: values[index + 1] };
          const second = { x: values[index + 2], y: values[index + 3] };
          const end = { x: values[index + 4], y: values[index + 5] };
          sample((t) => {
            const inverse = 1 - t;
            return {
              x:
                inverse ** 3 * from.x +
                3 * inverse ** 2 * t * first.x +
                3 * inverse * t ** 2 * second.x +
                t ** 3 * end.x,
              y:
                inverse ** 3 * from.y +
                3 * inverse ** 2 * t * first.y +
                3 * inverse * t ** 2 * second.y +
                t ** 3 * end.y,
            };
          });
        }
        break;
      case "Z":
        break;
      default:
        for (let index = 0; index + 1 < values.length; index += 2) {
          to({ x: values[index], y: values[index + 1] });
        }
        break;
    }
  }
  return points;
}

function everyShape(layer: CrewEmblemLayer): readonly { name: string; d: string }[] {
  return CREW_EMBLEM_SHAPES[layer].filter((shape) => shape.d.length > 0);
}

describe("Crew emblem codes", () => {
  it("round-trips all three layers through the stored code", () => {
    expect(encodeCrewEmblem(emblem)).toBe("E2-4.2-7.0-3.5");
    expect(decodeCrewEmblem(encodeCrewEmblem(emblem))).toEqual(emblem);
  });

  it("rejects anything that is not a three-layer emblem code", () => {
    expect(decodeCrewEmblem(null)).toBeNull();
    expect(decodeCrewEmblem("")).toBeNull();
    expect(decodeCrewEmblem("E2-4.2-7.0")).toBeNull();
    expect(decodeCrewEmblem("E2-4.2-7.0-3.5-1.1")).toBeNull();
    expect(decodeCrewEmblem("E3-4.2-7.0-3.5")).toBeNull();
    expect(decodeCrewEmblem({ main: 1 })).toBeNull();
  });

  /**
   * The four-part library was replaced, not extended. Translating a retired
   * Crown into the nearest new mark would be inventing a decision the crew
   * never made, so an old code reads as unset and the crew designs again.
   */
  it("treats a retired four-part code as no emblem at all", () => {
    expect(decodeCrewEmblem("E1-1.2-3.0-5.4-2.1")).toBeNull();
    expect(resolveCrewEmblem("E1-1.2-3.0-5.4-2.1")).toEqual(DEFAULT_CREW_EMBLEM);
  });

  /**
   * A crew built on a later library must still render here rather than throw,
   * so an index this client does not have falls back to that layer's first
   * option — which for the two optional layers is `None`.
   */
  it("degrades a future unknown index to a drawable one", () => {
    expect(decodeCrewEmblem("E2-999.99-999.99-999.99")).toEqual({
      main: { shape: 0, color: 0 },
      secondary: { shape: 0, color: 0 },
      background: { shape: 0, color: 0 },
    });
    expect(() => crewEmblemDrawing(decodeCrewEmblem("E2-999.0-999.0-999.0")!)).not.toThrow();
  });

  it("prefers a saved emblem and falls back to the neutral default", () => {
    expect(resolveCrewEmblem("E2-4.2-7.0-3.5")).toEqual(emblem);
    expect(resolveCrewEmblem(null)).toEqual(DEFAULT_CREW_EMBLEM);
    expect(resolveCrewEmblem("nonsense")).toEqual(DEFAULT_CREW_EMBLEM);
    expect(sameCrewEmblem(resolveCrewEmblem(undefined), DEFAULT_CREW_EMBLEM)).toBe(true);
  });

  it("ships a default that is itself a valid saved emblem", () => {
    expect(decodeCrewEmblem(encodeCrewEmblem(DEFAULT_CREW_EMBLEM))).toEqual(DEFAULT_CREW_EMBLEM);
  });
});

describe("Crew emblem libraries", () => {
  it("offers enough of each layer for two crews not to collide by accident", () => {
    expect(CREW_EMBLEM_SHAPES.main.length).toBeGreaterThanOrEqual(24);
    expect(CREW_EMBLEM_SHAPES.secondary.length).toBeGreaterThanOrEqual(13);
    expect(CREW_EMBLEM_SHAPES.background.length).toBeGreaterThanOrEqual(11);
  });

  it("keeps None as the first option of both optional layers, and only those", () => {
    expect(CREW_EMBLEM_SHAPES.secondary[0]).toEqual({ name: "None", d: "" });
    expect(CREW_EMBLEM_SHAPES.background[0]).toEqual({ name: "None", d: "" });
    expect(CREW_EMBLEM_SHAPES.main.every((shape) => shape.d.length > 0)).toBe(true);
  });

  it("names every option uniquely within its layer", () => {
    for (const layer of CREW_EMBLEM_LAYERS) {
      const names = CREW_EMBLEM_SHAPES[layer].map((shape) => shape.name);
      expect(new Set(names).size).toBe(names.length);
      expect(names.every((name) => name.length > 0)).toBe(true);
    }
  });

  /** Half the main library is running and training, per the design brief. */
  it("carries a real running thread through the main marks", () => {
    const running = [
      "Stride",
      "Podium",
      "Tread",
      "Shoe",
      "Track",
      "Lanes",
      "Finish",
      "Checker",
      "Stopwatch",
      "Split",
      "Route",
      "Peak",
      "Pace",
      "Pulse",
    ];
    const names = CREW_EMBLEM_SHAPES.main.map((shape) => shape.name);
    for (const name of running) expect(names).toContain(name);
  });

  it("draws every main mark inside the main safe box", () => {
    for (const shape of everyShape("main")) {
      for (const point of pathPoints(shape.d)) {
        expect(point.x, `${shape.name} x`).toBeGreaterThanOrEqual(CREW_EMBLEM_MAIN_BOUNDS.min);
        expect(point.x, `${shape.name} x`).toBeLessThanOrEqual(CREW_EMBLEM_MAIN_BOUNDS.max);
        expect(point.y, `${shape.name} y`).toBeGreaterThanOrEqual(CREW_EMBLEM_MAIN_BOUNDS.min);
        expect(point.y, `${shape.name} y`).toBeLessThanOrEqual(CREW_EMBLEM_MAIN_BOUNDS.max);
      }
    }
  });

  /**
   * The containment contract in one assertion: a secondary piece never leaves
   * the disc every background silhouette is built to hold, so any Main +
   * Secondary pair composes with any field behind it.
   */
  it("keeps every secondary piece inside the shared clear radius", () => {
    expect(CREW_EMBLEM_SECONDARY_RADIUS).toBeLessThan(CREW_EMBLEM_BACKGROUND_CLEAR_RADIUS);
    for (const shape of everyShape("secondary")) {
      for (const point of pathPoints(shape.d)) {
        const radius = Math.hypot(point.x - CREW_EMBLEM_CENTER, point.y - CREW_EMBLEM_CENTER);
        expect(radius, `${shape.name} reach`).toBeLessThanOrEqual(CREW_EMBLEM_SECONDARY_RADIUS);
      }
    }
  });

  it("draws every background inside the view box", () => {
    for (const shape of everyShape("background")) {
      for (const point of pathPoints(shape.d)) {
        expect(point.x, `${shape.name} x`).toBeGreaterThanOrEqual(CREW_EMBLEM_BACKGROUND_BOUNDS.min);
        expect(point.x, `${shape.name} x`).toBeLessThanOrEqual(CREW_EMBLEM_BACKGROUND_BOUNDS.max);
        expect(point.y, `${shape.name} y`).toBeGreaterThanOrEqual(CREW_EMBLEM_BACKGROUND_BOUNDS.min);
        expect(point.y, `${shape.name} y`).toBeLessThanOrEqual(CREW_EMBLEM_BACKGROUND_BOUNDS.max);
      }
    }
  });

  /**
   * The invite share image rasterises these paths with a deliberately small
   * path grammar (`M/L/H/V/Q/C/Z`). A shape written with anything else — an
   * elliptical arc, say — would silently lose part of itself in the shared
   * preview while looking right inside STACK.
   */
  it("writes every shape in the grammar the invite renderer understands", () => {
    for (const layer of CREW_EMBLEM_LAYERS) {
      for (const shape of everyShape(layer)) {
        expect(shape.d, shape.name).toMatch(/^[MLHVQCZ0-9\s.,-]+$/);
      }
    }
  });
});

describe("Crew emblem drawing", () => {
  it("paints the field first and the mark last", () => {
    const parts = crewEmblemDrawing(emblem).map((operation) => operation.part);
    expect(parts.indexOf("background")).toBeLessThan(parts.indexOf("secondary"));
    expect(parts.indexOf("secondary")).toBeLessThan(parts.indexOf("main"));
    expect(CREW_EMBLEM_DRAW_ORDER).toEqual(["background", "secondary", "main"]);
  });

  /**
   * The drawing is the single description of a crew's mark: the React
   * component serialises it and the invite share image rasterises it, so a
   * shape or colour missing here would be missing from a shared link too.
   */
  it("describes the saved shape and colour of every layer", () => {
    const drawing = crewEmblemDrawing(emblem);
    for (const layer of CREW_EMBLEM_LAYERS) {
      const shape = CREW_EMBLEM_SHAPES[layer][emblem[layer].shape];
      const painted = drawing.filter(
        (operation) => operation.d === shape.d && operation.part === layer,
      );
      expect(painted.length, layer).toBeGreaterThan(0);
      expect(painted.some((op) => op.fill === CREW_EMBLEM_COLORS[emblem[layer].color].value)).toBe(
        true,
      );
    }
  });

  it("has nothing to draw for a layer set to None", () => {
    const bare = { ...emblem, secondary: { shape: 0, color: 1 }, background: { shape: 0, color: 1 } };
    const parts = crewEmblemDrawing(bare).map((operation) => operation.part);
    expect(parts).not.toContain("secondary");
    expect(parts).not.toContain("background");
    expect(parts).toContain("main");
  });

  it("marks a cut-out shape so its holes stay holes", () => {
    const target = CREW_EMBLEM_SHAPES.main.findIndex((shape) => shape.rule === "evenodd");
    const drawing = crewEmblemDrawing(setCrewEmblemShape(emblem, "main", target));
    expect(drawing.some((operation) => operation.fillRule === "evenodd")).toBe(true);
    expect(crewEmblemSvgMarkup(setCrewEmblemShape(emblem, "main", target))).toContain(
      'fill-rule="evenodd"',
    );
  });

  it("groups each layer so a builder tile can dim the ones it is not offering", () => {
    const markup = crewEmblemSvgMarkup(emblem);
    for (const layer of CREW_EMBLEM_LAYERS) {
      expect(markup).toContain(`<g class="crew-emblem__${layer}">`);
    }
    expect(markup).toContain(CREW_EMBLEM_SHAPES.main[emblem.main.shape].d);
    expect(markup).toContain(CREW_EMBLEM_INK);
  });
});

describe("Crew emblem editing", () => {
  it("changes one layer's shape and leaves the others alone", () => {
    const changed = setCrewEmblemShape(emblem, "secondary", 3);
    expect(changed.secondary).toEqual({ shape: 3, color: 0 });
    expect(changed.main).toEqual(emblem.main);
    expect(changed.background).toEqual(emblem.background);
  });

  it("changes one layer's colour and leaves the others alone", () => {
    const changed = setCrewEmblemColor(emblem, "background", 6);
    expect(changed.background).toEqual({ shape: 3, color: 6 });
    expect(changed.main).toEqual(emblem.main);
    expect(changed.secondary).toEqual(emblem.secondary);
  });

  it("refuses an out-of-range choice rather than storing one", () => {
    expect(setCrewEmblemShape(emblem, "main", 9999).main.shape).toBe(0);
    expect(setCrewEmblemColor(emblem, "main", -1).main.color).toBe(0);
  });

  it("offers every index of every layer to the builder", () => {
    for (const layer of CREW_EMBLEM_LAYERS) {
      expect(crewEmblemShapeIndices(layer)).toEqual(
        CREW_EMBLEM_SHAPES[layer].map((_, index) => index),
      );
    }
  });

  it("names every option, and names an unknown one without throwing", () => {
    expect(crewEmblemShapeName("secondary", 0)).toBe("None");
    expect(crewEmblemShapeName("main", 3)).toBe(CREW_EMBLEM_SHAPES.main[3].name);
    expect(crewEmblemShapeName("background", 999)).toBe(CREW_EMBLEM_SHAPES.background[0].name);
  });
});

describe("Surprise Me", () => {
  it("only ever produces a drawable emblem", () => {
    for (let index = 0; index < 200; index += 1) {
      const candidate = randomCrewEmblem();
      expect(decodeCrewEmblem(encodeCrewEmblem(candidate))).toEqual(candidate);
    }
  });

  it("survives a random source pinned at either extreme", () => {
    for (const value of [0, 0.999999]) {
      const candidate = randomCrewEmblem(() => value);
      expect(decodeCrewEmblem(encodeCrewEmblem(candidate))).toEqual(candidate);
    }
  });

  /**
   * A shuffle that can hand back a violet mark on a blue field is not a
   * feature. Colours come from the readable triples, so every random emblem
   * still separates its layers at the size Crew actually draws them.
   */
  it("never puts a mark on a field it cannot be read against", () => {
    for (let index = 0; index < 200; index += 1) {
      const candidate = randomCrewEmblem();
      expect(
        crewEmblemColorContrast(candidate.main.color, candidate.background.color),
      ).toBeGreaterThanOrEqual(1.6);
      expect(candidate.secondary.color).not.toBe(candidate.main.color);
      expect(candidate.secondary.color).not.toBe(candidate.background.color);
    }
  });

  it("has readable recipes to choose from at all", () => {
    const recipes = readableCrewEmblemColorRecipes();
    expect(recipes.length).toBeGreaterThan(20);
    expect(readableCrewEmblemColorRecipes()).toBe(recipes);
  });
});
