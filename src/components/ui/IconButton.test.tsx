import { render, screen } from "@testing-library/react";
import { X } from "lucide-react";
import { describe, expect, it } from "vitest";
import { IconButton } from "./IconButton.js";

describe("IconButton", () => {
  it("exposes the required accessible label", () => {
    render(<IconButton label="Close" icon={<X />} />);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("meets the minimum 44x44 touch target via its class", () => {
    render(<IconButton label="Close" icon={<X />} />);
    expect(screen.getByRole("button", { name: "Close" })).toHaveClass(
      "icon-button",
    );
  });

  it("hides the decorative icon from assistive tech", () => {
    render(<IconButton label="Close" icon={<X data-testid="icon" />} />);
    const icon = screen.getByTestId("icon");
    expect(icon.closest("[aria-hidden='true']")).not.toBeNull();
  });
});
