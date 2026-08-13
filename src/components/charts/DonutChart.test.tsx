import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DonutChart } from "./DonutChart";
import { zoneDonutSegments } from "./zoneDonutSegments";

function renderZones(zones: number[]) {
  return render(
    <DonutChart
      label="Heart rate zone distribution"
      segments={zoneDonutSegments(zones)}
      centerLabel="Zone 2"
      centerValue="50%"
    />,
  );
}

describe("DonutChart", () => {
  it.each([
    [[600], 1],
    [[0, 600, 1200, 600, 0], 3],
    [[0, 600, 1200, 600, 0, 0, 0], 3],
  ])("supports a dynamic %i-zone source", (zones, expected) => {
    renderZones(zones);
    const legend = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(expected);
  });

  it("suppresses zero zones without renumbering visible source zones", () => {
    const { container } = renderZones([0, 600, 0, 1200, 600, 0, 0]);
    const legend = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(3);
    expect(within(legend).getByText("Zone 2")).toBeInTheDocument();
    expect(within(legend).getByText("Zone 4")).toBeInTheDocument();
    expect(within(legend).getByText("Zone 5")).toBeInTheDocument();
    expect(within(legend).queryByText("Zone 1")).not.toBeInTheDocument();
    expect(within(legend).queryByText("Zone 3")).not.toBeInTheDocument();
    expect(container.querySelectorAll(".donut__arc")).toHaveLength(3);
  });

  it("renders nothing for an all-zero source", () => {
    const { container } = renderZones([0, 0, 0]);
    expect(container).toBeEmptyDOMElement();
  });

  it("defaults to the compact side-by-side layout and opts into a large centered ring", () => {
    const { container, rerender } = render(
      <DonutChart label="Test" segments={[{ label: "A", value: 1, valueLabel: "1", color: "red" }]} />,
    );
    expect(container.querySelector(".donut")).not.toHaveClass("donut--large");

    rerender(
      <DonutChart size="large" label="Test" segments={[{ label: "A", value: 1, valueLabel: "1", color: "red" }]} />,
    );
    expect(container.querySelector(".donut")).toHaveClass("donut--large");
  });
});
