import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StackMark } from "./StackMark.js";
import {
  STACK_RUNNER_PATHS,
  STACK_RUNNER_VIEW_BOX,
} from "./stackRunnerMark.js";

describe("StackMark", () => {
  it("keeps every face from the complete full-color runner source", () => {
    expect(STACK_RUNNER_PATHS).toHaveLength(27);
    expect(
      STACK_RUNNER_PATHS.some((path) => path.d.startsWith("M143.12,142.31")),
    ).toBe(true);
    expect(
      STACK_RUNNER_PATHS.some((path) => path.d.startsWith("M213.3,200.01")),
    ).toBe(true);
    expect(STACK_RUNNER_PATHS.some((path) => path.fill === "#381c8b")).toBe(true);
  });

  it("renders the canonical runner without distorting its proportions", () => {
    const { container } = render(<StackMark size={64} />);
    const mark = container.querySelector("svg");

    expect(mark).toHaveAttribute(
      "viewBox",
      `0 0 ${STACK_RUNNER_VIEW_BOX.width} ${STACK_RUNNER_VIEW_BOX.height}`,
    );
    expect(mark).toHaveAttribute("height", "64");
    expect(Number(mark?.getAttribute("width"))).toBeCloseTo(
      (64 * STACK_RUNNER_VIEW_BOX.width) / STACK_RUNNER_VIEW_BOX.height,
    );
    expect(mark?.querySelectorAll("path")).toHaveLength(STACK_RUNNER_PATHS.length);
    expect(mark?.querySelectorAll("rect")).toHaveLength(0);
  });

  it("stays decorative when the adjacent STACK wordmark names the lockup", () => {
    const { container } = render(<StackMark />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
