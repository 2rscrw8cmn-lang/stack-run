import { describe, expect, it } from "vitest";
import { crewMemberAccent } from "./memberAccent";

describe("Crew member accents", () => {
  it("is deterministic and uses the restrained member palette", () => {
    const first = crewMemberAccent("runner-a");
    expect(crewMemberAccent("runner-a")).toBe(first);
    expect(["lime", "blue", "purple", "yellow", "cyan", "orange"]).toContain(first);
  });
});
