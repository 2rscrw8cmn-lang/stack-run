import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProgressBar } from "./ProgressBar";

describe("ProgressBar", () => {
  it("exposes value, max, and an accessible label", () => {
    render(<ProgressBar value={3} max={7} label="Week 6 progress" />);
    const bar = screen.getByRole("progressbar", { name: "Week 6 progress" });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "7");
  });

  it("clamps an out-of-range value into the valid range", () => {
    render(<ProgressBar value={99} max={7} label="Week 6 progress" />);
    expect(
      screen.getByRole("progressbar", { name: "Week 6 progress" }),
    ).toHaveAttribute("aria-valuenow", "7");
  });
});
