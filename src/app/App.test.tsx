import { render, screen } from "@testing-library/react";
import userEventModule from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { App } from "./App";

describe("App", () => {
  it("shows the Today placeholder by default", () => {
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "Today" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Today" }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("switches to the Build and Plan placeholders on tap", async () => {
    const user = userEventModule.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "Build" }));
    expect(screen.getByRole("heading", { name: "Build" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Build" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    await user.click(screen.getByRole("button", { name: "Plan" }));
    expect(screen.getByRole("heading", { name: "Plan" })).toBeInTheDocument();
  });
});
