import { describe, expect, it } from "vitest";
import { DEFAULT_CREW_EMBLEM, encodeCrewEmblem } from "../src/crew/emblem";
import crewInviteHandler from "./crew-invite";
import crewInviteImageHandler from "./og/crew-invite";
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

  it("adapts Vercel's Node invite invocation and preserves the public origin", async () => {
    let body = "";
    const response = {
      statusCode: 0,
      setHeader: () => undefined,
      end: (value?: string) => { body = value ?? ""; },
    };
    await crewInviteHandler({
      method: "GET",
      url: "/api/crew-invite?token=abcdefghijklmnopqrstuvwxyz123456",
      headers: { host: "preview.stack.run", "x-forwarded-proto": "https" },
    }, response);
    expect(response.statusCode).toBe(200);
    expect(body).toContain("https://preview.stack.run/?join=abcdefghijklmnopqrstuvwxyz123456");
  });

  it("adapts Vercel's Node image invocation instead of treating its path as a URL", async () => {
    let body = "";
    const response = {
      statusCode: 0,
      setHeader: () => undefined,
      end: (value?: string) => { body = value ?? ""; },
    };
    await crewInviteImageHandler({ method: "GET", url: "/api/og/crew-invite?token=abcdefghijklmnopqrstuvwxyz123456" }, response);
    expect(response.statusCode).toBe(200);
    expect(body).toContain("<svg");
  });
});
