import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Card } from "./Card.js";

describe("Card", () => {
  it("renders its children on the neutral surface class", () => {
    render(
      <Card>
        <p>Today's run</p>
      </Card>,
    );
    expect(screen.getByText("Today's run").closest(".card")).not.toBeNull();
  });

  it("merges an additional className without dropping the base class", () => {
    render(<Card className="extra" data-testid="card" />);
    const card = screen.getByTestId("card");
    expect(card).toHaveClass("card");
    expect(card).toHaveClass("extra");
  });
});
