import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AwardBlockVisualStudy } from "./AwardBlockVisualStudy";

vi.mock("./RunnerIcon", () => ({
  RunnerIcon: () => <span data-testid="runner-icon" />,
}));

describe("AwardBlockVisualStudy", () => {
  it("renders all eight zero-mile award concepts", () => {
    render(<AwardBlockVisualStudy />);

    expect(screen.getByText("Most Miles")).toBeInTheDocument();
    expect(screen.getByText("Best Zone 2")).toBeInTheDocument();
    expect(screen.getByText("Fastest Avg. Pace")).toBeInTheDocument();
    expect(screen.getByText("Most Runs")).toBeInTheDocument();
    expect(screen.getByText("Long Haul")).toBeInTheDocument();
    expect(screen.getByText("Steady")).toBeInTheDocument();
    expect(screen.getByText("On Target")).toBeInTheDocument();
    expect(screen.getByText("Level Up")).toBeInTheDocument();
  });
});
