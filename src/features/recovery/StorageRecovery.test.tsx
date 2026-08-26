import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../../app/App";
import { createSeededAppState } from "../../storage/migrations";
import { APP_STATE_STORAGE_KEY } from "../../storage/storageKeys";

beforeEach(() => {
  localStorage.clear();
});

function setupUser() {
  return userEvent.setup();
}

function backupKeys() {
  return Object.keys(localStorage).filter((key) =>
    key.startsWith("stack.app-state.backup."),
  );
}

describe("unreadable stored state", () => {
  it("says so instead of silently starting over", () => {
    localStorage.setItem(APP_STATE_STORAGE_KEY, "{ not json");
    render(<App />);

    expect(
      screen.getByRole("heading", { name: "Your saved training could not be read" }),
    ).toBeInTheDocument();
    // The damaged value is still there, named, and nothing has replaced it.
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe("{ not json");
    expect(screen.getByText(backupKeys()[0])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
  });

  it("starts fresh only after a second, deliberate press", async () => {
    const user = setupUser();
    localStorage.setItem(APP_STATE_STORAGE_KEY, "{ not json");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Start Fresh" }));
    expect(localStorage.getItem(APP_STATE_STORAGE_KEY)).toBe("{ not json");

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(
      screen.getByRole("button", { name: "Start Fresh" }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Start Fresh" }));
    await user.click(screen.getByRole("button", { name: "Yes, Start Fresh" }));

    // The app is running from a valid no-plan state, and storage holds it.
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const stored = JSON.parse(localStorage.getItem(APP_STATE_STORAGE_KEY) ?? "{}");
    expect(stored.schemaVersion).toBe(11);
    expect(stored.runLogs).toEqual([]);
    // The damaged copy outlives the reset, so it is still recoverable.
    expect(backupKeys()).toHaveLength(1);
  });

  it("offers to save the damaged copy off the device", async () => {
    const user = setupUser();
    const createObjectURL = vi.fn(() => "blob:stack");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { ...URL, createObjectURL, revokeObjectURL });

    localStorage.setItem(APP_STATE_STORAGE_KEY, "{ not json");
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Save the Damaged Copy" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const [blob] = createObjectURL.mock.calls[0] as unknown as [Blob];
    expect(await blob.text()).toBe("{ not json");
    expect(screen.getByText("Saved to your downloads.")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});

describe("storage the browser will not open", () => {
  it("offers to carry on without saving", async () => {
    const user = setupUser();
    const getItem = vi
      .spyOn(Storage.prototype, "getItem")
      .mockImplementation(() => {
        throw new DOMException("The operation is insecure.", "SecurityError");
      });

    render(<App />);
    expect(
      screen.getByRole("heading", { name: "This browser will not let STACK save" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start Fresh" })).toBeNull();

    getItem.mockRestore();
    await user.click(screen.getByRole("button", { name: "Continue Without Saving" }));
    expect(screen.getByRole("button", { name: "Today" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });
});

describe("a change that could not be saved", () => {
  it("is said out loud rather than lost quietly", async () => {
    const user = setupUser();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-08-04T09:00:00"));
    const typing = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    localStorage.setItem(APP_STATE_STORAGE_KEY, JSON.stringify(createSeededAppState()));

    render(<App />);

    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("The quota has been exceeded.", "QuotaError");
      });

    await typing.click(screen.getByRole("button", { name: "Mark Complete" }));
    await typing.type(screen.getByLabelText(/Distance/), "2.1");
    await typing.type(screen.getByLabelText(/Duration/), "2030");
    await typing.click(screen.getByRole("button", { name: "Solid" }));
    await typing.click(screen.getByRole("button", { name: "Save Run" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/could not be saved/);

    setItem.mockRestore();
    vi.useRealTimers();
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
