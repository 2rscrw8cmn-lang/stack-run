import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CrewAwardWeek } from "../../crew/awards";
import type { CrewBuildReadyAward } from "../../crew/crewBuild";
import { CrewAwardsPanel } from "./CrewAwardsPanel";

const readyAward: CrewBuildReadyAward = {
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
};

const week: CrewAwardWeek = {
  weekStart: "2026-08-17",
  weekEnd: "2026-08-23",
  featureType: "onTarget",
  leaders: [],
};

afterEach(() => {
  window.history.replaceState({}, "", "/");
});

describe("Crew Awards panel", () => {
  it("shows only the winner-owned placement prompt in normal product UI", async () => {
    const user = userEvent.setup();
    const onPlaceAward = vi.fn();
    render(
      <CrewAwardsPanel
        week={week}
        members={[]}
        readyAwards={[readyAward]}
        available
        loading={false}
        onPlaceAward={onPlaceAward}
      />,
    );

    expect(screen.getByText("Special Block Ready")).toBeInTheDocument();
    expect(screen.getByText("Most Miles")).toBeInTheDocument();
    expect(screen.queryByText("Crew Awards · Test View")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Seed 8 QA Blocks" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Place Block" }));
    expect(onPlaceAward).toHaveBeenCalledWith("award-1");
  });

  it("renders nothing in normal product UI when the viewer has no READY award", () => {
    render(
      <CrewAwardsPanel
        week={week}
        members={[]}
        readyAwards={[]}
        available
        loading={false}
        onPlaceAward={vi.fn()}
      />,
    );

    expect(screen.queryByText("Special Blocks")).not.toBeInTheDocument();
    expect(screen.queryByText("Special Block Ready")).not.toBeInTheDocument();
    expect(screen.queryByText("Temporary QA Harness")).not.toBeInTheDocument();
  });

  it("reveals the full standings and deterministic harness only with awardTest", () => {
    window.history.replaceState({}, "", "/?awardTest=1");
    render(
      <CrewAwardsPanel
        week={week}
        members={[]}
        readyAwards={[]}
        available
        loading={false}
        onPlaceAward={vi.fn()}
      />,
    );

    expect(screen.getByText("Temporary QA Harness")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seed 8 QA Blocks" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Clear QA Blocks" })).toBeInTheDocument();
    expect(screen.getByText("Crew Awards · Test View")).toBeInTheDocument();
    expect(screen.getByText("Special Blocks")).toBeInTheDocument();
    expect(screen.getByText("Most Miles")).toBeInTheDocument();
    expect(screen.getByText("On Target")).toBeInTheDocument();
  });
});
