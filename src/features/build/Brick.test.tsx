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
