import { describe, expect, it } from "vitest";
import { accentColorFrom, crewMemberAccent, MEMBER_ACCENTS } from "./memberAccent.js";

describe("Crew member accents", () => {
  it("falls back to a deterministic pick from the 16-color palette when unpicked", () => {
    const first = crewMemberAccent("runner-a");
    expect(crewMemberAccent("runner-a")).toBe(first);
    expect(MEMBER_ACCENTS).toContain(first);
    expect(MEMBER_ACCENTS).toHaveLength(16);
  });

  it("never falls back to an activity color", () => {
    // The whole reason this palette exists separately: a runner's identity
    // must never look like the activity-type color a block already carries.
    expect(MEMBER_ACCENTS).not.toEqual(
      expect.arrayContaining(["lime", "blue", "purple", "yellow", "cyan", "orange"]),
    );
  });

  it("prefers an explicit pick over the hash fallback", () => {
    const fallback = crewMemberAccent("runner-a");
    const other = MEMBER_ACCENTS.find((color) => color !== fallback)!;
    expect(crewMemberAccent("runner-a", other)).toBe(other);
    expect(crewMemberAccent("runner-a", null)).toBe(fallback);
  });
});

describe("accentColorFrom", () => {
  it("accepts only a known accent, and null for anything else", () => {
    expect(accentColorFrom("magenta")).toBe("magenta");
    expect(accentColorFrom("lime")).toBeNull();
    expect(accentColorFrom(null)).toBeNull();
    expect(accentColorFrom(undefined)).toBeNull();
    expect(accentColorFrom(42)).toBeNull();
  });
});
