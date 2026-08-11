import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet";

describe("Sheet", () => {
  it("is hidden when closed and visible with its title when open", () => {
    const { rerender } = render(
      <Sheet title="Complete Run" isOpen={false} onClose={vi.fn()}>
        <p>Body</p>
      </Sheet>,
    );
    expect(
      screen.queryByRole("heading", { name: "Complete Run" }),
    ).not.toBeInTheDocument();

    rerender(
      <Sheet title="Complete Run" isOpen onClose={vi.fn()}>
        <p>Body</p>
      </Sheet>,
    );
    expect(
      screen.getByRole("heading", { name: "Complete Run" }),
    ).toHaveFocus();
  });

  it("calls onClose when the close control is activated", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Sheet title="Complete Run" isOpen onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when guardClose reports unsaved changes", async () => {
    const onClose = vi.fn();
    const guardClose = vi.fn().mockReturnValue(false);
    const user = userEvent.setup();
    render(
      <Sheet title="Complete Run" isOpen onClose={onClose} guardClose={guardClose}>
        <p>Body</p>
      </Sheet>,
    );

    await user.click(screen.getByRole("button", { name: "Close" }));
    expect(guardClose).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(
      screen.getByRole("heading", { name: "Complete Run" }),
    ).toBeInTheDocument();
  });

  it("closes on Escape when there is nothing to guard", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <Sheet title="Complete Run" isOpen onClose={onClose}>
        <p>Body</p>
      </Sheet>,
    );

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
