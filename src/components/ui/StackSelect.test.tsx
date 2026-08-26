import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { StackSelect } from "./StackSelect.js";

describe("StackSelect", () => {
  it("keeps native list semantics in the standardized treatment", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <label>
        Match
        <StackSelect defaultValue="extra" onChange={onChange}>
          <option value="extra">Extra Run</option>
          <option value="planned">Planned Run</option>
        </StackSelect>
      </label>,
    );

    const select = screen.getByRole("combobox", { name: "Match" });
    await user.selectOptions(select, "planned");
    expect(select).toHaveValue("planned");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
