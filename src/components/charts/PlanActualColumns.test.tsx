import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  PlanActualColumns,
  type PlanActualColumn,
} from "./PlanActualColumns.js";
import { sparseTickIndices } from "./chartTickDensity.js";

const columns: PlanActualColumn[] = [
  { key: "w1", shortLabel: "W1", selectionLabel: "Week 1, 4 actual miles, 5 planned miles", actual: 4, planned: 5 },
  { key: "w2", shortLabel: "W2", selectionLabel: "Week 2, 6 actual miles, 5 planned miles", actual: 6, planned: 5 },
  { key: "w3", shortLabel: "W3", selectionLabel: "Week 3, 3 actual miles, 5 planned miles", actual: 3, planned: 5 },
];

describe("PlanActualColumns", () => {
  it("makes the chart itself one full-size week selector, with no overlapping column buttons", () => {
    const { container } = render(
      <PlanActualColumns columns={columns} selectedKey="w2" onSelect={() => undefined} />,
    );
    expect(container.querySelector(".plan-actual-chart__selectors")).toBeNull();
    expect(container.querySelectorAll(".plan-actual-chart__selector")).toHaveLength(0);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("slider", { name: "Select a week" })).toHaveAttribute(
      "aria-valuetext",
      "Week 2, 6 actual miles, 5 planned miles",
    );
  });

  it("selects a week when the chart scrubber changes", () => {
    const onSelect = vi.fn();
    render(<PlanActualColumns columns={columns} selectedKey="w1" onSelect={onSelect} />);
    const scrubber = screen.getByRole("slider", { name: "Select a week" });
    fireEvent.change(scrubber, { target: { value: 2 } });
    expect(onSelect).toHaveBeenCalledWith("w3");
  });

  it("marks the selected column visually in the chart", () => {
    const { container } = render(
      <PlanActualColumns columns={columns} selectedKey="w3" onSelect={() => undefined} />,
    );
    expect(container.querySelector(".plan-actual-chart__selection")).toBeInTheDocument();
    expect(container.querySelector(".plan-actual-chart__actual--selected")).toBeInTheDocument();
  });

  it("draws sparse x-axis date labels rather than a second navigation rail", () => {
    const { container } = render(
      <PlanActualColumns columns={columns} selectedKey="w1" onSelect={() => undefined} />,
    );
    expect(container.querySelectorAll(".chart__tick--x").length).toBeGreaterThan(0);
  });

  it("defaults to the accent tone and switches to Intervals blue when asked", () => {
    const { container, rerender } = render(
      <PlanActualColumns columns={columns} selectedKey="w1" onSelect={() => undefined} />,
    );
    expect(container.querySelector(".plan-actual-chart")).toHaveClass("plan-actual-chart--accent");

    rerender(
      <PlanActualColumns columns={columns} selectedKey="w1" onSelect={() => undefined} tone="intervals" />,
    );
    expect(container.querySelector(".plan-actual-chart")).toHaveClass("plan-actual-chart--intervals");
  });

  it("offers a shorter overview plot without shrinking detail charts by default", () => {
    const { container, rerender } = render(
      <PlanActualColumns columns={columns} selectedKey="w1" onSelect={() => undefined} />,
    );
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 320 192");
    expect(container.querySelector(".plan-actual-chart")).not.toHaveClass("plan-actual-chart--compact");

    rerender(
      <PlanActualColumns compact columns={columns} selectedKey="w1" onSelect={() => undefined} />,
    );
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 320 160");
    expect(container.querySelector(".plan-actual-chart")).toHaveClass("plan-actual-chart--compact");
  });

  it("thins dense charts to evenly spaced labels that cannot collide", () => {
    for (const count of [8, 12, 26]) {
      const ticks = sparseTickIndices(count, 4);
      expect(ticks[0]).toBe(0);
      expect(ticks.at(-1)).toBe(count - 1);
      expect(ticks.length).toBeLessThanOrEqual(4);
      for (let index = 1; index < ticks.length; index += 1) {
        expect((ticks[index] - ticks[index - 1]) / count).toBeGreaterThan(0.19);
      }
    }
  });

  it("draws only the thinned labels, so a twelve-week chart is not twelve dates", () => {
    const weeks = Array.from({ length: 12 }, (_, index) => ({
      key: `w${index}`,
      shortLabel: `Aug ${index + 1}`,
      selectionLabel: `Week ${index + 1}`,
      actual: index + 1,
    }));
    const { container } = render(
      <PlanActualColumns columns={weeks} selectedKey="w4" onSelect={() => undefined} />,
    );
    expect(container.querySelectorAll(".chart__tick--x").length).toBeLessThanOrEqual(4);
  });
});
