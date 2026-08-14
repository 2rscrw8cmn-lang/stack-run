import { describe, expect, it } from "vitest";
import { DEFAULT_CREW_EMBLEM, encodeCrewEmblem } from "../src/crew/emblem";
import { formatRace, type InvitePreview } from "./crewInvitePreview";

const base: InvitePreview = {
  crewId: "crew-1",
  crewName: "Brick by Brick",
  crewType: "race",
  raceName: "Orlando Half Marathon",
  raceDate: "2026-12-05",
  raceDistanceMiles: 13.1,
  emblem: DEFAULT_CREW_EMBLEM,
  emblemVersion: encodeCrewEmblem(DEFAULT_CREW_EMBLEM),
};

describe("Crew invite preview metadata", () => {
  it("keeps the race context for a Race Crew", () => {
    expect(formatRace(base)).toContain("Orlando Half Marathon");
    expect(formatRace(base)).toContain("13.1 mi");
  });

  it("omits race context entirely for a Run Club", () => {
    expect(formatRace({ ...base, crewType: "club", raceName: null, raceDate: null, raceDistanceMiles: null })).toBeNull();
  });
});
