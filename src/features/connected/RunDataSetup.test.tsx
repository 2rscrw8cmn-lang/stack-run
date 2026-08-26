import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RunDataSetup } from "./RunDataSetup.js";

describe("Run Data setup", () => {
  it("explains the Apple Watch bridge before asking for a credential", async () => {
    const user = userEvent.setup();
    render(<RunDataSetup onConnected={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Apple Watch/ }));
    expect(screen.getByRole("heading", { name: "HealthFit" })).toBeInTheDocument();
    expect(screen.getByText(/APPLE WATCH.*APPLE HEALTH.*HEALTHFIT.*INTERVALS.ICU.*STACK/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Personal Intervals API key")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Continue" }));
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("heading", { name: "Check one run" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByLabelText("Personal Intervals API key")).toBeInTheDocument();
    expect(screen.getByText(/never uploaded to Supabase/)).toBeInTheDocument();
  });

  it("does not tell other-device runners to install HealthFit", async () => {
    const user = userEvent.setup();
    render(<RunDataSetup onConnected={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /Garmin.*COROS.*Other/ }));
    expect(screen.getByText(/You do not need HealthFit/)).toBeInTheDocument();
  });
});
