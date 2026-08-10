import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ZoneBars } from "./ZoneBars";

describe("ZoneBars", () => {
  it("keeps every value readable as text, not only as a bar", () => {
    render(<ZoneBars zoneSeconds={[0, 600, 1200, 600, 0]} label="Heart rate zone distribution" />);

    const zones = screen.getByRole("list", { name: "Heart rate zone distribution" });
    expect(within(zones).getAllByRole("listitem")).toHaveLength(5);
    expect(zones).toHaveTextContent("Zone 3");
    expect(zones).toHaveTextContent("20:00 · 50%");
    expect(zones).toHaveTextContent("10:00 · 25%");
  });

  it("shows a zone with no time in it as an honest zero", () => {
    render(<ZoneBars zoneSeconds={[0, 600]} label="Zones" />);
    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("0:00 · 0%");
    // The row stays, and its bar has no length rather than no row.
    expect(rows[0].querySelector(".zone-bars__fill")).toHaveStyle({ width: "0%" });
    expect(rows[1].querySelector(".zone-bars__fill")).toHaveStyle({ width: "100%" });
  });

  it("draws nothing at all rather than a chart of zeroes", () => {
    const { container } = render(<ZoneBars zoneSeconds={[0, 0, 0]} label="Zones" />);
    expect(container).toBeEmptyDOMElement();
  });
});
