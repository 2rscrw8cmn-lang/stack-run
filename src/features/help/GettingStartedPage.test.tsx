import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GettingStartedPage } from "./GettingStartedPage";

describe("GettingStartedPage", () => {
  it("leads staff through the two supported fitness-data paths", () => {
    render(<GettingStartedPage />);

    expect(
      screen.getByRole("heading", { name: /Connect your runs/i, level: 1 }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Apple Watch setup" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Other watch setup" })).toBeInTheDocument();
    expect(screen.getAllByText(/APPLE WATCH/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Intervals\.icu/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Developer Settings/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Test Connection/).length).toBeGreaterThan(0);
  });

  it("explains the first-run workflow and Crew privacy boundary", () => {
    render(<GettingStartedPage />);

    expect(
      screen.getByRole("heading", { name: "When STACK finds your first run" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Add as Extra Run/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "What your Crew can see" })).toBeInTheDocument();
    expect(screen.getByText("GPS route or location")).toBeInTheDocument();
    expect(screen.getByText("Your Intervals API key")).toBeInTheDocument();
  });

  it("links back to the app and directly to Intervals.icu", () => {
    render(<GettingStartedPage />);

    expect(screen.getByRole("link", { name: "Open app" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Open Intervals.icu" })).toHaveAttribute(
      "href",
      "https://intervals.icu",
    );
  });
});
