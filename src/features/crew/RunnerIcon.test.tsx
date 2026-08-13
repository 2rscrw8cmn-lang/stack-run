import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RUNNER_ICON_SHAPES, type RunnerIcon as RunnerIconModel } from "../../crew/runnerIcon";
import { RunnerIcon } from "./RunnerIcon";

const icon: RunnerIconModel = { head: 1, face: 3, body: 5, extra: 2 };

function svgOf(container: HTMLElement): SVGSVGElement {
  const svg = container.querySelector("svg");
  expect(svg).not.toBeNull();
  return svg as SVGSVGElement;
}

describe("RunnerIcon", () => {
  /**
   * The icon is never the only thing identifying a member — a name is always
   * beside it — so by default it is decorative and stays out of the
   * accessibility tree entirely.
   */
  it("is decorative unless it is given a name", () => {
    const { container } = render(<RunnerIcon icon={icon} />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute("aria-hidden", "true");
    expect(svg).not.toHaveAttribute("role");
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("exposes itself as an image when it is the subject, as in the editor preview", () => {
    render(<RunnerIcon icon={icon} label="Runner Icon preview" />);
    const svg = screen.getByRole("img", { name: "Runner Icon preview" });
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  /**
   * The accent rides on the mark itself, not on an ancestor, so an icon
   * lifted out of a member-colored row still draws in the runner's color.
   */
  it("carries its own member color", () => {
    const { container } = render(<RunnerIcon icon={icon} accent="orchid" />);
    expect(svgOf(container)).toHaveAttribute("data-member-color", "orchid");
  });

  it("draws every part, with the extra kept off the accent-colored plates", () => {
    const { container } = render(<RunnerIcon icon={icon} accent="aqua" />);
    const svg = svgOf(container);
    for (const part of ["head", "face", "body", "extra"]) {
      expect(svg.querySelector(`.runner-icon__part--${part}`)).not.toBeNull();
    }
    // Bolt is an `extra`, so it renders as a mark rather than another plate.
    const extra = svg.querySelector(".runner-icon__part--extra");
    expect(extra?.querySelector(".runner-icon__mark")).not.toBeNull();
    expect(extra?.querySelector(".runner-icon__plate")).toBeNull();
    // Single Slot punches one hole through the face plate.
    const face = svg.querySelector(".runner-icon__part--face");
    expect(face?.querySelectorAll(".runner-icon__cut")).toHaveLength(1);
  });

  it("scales on its own aspect ratio rather than being squashed into a square", () => {
    const { container } = render(<RunnerIcon icon={icon} size={90} />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute("height", "90");
    expect(svg).toHaveAttribute("width", "72");
  });

  /** An icon saved against a later library must still draw, not crash. */
  it("degrades an option this client does not have to a drawable one", () => {
    const { container } = render(
      <RunnerIcon icon={{ head: 99, face: 99, body: 99, extra: 99 }} />,
    );
    const svg = svgOf(container);
    const firstHead = RUNNER_ICON_SHAPES.head[0];
    expect(svg.querySelector(".runner-icon__part--head path")).toHaveAttribute(
      "d",
      firstHead.plates[0],
    );
  });

  it("renders the empty extra without drawing anything", () => {
    const { container } = render(<RunnerIcon icon={{ ...icon, extra: 0 }} />);
    const extra = svgOf(container).querySelector(".runner-icon__part--extra");
    expect(extra?.children).toHaveLength(0);
  });
});
