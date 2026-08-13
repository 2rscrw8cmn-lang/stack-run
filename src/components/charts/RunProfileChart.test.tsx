import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RunProfileChart } from "./RunProfileChart";

describe("RunProfileChart", () => {
  it("renders nothing for fewer than two samples", () => {
    const { container } = render(
      <RunProfileChart samples={[{ timeSeconds: 0, value: 140 }]} formatValue={(value) => `${value}`} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("states Low/Avg/High as the accessible authority alongside the presentational line", () => {
    render(
      <RunProfileChart
        samples={[
          { timeSeconds: 0, value: 140 },
          { timeSeconds: 30, value: 160 },
          { timeSeconds: 60, value: 150 },
        ]}
        formatValue={(value) => `${Math.round(value)} bpm`}
      />,
    );
    expect(screen.getByText("140 bpm")).toBeInTheDocument();
    expect(screen.getByText("150 bpm")).toBeInTheDocument();
    expect(screen.getByText("160 bpm")).toBeInTheDocument();
    expect(document.querySelector(".run-profile-chart__figure")).toHaveAttribute("aria-hidden", "true");
  });

  it("plots a faster (lower) pace higher on the chart when inverted", () => {
    const { container } = render(
      <RunProfileChart
        samples={[
          { timeSeconds: 0, value: 500 },
          { timeSeconds: 30, value: 400 },
        ]}
        formatValue={(value) => `${value}`}
        invert
      />,
    );
    const line = container.querySelector("polyline.chart__line");
    expect(line).not.toBeNull();
    const [firstPoint, secondPoint] = line!.getAttribute("points")!.split(" ");
    const firstPointY = Number(firstPoint.split(",")[1]);
    const secondPointY = Number(secondPoint.split(",")[1]);
    // The faster (400s/mi) sample is second and should sit higher (a smaller y) than the slower first sample.
    expect(secondPointY).toBeLessThan(firstPointY);
  });
});
