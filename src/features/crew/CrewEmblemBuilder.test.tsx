import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  CREW_EMBLEM_INK,
  CREW_EMBLEM_SHAPES,
  DEFAULT_CREW_EMBLEM,
  decodeCrewEmblem,
  encodeCrewEmblem,
  type CrewEmblem,
} from "../../crew/emblem";
import { CrewEmblemBuilder } from "./CrewEmblemBuilder";

const emblem: CrewEmblem = decodeCrewEmblem("E2-4.2-7.0-3.5-0")!;

function tile(layerLabel: string, name: string): HTMLElement {
  return screen.getByRole("button", { name: `${name} ${layerLabel}` });
}

describe("Crew Emblem builder", () => {
  it("shows a candidate in context with the rest of the emblem", async () => {
    render(<CrewEmblemBuilder emblem={emblem} onChange={vi.fn()} />);

    const bolt = tile("main mark", "Bolt");
    const mark = bolt.querySelector("svg")!;
    // The candidate is drawn as the mark, and the layers it is not offering
    // are drawn with it so the tile shows the combination rather than a shape
    // in a void. The dimming itself is the stylesheet's job.
    expect(mark).toHaveAttribute("data-focus-layer", "main");
    expect(mark.innerHTML).toContain(
      CREW_EMBLEM_SHAPES.main[CREW_EMBLEM_SHAPES.main.findIndex((s) => s.name === "Bolt")].d,
    );
    expect(mark.innerHTML).toContain(CREW_EMBLEM_SHAPES.background[emblem.background.shape].d);
    expect(mark.innerHTML).toContain(CREW_EMBLEM_SHAPES.secondary[emblem.secondary.shape].d);
  });

  it("changes only the layer whose option was tapped", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CrewEmblemBuilder emblem={emblem} onChange={onChange} />);

    await user.click(tile("secondary", "Halo"));
    expect(onChange).toHaveBeenCalledWith({
      ...emblem,
      secondary: { ...emblem.secondary, shape: 2 },
    });

    onChange.mockClear();
    await user.click(screen.getByRole("button", { name: "Ember background color" }));
    expect(onChange).toHaveBeenCalledWith({
      ...emblem,
      background: { ...emblem.background, color: 5 },
    });
  });

  /** `None` is a real choice on both optional layers, not an absent one. */
  it("offers None on the two optional layers and nowhere else", () => {
    render(<CrewEmblemBuilder emblem={emblem} onChange={vi.fn()} />);
    expect(tile("secondary", "None")).toBeInTheDocument();
    expect(tile("background", "None")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "None main mark" })).not.toBeInTheDocument();
  });

  it("hands Surprise Me a valid, storable emblem", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CrewEmblemBuilder emblem={DEFAULT_CREW_EMBLEM} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "Surprise Me" }));
    const shuffled = onChange.mock.calls[0][0] as CrewEmblem;
    expect(decodeCrewEmblem(encodeCrewEmblem(shuffled))).toEqual(shuffled);
  });

  /**
   * The ink style is a look, not a setting, so it is offered as the emblem
   * drawn both ways rather than as a switch the owner has to imagine the
   * result of.
   */
  it("offers the ink style as the emblem drawn both ways", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<CrewEmblemBuilder emblem={emblem} onChange={onChange} />);

    const outlined = screen.getByRole("button", { name: "Outlined edges" });
    const clean = screen.getByRole("button", { name: "Clean edges" });
    expect(outlined).toHaveAttribute("aria-pressed", "true");
    expect(clean).toHaveAttribute("aria-pressed", "false");

    // Each tile draws what choosing it produces: the mark is inked in one and
    // flat in the other, both against the crew's current field.
    const inkOf = (tile: HTMLElement): number =>
      (tile.querySelector("svg")!.innerHTML.match(new RegExp(CREW_EMBLEM_INK, "g")) ?? []).length;
    expect(inkOf(clean)).toBeLessThan(inkOf(outlined));

    await user.click(clean);
    expect(onChange).toHaveBeenCalledWith({ ...emblem, outline: false });
  });

  /**
   * The rails are keyboard territory too: every option is a real button in
   * document order, so tabbing walks the library without touch.
   */
  it("keeps every option reachable as a real button", async () => {
    const user = userEvent.setup();
    render(<CrewEmblemBuilder emblem={emblem} onChange={vi.fn()} />);

    const group = screen.getByRole("group", { name: /^background$/i });
    const options = within(group).getAllByRole("button");
    expect(options).toHaveLength(CREW_EMBLEM_SHAPES.background.length);

    options[0].focus();
    await user.tab();
    expect(options[1]).toHaveFocus();
  });
});
