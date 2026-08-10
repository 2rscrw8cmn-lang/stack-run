import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MiniBars, MiniDonut, MiniMatrix, MiniSparkline } from "./MiniCharts";

describe("Training Signal mini charts", () => {
  it("draws one factual bar per supplied point and keeps the graphic decorative", () => {
    const { container } = render(<MiniBars values={[0, 2, 4, 3]} />);
    expect(container.querySelectorAll(".mini-bars i")).toHaveLength(4);
    expect(container.querySelector(".mini-bars")).toHaveAttribute("aria-hidden", "true");
  });

  it("keeps the pace sparkline unsmoothed and reversible", () => {
    const { container } = render(<MiniSparkline values={[620, 600, 610]} invert />);
    expect(container.querySelector("polyline")).toBeInTheDocument();
    expect(container.querySelector(".mini-sparkline")).toHaveAttribute("aria-hidden", "true");
  });

  it("omits an empty donut and draws only positive segments", () => {
    const { container, rerender } = render(<MiniDonut segments={[{ value: 0, color: "red" }]} />);
    expect(container.querySelector(".mini-donut")).toBeNull();
    rerender(<MiniDonut segments={[{ value: 0, color: "red" }, { value: 10, color: "blue" }]} />);
    expect(container.querySelectorAll(".mini-donut__arc")).toHaveLength(1);
  });

  it("caps the completion matrix while retaining completed and missed states", () => {
    const { container } = render(<MiniMatrix completed={12} due={20} />);
    expect(container.querySelectorAll(".mini-matrix i")).toHaveLength(16);
    expect(container.querySelectorAll('[data-complete="true"]')).toHaveLength(10);
  });
});
