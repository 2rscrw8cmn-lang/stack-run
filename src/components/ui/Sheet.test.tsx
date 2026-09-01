import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "./Sheet.js";

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

/**
 * What a sheet must be on a phone, and what it must not do to get there.
 *
 * The shape — full visible viewport, panel against the bottom edge, nothing of
 * the app below it — is CSS, and stays correct on its own while iOS Safari's
 * toolbar expands and collapses. The one thing CSS cannot see is the on-screen
 * keyboard, and the only honest signal for that is a field in this sheet
 * holding focus. Inferring it from `visualViewport` dimensions is what left a
 * read-only Crew sheet floating in the middle of the screen: browser chrome
 * changes those numbers too.
 */
describe("Sheet and the on-screen keyboard", () => {
  interface FakeViewport {
    height: number;
    offsetTop: number;
    listeners: Set<() => void>;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
    emit: () => void;
  }

  function stubVisualViewport(height: number, offsetTop = 0): FakeViewport {
    const listeners = new Set<() => void>();
    const viewport: FakeViewport = {
      height,
      offsetTop,
      listeners,
      addEventListener: (_type, listener) => listeners.add(listener),
      removeEventListener: (_type, listener) => listeners.delete(listener),
      emit: () => listeners.forEach((listener) => listener()),
    };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: viewport,
    });
    return viewport;
  }

  afterEach(() => {
    Reflect.deleteProperty(window, "visualViewport");
  });

  const dialog = () => document.querySelector("dialog.sheet") as HTMLDialogElement;

  it("leaves a read-only sheet entirely to CSS, whatever the browser chrome does", () => {
    // A viewport a good deal shorter than the window, which is what an
    // expanded Safari toolbar looks like and what the old size heuristic
    // mistook for a keyboard.
    const viewport = stubVisualViewport(Math.round(window.innerHeight * 0.6), 40);

    render(
      <Sheet title="Best Miles" isOpen onClose={vi.fn()}>
        <p>Won by Drew</p>
      </Sheet>,
    );
    act(() => viewport.emit());

    expect(dialog().style.getPropertyValue("--sheet-height")).toBe("");
    expect(dialog().style.getPropertyValue("--sheet-top")).toBe("");
  });

  it("sizes itself to the visible viewport while a field in it has focus", async () => {
    const viewport = stubVisualViewport(360, 12);
    const user = userEvent.setup();

    render(
      <Sheet title="Complete Run" isOpen onClose={vi.fn()}>
        <label>
          Distance
          <input name="distance" />
        </label>
      </Sheet>,
    );

    expect(dialog().style.getPropertyValue("--sheet-height")).toBe("");

    await user.click(screen.getByLabelText("Distance"));
    expect(dialog().style.getPropertyValue("--sheet-height")).toBe("360px");
    expect(dialog().style.getPropertyValue("--sheet-top")).toBe("12px");

    // The keyboard settling, or the sheet scrolling under it.
    viewport.height = 300;
    act(() => viewport.emit());
    expect(dialog().style.getPropertyValue("--sheet-height")).toBe("300px");
  });

  it("gives the panel back to the bottom edge the moment the field is left", async () => {
    stubVisualViewport(360, 12);
    const user = userEvent.setup();

    render(
      <Sheet title="Complete Run" isOpen onClose={vi.fn()}>
        <label>
          Distance
          <input name="distance" />
        </label>
        <button type="button">Save</button>
      </Sheet>,
    );

    await user.click(screen.getByLabelText("Distance"));
    expect(dialog().style.getPropertyValue("--sheet-height")).toBe("360px");

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(dialog().style.getPropertyValue("--sheet-height")).toBe("");
    expect(dialog().style.getPropertyValue("--sheet-top")).toBe("");
  });

  it("stops following the viewport once it closes", async () => {
    const viewport = stubVisualViewport(360, 12);
    const user = userEvent.setup();

    const { rerender } = render(
      <Sheet title="Complete Run" isOpen onClose={vi.fn()}>
        <label>
          Distance
          <input name="distance" />
        </label>
      </Sheet>,
    );
    await user.click(screen.getByLabelText("Distance"));
    expect(viewport.listeners.size).toBeGreaterThan(0);

    rerender(
      <Sheet title="Complete Run" isOpen={false} onClose={vi.fn()}>
        <label>
          Distance
          <input name="distance" />
        </label>
      </Sheet>,
    );
    expect(viewport.listeners.size).toBe(0);
  });
});
