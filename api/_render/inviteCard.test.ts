import { describe, expect, it } from "vitest";
import {
  CREW_EMBLEM_SHAPES,
  DEFAULT_CREW_EMBLEM,
  crewEmblemDrawing,
  decodeCrewEmblem,
  type CrewEmblem,
} from "../../src/crew/emblem.js";
import { CARD_HEIGHT, CARD_WIDTH, renderInviteCard, type InviteCard } from "./inviteCard.js";

const emblem = decodeCrewEmblem("E2-4.2-7.0-3.5") as CrewEmblem;

const raceCrew: InviteCard = {
  crewName: "OUC Half",
  kind: "RACE CREW",
  raceName: "OUC Orlando Half Marathon",
  raceDetail: "Dec 5, 2026 · 13.1 mi",
  emblem,
};

function dimensions(png: Uint8Array): { width: number; height: number } {
  const view = new DataView(png.buffer, png.byteOffset);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

describe("Crew invite share image", () => {
  it("renders a 1200×630 PNG", () => {
    const png = renderInviteCard(raceCrew);
    expect([...png.subarray(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
    expect(dimensions(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
  });

  it("stays small enough for a link previewer to fetch quickly", () => {
    expect(renderInviteCard(raceCrew).length).toBeLessThan(400_000);
  });

  it("draws the same card twice for the same crew", () => {
    expect(renderInviteCard(raceCrew)).toEqual(renderInviteCard(raceCrew));
  });

  /**
   * The failure this card exists to prevent: an emblem renderer that copies a
   * crew's colours but draws its own crest. Two emblems with identical colours
   * and different shapes have to produce different images.
   */
  it("draws the crew's saved emblem geometry, not just its palette", () => {
    const shapes = decodeCrewEmblem("E2-0.2-1.0-1.5") as CrewEmblem;
    const otherShapes = decodeCrewEmblem("E2-14.2-9.0-6.5") as CrewEmblem;
    expect(renderInviteCard({ ...raceCrew, emblem: shapes })).not.toEqual(
      renderInviteCard({ ...raceCrew, emblem: otherShapes }),
    );
  });

  it("takes that geometry from the emblem module every client draws from", () => {
    const drawing = crewEmblemDrawing(emblem);
    expect(drawing.some((operation) => operation.d === CREW_EMBLEM_SHAPES.main[4].d)).toBe(true);
    expect(drawing.some((operation) => operation.d === CREW_EMBLEM_SHAPES.secondary[7].d)).toBe(true);
    expect(drawing.some((operation) => operation.d === CREW_EMBLEM_SHAPES.background[3].d)).toBe(true);
  });

  it("changes when the crew changes its emblem colours", () => {
    const recoloured = decodeCrewEmblem("E2-4.3-7.1-3.4") as CrewEmblem;
    expect(renderInviteCard({ ...raceCrew, emblem: recoloured })).not.toEqual(
      renderInviteCard(raceCrew),
    );
  });

  /**
   * The ink style is part of what a crew designed, not a client rendering
   * preference, so a flat emblem has to arrive flat in the shared preview too.
   */
  it("carries the crew's ink style into the share image", () => {
    const clean = decodeCrewEmblem("E2-4.2-7.0-3.5-1") as CrewEmblem;
    expect(clean.outline).toBe(false);
    expect(renderInviteCard({ ...raceCrew, emblem: clean })).not.toEqual(
      renderInviteCard(raceCrew),
    );
  });

  it("leaves race context off a Run Club card", () => {
    const club: InviteCard = {
      crewName: "OUC Half",
      kind: "RUN CLUB",
      raceName: null,
      raceDetail: null,
      emblem,
    };
    expect(renderInviteCard(club)).not.toEqual(renderInviteCard(raceCrew));
    expect(dimensions(renderInviteCard(club))).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
  });

  it("still draws a card for a crew with no emblem of its own", () => {
    expect(
      dimensions(renderInviteCard({ ...raceCrew, emblem: DEFAULT_CREW_EMBLEM })),
    ).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
  });

  it("gives an unresolved invite the generic STACK card", () => {
    const fallback = renderInviteCard(null);
    expect(dimensions(fallback)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    expect(fallback).not.toEqual(renderInviteCard(raceCrew));
  });

  it("survives a name that is far too long, or empty, or unwritable", () => {
    for (const crewName of ["", "   ", "東京", "Crew ".repeat(40)]) {
      expect(dimensions(renderInviteCard({ ...raceCrew, crewName }))).toEqual({
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      });
    }
  });
});
