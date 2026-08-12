import { describe, expect, it } from "vitest";
import {
  CREW_EMBLEM_COLORS,
  CREW_EMBLEM_FRAMES,
  CREW_EMBLEM_PRESETS,
  CREW_EMBLEM_SHAPES,
  crewEmblemFromSeed,
  cycleEmblemShape,
  decodeCrewEmblem,
  encodeCrewEmblem,
  randomCrewEmblem,
  resolveCrewEmblem,
  sameCrewEmblem,
  setEmblemColor,
  shapeName,
  type CrewEmblem,
} from "./emblem";

const emblem: CrewEmblem = {
  top: { shape: 1, color: 2 },
  middle: { shape: 3, color: 0 },
  bottom: { shape: 5, color: 4 },
  frame: { shape: 2, color: 1 },
};

describe("Crew emblem codes", () => {
  it("round-trips every choice through the stored code", () => {
    expect(encodeCrewEmblem(emblem)).toBe("E1-1.2-3.0-5.4-2.1");
    expect(decodeCrewEmblem(encodeCrewEmblem(emblem))).toEqual(emblem);
  });

  it("rejects anything that is not an emblem code", () => {
    expect(decodeCrewEmblem(null)).toBeNull();
    expect(decodeCrewEmblem("")).toBeNull();
    expect(decodeCrewEmblem("E1-1.2-3.0-5.4")).toBeNull();
    expect(decodeCrewEmblem("E2-1.2-3.0-5.4-2.1")).toBeNull();
    expect(decodeCrewEmblem("E1-1.2-3.0-5.4-2.1-1.1")).toBeNull();
    expect(decodeCrewEmblem({ top: 1 })).toBeNull();
  });

  /**
   * A crew built on a later shape library must still render here rather than
   * throw, so an index this client does not have falls back to the first
   * option of that section instead of failing the whole emblem.
   */
  it("degrades an unknown index to a drawable one", () => {
    const decoded = decodeCrewEmblem("E1-99.99-99.0-0.0-99.0");
    expect(decoded).toEqual({
      top: { shape: 0, color: 0 },
      middle: { shape: 0, color: 0 },
      bottom: { shape: 0, color: 0 },
      frame: { shape: 0, color: 0 },
    });
  });
});

describe("Derived crew emblems", () => {
  it("gives a crew with no saved emblem the same mark on every device", () => {
    const first = crewEmblemFromSeed("crew-1");
    expect(crewEmblemFromSeed("crew-1")).toEqual(first);
    expect(sameCrewEmblem(crewEmblemFromSeed("crew-2"), first)).toBe(false);
  });

  it("prefers a saved emblem and falls back to the derived one", () => {
    expect(resolveCrewEmblem("E1-1.2-3.0-5.4-2.1", "crew-1")).toEqual(emblem);
    expect(resolveCrewEmblem(null, "crew-1")).toEqual(crewEmblemFromSeed("crew-1"));
    expect(resolveCrewEmblem("nonsense", "crew-1")).toEqual(crewEmblemFromSeed("crew-1"));
  });

  it("derives only drawable pieces", () => {
    for (let index = 0; index < 200; index += 1) {
      const derived = crewEmblemFromSeed(`crew-${index}`);
      expect(CREW_EMBLEM_SHAPES.top[derived.top.shape]).toBeDefined();
      expect(CREW_EMBLEM_SHAPES.middle[derived.middle.shape]).toBeDefined();
      expect(CREW_EMBLEM_SHAPES.bottom[derived.bottom.shape]).toBeDefined();
      expect(CREW_EMBLEM_FRAMES[derived.frame.shape]).toBeDefined();
      expect(CREW_EMBLEM_COLORS[derived.frame.color]).toBeDefined();
    }
  });
});

describe("Emblem editing", () => {
  it("wraps a section forward and backward through its options", () => {
    const atStart = { ...emblem, top: { shape: 0, color: 0 } };
    expect(cycleEmblemShape(atStart, "top", -1).top.shape).toBe(
      CREW_EMBLEM_SHAPES.top.length - 1,
    );
    expect(cycleEmblemShape(atStart, "top", 1).top.shape).toBe(1);
    const lastFrame = { ...emblem, frame: { shape: CREW_EMBLEM_FRAMES.length - 1, color: 0 } };
    expect(cycleEmblemShape(lastFrame, "frame", 1).frame.shape).toBe(0);
  });

  it("changes one section's color and leaves the others alone", () => {
    const recolored = setEmblemColor(emblem, "bottom", 1);
    expect(recolored.bottom).toEqual({ shape: 5, color: 1 });
    expect(recolored.top).toEqual(emblem.top);
    expect(recolored.middle).toEqual(emblem.middle);
  });

  it("names every option in every section", () => {
    expect(shapeName("frame", 0)).toBe("None");
    expect(shapeName("top", 1)).toBe(CREW_EMBLEM_SHAPES.top[1].name);
    expect(shapeName("middle", 99)).toBe(CREW_EMBLEM_SHAPES.middle[0].name);
  });

  it("only ever produces a drawable random emblem", () => {
    const sequence = [0.99, 0.99, 0.99, 0.99, 0.99, 0.99, 0.99];
    let index = 0;
    const emblems = [
      randomCrewEmblem(() => sequence[index++ % sequence.length]),
      randomCrewEmblem(),
      randomCrewEmblem(),
    ];
    for (const candidate of emblems) {
      expect(decodeCrewEmblem(encodeCrewEmblem(candidate))).toEqual(candidate);
    }
  });

  it("ships presets that are themselves valid emblems", () => {
    for (const preset of CREW_EMBLEM_PRESETS) {
      expect(decodeCrewEmblem(encodeCrewEmblem(preset.emblem))).toEqual(preset.emblem);
    }
  });
});
