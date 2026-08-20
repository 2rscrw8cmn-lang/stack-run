import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CrewBuildReadyAward } from "../../crew/crewBuild";
import { CrewAwardsPanel } from "./CrewAwardsPanel";

function readyAward(overrides: Partial<CrewBuildReadyAward> = {}): CrewBuildReadyAward {
  return {
    kind: "award",
    id: "award-1",
    userId: "runner-a",
    awardType: "miles",
    weekStart: "2026-08-10",
    resultValue: 12.4,
    sourceSharedRunId: null,
    width: 2,
    height: 1,
    createdAt: "2026-08-17T00:00:00Z",
    ...overrides,
  };
}

describe("Crew Awards panel", () => {
  it("prompts the winner to place their earned block", async () => {
    const user = userEvent.setup();
    const onPlaceAward = vi.fn();
    render(<CrewAwardsPanel readyAwards={[readyAward()]} onPlaceAward={onPlaceAward} />);

    expect(screen.getByText("Special Block Ready")).toBeInTheDocument();
    expect(screen.getByText("Most Miles")).toBeInTheDocument();
    expect(screen.getByText("12.4 MI")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Place Block" }));
    expect(onPlaceAward).toHaveBeenCalledWith("award-1");
  });

  it("counts the rest of the queue behind the first block", () => {
    render(
      <CrewAwardsPanel
        readyAwards={[
          readyAward(),
          readyAward({ id: "award-2", awardType: "runs", resultValue: 5 }),
          readyAward({ id: "award-3", awardType: "zone2", resultValue: 91 }),
        ]}
        onPlaceAward={vi.fn()}
      />,
    );

    expect(screen.getByText("3 Special Blocks Ready")).toBeInTheDocument();
    expect(screen.getByText(/\+2 more waiting/)).toBeInTheDocument();
    // Only the first block is offered; the rest wait their turn.
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("renders nothing when the viewer has no READY award", () => {
    const { container } = render(
      <CrewAwardsPanel readyAwards={[]} onPlaceAward={vi.fn()} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
