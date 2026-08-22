import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CREW_EMBLEM } from "../../crew/emblem";
import type { CrewWeekRecap } from "../../crew/weekRecap";
import { CrewWeekRecapSheet } from "./CrewWeekRecapSheet";

const ICON = { head: 0, face: 0, body: 0, flair: 0, background: 0 };
const ZACK = { userId: "zack", displayName: "Zack", accentColor: null, runnerIcon: ICON };
const DREW = { userId: "drew", displayName: "Drew", accentColor: null, runnerIcon: ICON };

function recap(overrides: Partial<CrewWeekRecap> = {}): CrewWeekRecap {
  return {
    crewId: "crew-1",
    crewName: "Night Shift",
    weekStart: "2026-08-10",
    weekEnd: "2026-08-16",
    totals: { miles: 21, runs: 3, durationSeconds: 12000, activeRunners: 2 },
    beats: [
      {
        kind: "participation",
        everyoneRan: true,
        activeRunners: 2,
        rosterSize: 2,
        runners: [ZACK, DREW],
      },
      {
        kind: "longestRun",
        runId: "b",
        distanceMiles: 12,
        activityType: "long",
        localDate: "2026-08-12",
        runner: DREW,
      },
      {
        kind: "build",
        blocksPlaced: 2,
        milesPlaced: 17,
        courses: 2,
        slice: [
          { id: "a", userId: "zack", accentColor: null, activityType: "easy", width: 2, height: 1, columnStart: 1, row: 0 },
          { id: "b", userId: "drew", accentColor: null, activityType: "long", width: 3, height: 1, columnStart: 3, row: 1 },
        ],
      },
      {
        kind: "specialBlocks",
        awards: [{ id: "award-1", awardType: "miles", resultValue: 21.4, winner: DREW }],
      },
      { kind: "change", previousMiles: 10, deltaMiles: 11 },
    ],
    ...overrides,
  };
}

function open(model = recap()) {
  render(
    <CrewWeekRecapSheet
      recap={model}
      emblem={DEFAULT_CREW_EMBLEM}
      isOpen
      onClose={vi.fn()}
    />,
  );
  return screen.getByRole("dialog");
}

describe("Crew Week Recap sheet", () => {
  it("walks the week's beats one frame at a time, in editorial order", async () => {
    const user = userEvent.setup();
    const dialog = open();

    expect(within(dialog).getByText("1 / 6")).toBeInTheDocument();
    expect(within(dialog).getByText("Together")).toBeInTheDocument();
    expect(within(dialog).getByText("21.0")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Back/ })).toBeDisabled();

    const next = within(dialog).getByRole("button", { name: /Next/ });
    await user.click(next);
    expect(within(dialog).getByText("Everyone Ran")).toBeInTheDocument();
    expect(within(dialog).getByText("Nobody sat this week out.")).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog).getByText("Longest Run")).toBeInTheDocument();
    expect(within(dialog).getByText(/Long Run · Wednesday/)).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog).getByText("Added To The Build")).toBeInTheDocument();
    expect(
      within(dialog).getByText("17.0 mi of this week is standing in the tower."),
    ).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog).getByText("Special Block")).toBeInTheDocument();
    expect(within(dialog).getByText("Most Miles")).toBeInTheDocument();
    expect(within(dialog).getByText(/Drew · 21.4 MI/)).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog).getByText("Against Last Week")).toBeInTheDocument();
    expect(within(dialog).getByText("+11.0")).toBeInTheDocument();
    expect(within(dialog).getByText("6 / 6")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("steps back through the story it just told", async () => {
    const user = userEvent.setup();
    const dialog = open();
    await user.click(within(dialog).getByRole("button", { name: /Next/ }));
    await user.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(within(dialog).getByText("Together")).toBeInTheDocument();
    expect(within(dialog).getByText("1 / 6")).toBeInTheDocument();
  });

  it("is a one-frame recap when a sparse week supports only the totals", () => {
    const dialog = open(
      recap({
        totals: { miles: 3.1, runs: 1, durationSeconds: 1800, activeRunners: 1 },
        beats: [],
      }),
    );
    expect(within(dialog).getByText("1 / 1")).toBeInTheDocument();
    expect(within(dialog).getByText("1 run · 0:30 on your feet · 1 runner")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("names the crew and the week it is recapping", () => {
    const dialog = open();
    expect(within(dialog).getByText("Night Shift · Week Recap")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 10 – Aug 16")).toBeInTheDocument();
  });
});
