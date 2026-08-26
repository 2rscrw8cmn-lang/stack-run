import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RUNNER_ICON_SHAPES, type RunnerIcon as RunnerIconModel } from "../../crew/runnerIcon.js";
import { RunnerIcon } from "./RunnerIcon.js";

const icon: RunnerIconModel = { head: 1, face: 3, body: 5, flair: 2, background: 3 };

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

  /**
   * Three tones, three jobs: the chassis is the runner's color, flair is
   * applied hardware in the mark tone, and the backdrop is a dark field
   * wearing the accent on its edge. Mixing them is how an icon stops reading
   * as a figure standing on a badge.
   */
  it("draws every part, with flair and the backdrop off the accent-colored plates", () => {
    const { container } = render(<RunnerIcon icon={icon} accent="aqua" />);
    const svg = svgOf(container);
    for (const part of ["background", "head", "face", "body", "flair"]) {
      expect(svg.querySelector(`.runner-icon__part--${part}`)).not.toBeNull();
    }
    const flair = svg.querySelector(".runner-icon__part--flair");
    expect(flair?.querySelector(".runner-icon__mark")).not.toBeNull();
    expect(flair?.querySelector(".runner-icon__plate")).toBeNull();
    const background = svg.querySelector(".runner-icon__part--background");
    expect(background?.querySelector(".runner-icon__field")).not.toBeNull();
    expect(background?.querySelector(".runner-icon__plate")).toBeNull();
    // Bot Eyes punches two sockets through the face plate and lights each one.
    const face = svg.querySelector(".runner-icon__part--face");
    expect(face?.querySelectorAll(".runner-icon__cut")).toHaveLength(2);
    expect(face?.querySelectorAll(".runner-icon__pip")).toHaveLength(2);
  });

  /** The backdrop is a badge, so the box it is drawn in is square. */
  it("draws in a square box at the size it is asked for", () => {
    const { container } = render(<RunnerIcon icon={icon} size={90} />);
    const svg = svgOf(container);
    expect(svg).toHaveAttribute("height", "90");
    expect(svg).toHaveAttribute("width", "90");
  });

  /** The runner is painted on the backdrop, never under it. */
  it("puts the backdrop behind the runner", () => {
    const { container } = render(<RunnerIcon icon={icon} />);
    const parts = Array.from(svgOf(container).querySelectorAll("g")).map(
      (group) => group.getAttribute("class"),
    );
    expect(parts[0]).toContain("runner-icon__part--background");
    expect(parts[parts.length - 1]).toContain("runner-icon__part--flair");
  });

  /** An icon saved against a later library must still draw, not crash. */
  it("degrades an option this client does not have to a drawable one", () => {
    const { container } = render(
      <RunnerIcon icon={{ head: 99, face: 99, body: 99, flair: 99, background: 0 }} />,
    );
    const svg = svgOf(container);
    const firstHead = RUNNER_ICON_SHAPES.head[0];
    expect(svg.querySelector(".runner-icon__part--head path")).toHaveAttribute(
      "d",
      firstHead.plates[0],
    );
  });

  it("renders the empty flair and backdrop without drawing anything", () => {
    const { container } = render(
      <RunnerIcon icon={{ ...icon, flair: 0, background: 0 }} />,
    );
    const svg = svgOf(container);
    expect(svg.querySelector(".runner-icon__part--flair")?.children).toHaveLength(0);
    expect(svg.querySelector(".runner-icon__part--background")?.children).toHaveLength(0);
  });
});
