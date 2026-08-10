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
    [[0, 600, 1200, 600, 0], 5],
    [[0, 600, 1200, 600, 0, 0, 0], 7],
  ])("supports a dynamic %i-zone source", (zones, expected) => {
    renderZones(zones);
    const legend = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(within(legend).getAllByRole("listitem")).toHaveLength(expected);
  });

  it("keeps source zero zones in text while giving them no visible arc", () => {
    const { container } = renderZones([0, 600, 1200, 0, 0, 0, 0]);
    const legend = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(within(legend).getAllByRole("listitem")[0]).toHaveTextContent("0:00 · 0%");
    expect(container.querySelectorAll(".donut__arc")).toHaveLength(2);
  });

  it("renders nothing for an all-zero source", () => {
    const { container } = renderZones([0, 0, 0]);
    expect(container).toBeEmptyDOMElement();
  });
});
