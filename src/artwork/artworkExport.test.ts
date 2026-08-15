import { describe, expect, it } from "vitest";
import { DEFAULT_CREW_EMBLEM } from "../crew/emblem";
import { MEMBER_ACCENTS, type CrewMemberAccent } from "../crew/memberAccent";
import { runnerIconFromSeed } from "../crew/runnerIcon";
import type { CrewMember } from "../crew/types";
import {
  artworkZip,
  crewArtworkFiles,
  crewEmblemArtwork,
  runnerIconArtwork,
  type ArtworkPalette,
} from "./artworkExport";

const palette: ArtworkPalette = {
  member: Object.fromEntries(
    MEMBER_ACCENTS.map((accent, index) => [accent, `#${(index + 1).toString(16).padStart(6, "0")}`]),
  ) as Record<CrewMemberAccent, string>,
  ink: "#04090d",
  mark: "#f6f7f8",
  field: "#0b131a",
};

const member: CrewMember = {
  userId: "runner-1",
  role: "member",
  joinedAt: "2026-08-15T12:00:00Z",
  displayName: "Zack & Co.",
  accentColor: "red",
  runnerIcon: runnerIconFromSeed("runner-1"),
};

describe("artwork export", () => {
  it("serializes the canonical Crew emblem as standalone SVG", () => {
    const file = crewEmblemArtwork({ name: "FASTboyz", emblem: DEFAULT_CREW_EMBLEM });
    expect(file.filename).toBe("fastboyz-emblem.svg");
    expect(file.content).toContain('<svg xmlns="http://www.w3.org/2000/svg"');
    expect(file.content).toContain("crew-emblem__main");
  });

  it("serializes a Runner Icon with inline production colors", () => {
    const file = runnerIconArtwork(member, palette);
    expect(file.filename).toBe("zack-and-co.svg");
    expect(file.content).toContain("Zack &amp; Co. runner icon");
    expect(file.content).toContain(palette.member.red);
    expect(file.content).toContain(palette.ink);
  });

  it("builds a Crew pack without overwriting duplicate display names", () => {
    const files = crewArtworkFiles(
      { name: "FASTboyz", emblem: DEFAULT_CREW_EMBLEM },
      [member, { ...member, userId: "runner-2" }],
      palette,
    );
    expect(files.map((file) => file.filename)).toEqual([
      "fastboyz-emblem.svg",
      "zack-and-co.svg",
      "zack-and-co-2.svg",
    ]);
  });

  it("writes a standards-shaped ZIP container for the Crew pack", async () => {
    const files = crewArtworkFiles(
      { name: "FASTboyz", emblem: DEFAULT_CREW_EMBLEM },
      [member],
      palette,
    );
    const bytes = new Uint8Array(await artworkZip(files).arrayBuffer());
    expect(Array.from(bytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(new TextDecoder().decode(bytes)).toContain("fastboyz-emblem.svg");
    expect(new TextDecoder().decode(bytes)).toContain("zack-and-co.svg");
  });
});
