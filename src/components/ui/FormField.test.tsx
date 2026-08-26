import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FormField } from "./FormField.js";

describe("FormField", () => {
  it("associates the label with the input", () => {
    render(
      <FormField label="Distance">
        <input type="text" />
      </FormField>,
    );
    expect(screen.getByLabelText("Distance")).toBeInTheDocument();
  });

  it("associates a hint via aria-describedby", () => {
    render(
      <FormField label="Distance" hint="In miles">
        <input type="text" />
      </FormField>,
    );
    const input = screen.getByLabelText("Distance");
    const describedBy = input.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(screen.getByText("In miles")).toHaveAttribute(
      "id",
      describedBy,
    );
  });

  it("marks the input invalid and surfaces the error message", () => {
    render(
      <FormField label="Distance" error="Enter a distance greater than 0">
        <input type="text" />
      </FormField>,
    );
    const input = screen.getByLabelText("Distance");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(
      screen.getByRole("alert").textContent,
    ).toBe("Enter a distance greater than 0");
  });

  it("marks the input required", () => {
    render(
      <FormField label="Distance" required>
        <input type="text" />
      </FormField>,
    );
    expect(screen.getByLabelText(/Distance/)).toBeRequired();
  });
});
