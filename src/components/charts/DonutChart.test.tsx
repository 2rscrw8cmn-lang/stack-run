import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { DonutChart } from "./DonutChart.js";
import { zoneDonutSegments } from "./zoneDonutSegments.js";

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

/**
 * The August 13 activity's zone times: zone 3 dominant at 26% / 7:43, zone 2
 * at 23% / 6:52 and zone 5 at 10% / 2:51, which are the readings the real
 * device review reported.
 */
const REAL_ZONES = [305, 412, 463, 430, 171, 0, 0];

/** What the ring itself is saying, as opposed to the hidden legend behind it. */
function centre() {
  return {
    value: document.querySelector(".donut__center-value")?.textContent,
    name: document.querySelector(".donut__center-label")?.textContent,
    detail: document.querySelector(".donut__center-detail")?.textContent,
  };
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

  it("stays a plain figure-plus-legend with no selectable arcs by default", () => {
    renderZones(REAL_ZONES);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    expect(screen.getByRole("list", { name: "Heart rate zone distribution" }))
      .not.toHaveClass("visually-hidden");
  });
});

describe("interactive DonutChart", () => {
  const renderInteractive = (zones: number[] = REAL_ZONES) =>
    render(
      <DonutChart
        interactive
        size="large"
        label="Heart rate zone distribution"
        segments={zoneDonutSegments(zones)}
      />,
    );

  it("opens on the dominant zone, reporting its share, name and time", () => {
    renderInteractive();
    expect(centre()).toEqual({ value: "26%", name: "Zone 3", detail: "7:43" });
  });

  it("updates the centre when a segment is tapped", async () => {
    const user = userEvent.setup();
    renderInteractive();

    await user.click(screen.getByRole("button", { name: "Zone 2, 6:52, 23%" }));
    expect(centre()).toEqual({ value: "23%", name: "Zone 2", detail: "6:52" });

    await user.click(screen.getByRole("button", { name: "Zone 5, 2:51, 10%" }));
    expect(centre()).toEqual({ value: "10%", name: "Zone 5", detail: "2:51" });
  });

  it("marks exactly one arc selected, and shows it without recolouring the zone palette", async () => {
    const user = userEvent.setup();
    const { container } = renderInteractive();

    const pressed = () => screen.getAllByRole("button").filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(pressed()).toHaveLength(1);
    expect(pressed()[0]).toHaveAccessibleName("Zone 3, 7:43, 26%");

    await user.click(screen.getByRole("button", { name: "Zone 1, 5:05, 17%" }));
    expect(pressed()).toHaveLength(1);
    expect(pressed()[0]).toHaveAccessibleName("Zone 1, 5:05, 17%");
    expect(container.querySelectorAll(".donut__arc--selected")).toHaveLength(1);
    // The selected arc keeps its own zone colour; selection is weight, not hue.
    expect(container.querySelector(".donut__arc--selected"))
      .toHaveStyle({ "--donut-color": "var(--zone-1)" });
  });

  it("is reachable and operable from the keyboard alone", async () => {
    const user = userEvent.setup();
    renderInteractive();

    const zone4 = screen.getByRole("button", { name: "Zone 4, 7:10, 24%" });
    zone4.focus();
    await user.keyboard("{Enter}");

    expect(zone4).toHaveAttribute("aria-pressed", "true");
    expect(centre()).toEqual({ value: "24%", name: "Zone 4", detail: "7:10" });
  });

  it("keeps the whole ordered composition for a screen reader without showing a legend", () => {
    renderInteractive();
    const legend = screen.getByRole("list", { name: "Heart rate zone distribution" });
    // Present and complete for assistive technology, absent from the layout.
    expect(legend).toHaveClass("visually-hidden");
    expect(within(legend).getAllByRole("listitem")).toHaveLength(5);
    expect(legend).toHaveTextContent("Zone 1");
    expect(legend).toHaveTextContent("Zone 5");
    expect(legend).toHaveTextContent("5:05 · 17%");
    // The figure is not hidden from assistive technology now that it holds
    // the controls, but the drawing inside it still is.
    expect(document.querySelector(".donut__figure")).not.toHaveAttribute("aria-hidden");
    expect(document.querySelector(".donut__figure svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("re-defaults to the new dominant zone when handed a different run", () => {
    const { rerender } = renderInteractive();
    expect(centre().name).toBe("Zone 3");

    rerender(
      <DonutChart
        interactive
        size="large"
        label="Heart rate zone distribution"
        segments={zoneDonutSegments([900, 60, 60, 0, 0, 0, 0])}
      />,
    );
    expect(centre().name).toBe("Zone 1");
  });

  it("offers a target for every visible zone and none for an empty one", () => {
    renderInteractive();
    // Five zones carry time; zones 6 and 7 are real zeroes and get no arc.
    expect(screen.getAllByRole("button")).toHaveLength(5);
    expect(screen.queryByRole("button", { name: /Zone 6/ })).not.toBeInTheDocument();
  });
});
