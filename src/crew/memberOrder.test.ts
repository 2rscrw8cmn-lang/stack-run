import { describe, expect, it } from "vitest";
import type { CrewMember } from "./types.js";
import { viewerFirstMembers } from "./memberOrder.js";

const members: CrewMember[] = [
  { userId: "a", displayName: "A", role: "owner", joinedAt: "1", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  { userId: "b", displayName: "B", role: "member", joinedAt: "2", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
  { userId: "c", displayName: "C", role: "member", joinedAt: "3", accentColor: null, runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 } },
];

describe("Crew member order", () => {
  it("puts the current runner first and keeps the rest in membership order", () => {
    expect(viewerFirstMembers(members, "c").map((member) => member.userId)).toEqual([
      "c",
      "a",
      "b",
    ]);
  });

  it("leaves the membership order alone when there is no signed-in runner", () => {
    expect(viewerFirstMembers(members, undefined).map((member) => member.userId)).toEqual([
      "a",
      "b",
      "c",
    ]);
  });
});
