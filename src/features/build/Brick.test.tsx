/// <reference types="node" />
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Dumbbell } from "lucide-react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Brick } from "./Brick.js";

describe("Brick narrow vertical labels", () => {
  it("turns the complete unchanged text object when the placed footprint is one unit wide", () => {
    const { container } = render(
      <Brick
        pieceColor="var(--easy)"
        label={{ text: "3.2", unit: false }}
        topFace={[true]}
        rightFace={[true, true, true]}
      />,
    );

    const label = container.querySelector(".placed-block__label");
    expect(label?.textContent).toBe("3.2");
    expect(label?.textContent).not.toBe("2.3");
    expect(label).toHaveClass("placed-block__label--vertical");
  });

  it("leaves wider text labels horizontal", () => {
    const { container } = render(
      <Brick
        pieceColor="var(--easy)"
        label={{ text: "3.2", unit: false }}
        topFace={[true, true]}
        rightFace={[true, true, true]}
      />,
    );

    expect(container.querySelector(".placed-block__label"))
      .not.toHaveClass("placed-block__label--vertical");
  });

  it("does not turn icon-only labels", () => {
    const { container } = render(
      <Brick
        pieceColor="var(--cross)"
        label={{ icon: Dumbbell }}
        topFace={[true]}
        rightFace={[true, true]}
      />,
    );

    expect(container.querySelector(".placed-block__label"))
      .not.toHaveClass("placed-block__label--vertical");
  });

  it("uses one real 90 degree transform rather than stacked characters", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "Brick.css"),
      "utf8",
    );
    expect(css).toMatch(/\.placed-block__label--vertical\s*\{[^}]*transform:\s*rotate\(90deg\)/s);
  });
});

/**
 * A face is culled per grid cell and drawn per unbroken run of exposed
 * cells. Drawing one rectangle per cell put the brick's own edge shading
 * between every course, so a tall turned block's side read as a stack of
 * separate slabs — the "chopped" faces in the Crew tower. What is under test
 * is the geometry that reaches the DOM: how many surfaces, where each starts,
 * and how many cells it covers, all measured against the same cell count.
 */
describe("Brick depth faces", () => {
  const faces = (container: HTMLElement, kind: "top" | "right") =>
    [...container.querySelectorAll<HTMLElement>(`.placed-block__face--${kind}`)].map(
      (face) => ({
        offset: face.style.getPropertyValue("--face-offset"),
        span: face.style.getPropertyValue("--face-span"),
        cells: face.style.getPropertyValue("--face-cells"),
      }),
    );

  it("draws one side for a tall block with nothing abutting it", () => {
    const { container } = render(
      <Brick
        pieceColor="var(--easy)"
        label={{ text: "6", unit: false }}
        topFace={[true]}
        rightFace={[true, true, true, true, true]}
      />,
    );

    expect(faces(container, "right")).toEqual([
      { offset: "0", span: "5", cells: "5" },
    ]);
  });

  it("draws one side above the courses a neighbour abuts", () => {
    const { container } = render(
      <Brick
        pieceColor="var(--easy)"
        label={{ text: "5.1", unit: false }}
        topFace={[true]}
        rightFace={[false, false, true, true, true]}
      />,
    );

    expect(faces(container, "right")).toEqual([
      { offset: "2", span: "3", cells: "5" },
    ]);
  });

  it("draws one lid per open stretch of a wide block's top", () => {
    const { container } = render(
      <Brick
        pieceColor="var(--long)"
        label={{ text: "6.2", unit: true }}
        topFace={[true, true, false, false, true, true]}
        rightFace={[true]}
      />,
    );

    expect(faces(container, "top")).toEqual([
      { offset: "0", span: "2", cells: "6" },
      { offset: "4", span: "2", cells: "6" },
    ]);
  });

  it("draws nothing where the tower covers a face completely", () => {
    const { container } = render(
      <Brick
        pieceColor="var(--easy)"
        label={{ text: "3.0", unit: false }}
        topFace={[false, false]}
        rightFace={[false]}
      />,
    );

    expect(faces(container, "top")).toEqual([]);
    expect(faces(container, "right")).toEqual([]);
  });

  it("sizes a face from its own span, so a merged surface is not one cell wide", () => {
    const css = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), "../../styles/components.css"),
      "utf8",
    );
    const top = /\.placed-block__face--top\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
    const right = /\.placed-block__face--right\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
    expect(top).toMatch(/width:[^;]*--face-span/);
    expect(right).toMatch(/height:[^;]*--face-span/);
  });
});
