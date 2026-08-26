import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CrewAwardDetailSheet } from "./CrewAwardDetailSheet.js";
import type { CrewAwardBlockRecord } from "../../crew/awards.js";
import type { CrewMember } from "../../crew/types.js";

const member: CrewMember = {
  userId: "drew",
  role: "member",
  joinedAt: "2026-08-01T00:00:00Z",
  displayName: "Drew",
  accentColor: "green",
  runnerIcon: { head: 0, face: 0, body: 0, flair: 0, background: 0 },
};

function award(overrides: Partial<CrewAwardBlockRecord> = {}): CrewAwardBlockRecord {
  return {
    id: "award-1",
    crewId: "crew-1",
    weekStart: "2026-08-03",
    awardType: "miles",
    winnerUserId: "drew",
    resultValue: 9.34,
    sourceSharedRunId: null,
    crewBuildRow: 0,
    crewBuildColumnStart: 1,
    crewBuildPlacedAt: null,
    createdAt: "2026-08-10T00:00:00Z",
    ...overrides,
  };
}

function open(overrides: Partial<CrewAwardBlockRecord> = {}, winner: CrewMember | null = member) {
  return render(
    <CrewAwardDetailSheet
      award={award(overrides)}
      member={winner}
      isOpen
      onClose={vi.fn()}
      onMoveBlock={vi.fn()}
    />,
  ).container;
}

describe("Award detail sheet", () => {
  it("states who won, what they won and which week", () => {
    open();
    for (const [label, value] of [
      ["Winner", "Drew"],
      ["Winning result", "9.34 MI"],
      ["Week", "AUG 3 – AUG 9"],
    ]) {
      const fact = screen.getByText(label).closest("div")?.parentElement;
      expect(within(fact as HTMLElement).getByText(value)).toBeInTheDocument();
    }
  });

  /**
   * The award's own trophy is the block, at a size the tower can never give
   * it — the same component, in the winner's colour, with both depth faces
   * drawn because nothing is stacked on it here.
   */
  it("shows the winner's own block as the hero, with its depth faces", () => {
    const container = open();
    const brick = container.querySelector<HTMLElement>(".crew-award-detail__hero .award-brick");
    expect(brick?.style.getPropertyValue("--piece-color")).toBe("var(--member-green)");
    expect(brick?.querySelector(".award-brick__window")).not.toBeNull();
    expect(container.querySelectorAll(".placed-block__face--top")).toHaveLength(1);
    expect(container.querySelectorAll(".placed-block__face--right")).toHaveLength(1);
  });

  it("names the block's family, and explains how it is won", () => {
    open();
    expect(screen.getByText("Weekly Special Block")).toBeInTheDocument();
    expect(screen.getByText(/qualifying mileage/i)).toBeInTheDocument();

    open({ awardType: "onTarget" });
    expect(screen.getByText("Feature Special Block")).toBeInTheDocument();
  });

  it("still renders when the winner has left the crew", () => {
    const container = open({}, null);
    expect(screen.getByText("Crew member")).toBeInTheDocument();
    // No member means no accent to borrow, but the hero must still be a block.
    expect(container.querySelector(".crew-award-detail__hero .award-brick")).not.toBeNull();
  });
});
