import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./Button.js";

describe("Button", () => {
  it("renders its label and responds to a click", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(<Button onClick={onClick}>Save Run</Button>);

    const button = screen.getByRole("button", { name: "Save Run" });
    await user.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies the requested variant class", () => {
    render(<Button variant="danger">Reset</Button>);
    expect(screen.getByRole("button", { name: "Reset" })).toHaveClass(
      "button--danger",
    );
  });

  it("disables the button and marks it busy while loading", async () => {
    const onClick = vi.fn();
    const user = userEvent.setup();
    render(
      <Button isLoading onClick={onClick}>
        Save Run
      </Button>,
    );

    const button = screen.getByRole("button", { name: "Save Run" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");

    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});
