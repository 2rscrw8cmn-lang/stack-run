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
          { id: "a", userId: "zack", accentColor: null, activityType: "easy", distanceMiles: 4.2, source: "intervals", width: 2, height: 1, columnStart: 1, row: 0 },
          { id: "b", userId: "drew", accentColor: null, activityType: "long", distanceMiles: 13.1, source: null, width: 3, height: 1, columnStart: 3, row: 1 },
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

    expect(within(dialog).getByText("Frame 1 of 6")).toBeInTheDocument();
    // The opening leads with the week's mileage and the week it belongs to.
    expect(within(dialog).getByText("21.0")).toBeInTheDocument();
    expect(within(dialog).getByText("TOGETHER")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 10 – Aug 16")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Back/ })).toBeDisabled();

    const next = within(dialog).getByRole("button", { name: /Next/ });
    await user.click(next);
    expect(within(dialog).getByText("EVERYONE RAN")).toBeInTheDocument();
    // The scoreboard is one composition of three readings, not three cards.
    const scoreboard = within(dialog).getByText("On Your Feet").closest("dl")!;
    expect(within(scoreboard).getByText("3")).toBeInTheDocument();
    expect(within(scoreboard).getByText("2")).toBeInTheDocument();
    expect(within(scoreboard).getByText("3:20")).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog).getByText("Longest Run")).toBeInTheDocument();
    expect(within(dialog).getByText("12")).toBeInTheDocument();
    expect(within(dialog).getByText(/LONG RUN · WEDNESDAY/i)).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog).getByText("Added To The Build")).toBeInTheDocument();
    expect(within(dialog).getByText("+2")).toBeInTheDocument();
    expect(within(dialog).getByText(/17.0 MI STANDING IN THE TOWER/i)).toBeInTheDocument();
    // The crop is the real tower construction, not a local bar chart.
    expect(
      within(dialog).getByRole("img", { name: /2 blocks this week added 17.0 miles/ }),
    ).toBeInTheDocument();

    await user.click(next);
    expect(within(dialog).getByText("Special Block")).toBeInTheDocument();
    expect(within(dialog).getByText("Most Miles")).toBeInTheDocument();
    expect(within(dialog).getByText("Drew")).toBeInTheDocument();
    expect(within(dialog).getByText("21.4 MI")).toBeInTheDocument();

    // Week over week closes the recap rather than standing as its own frame.
    await user.click(next);
    expect(within(dialog).getByText("Against Last Week")).toBeInTheDocument();
    expect(within(dialog).getByText("+11.0")).toBeInTheDocument();
    expect(within(dialog).getByText("WEEK COMPLETE")).toBeInTheDocument();
    expect(within(dialog).getByText("Nice work, Night Shift.")).toBeInTheDocument();
    expect(within(dialog).getByText("Frame 6 of 6")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("steps back through the story it just told", async () => {
    const user = userEvent.setup();
    const dialog = open();
    await user.click(within(dialog).getByRole("button", { name: /Next/ }));
    await user.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(within(dialog).getByText("TOGETHER")).toBeInTheDocument();
    expect(within(dialog).getByText("Frame 1 of 6")).toBeInTheDocument();
  });

  it("is a one-frame recap when a sparse week supports only the totals", () => {
    const dialog = open(
      recap({
        totals: { miles: 3.1, runs: 1, durationSeconds: 1800, activeRunners: 1 },
        beats: [],
      }),
    );
    // Totals plus the close — no beat has evidence, so no beat gets a frame.
    expect(within(dialog).getByText("Frame 1 of 2")).toBeInTheDocument();
    expect(within(dialog).getByText("3.1")).toBeInTheDocument();
    expect(within(dialog).getByText(/1 RUN · 1 RUNNER · 0:30/)).toBeInTheDocument();
    expect(within(dialog).queryByText("Added To The Build")).not.toBeInTheDocument();
  });

  it("names the crew and the week it is recapping", () => {
    const dialog = open();
    expect(within(dialog).getByText("Night Shift · Week Recap")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 10 – Aug 16")).toBeInTheDocument();
  });

  it("ties a Special Block to the longest run only when the same runner won it", async () => {
    const user = userEvent.setup();
    const dialog = open(
      recap({
        beats: [
          {
            kind: "longestRun",
            runId: "b",
            distanceMiles: 13.1,
            activityType: "long",
            localDate: "2026-08-12",
            runner: DREW,
          },
          {
            kind: "specialBlocks",
            awards: [
              { id: "a1", awardType: "longHaul", resultValue: 13.1, winner: DREW },
            ],
          },
        ],
      }),
    );

    await user.click(within(dialog).getByRole("button", { name: /Next/ }));
    expect(within(dialog).getByText("Long Haul Special Block")).toBeInTheDocument();
  });

  it("shows no Special Block beside a longest run somebody else's award", async () => {
    const user = userEvent.setup();
    const dialog = open(
      recap({
        beats: [
          {
            kind: "longestRun",
            runId: "b",
            distanceMiles: 13.1,
            activityType: "long",
            localDate: "2026-08-12",
            runner: DREW,
          },
          {
            kind: "specialBlocks",
            awards: [
              { id: "a1", awardType: "longHaul", resultValue: 9.4, winner: ZACK },
            ],
          },
        ],
      }),
    );

    await user.click(within(dialog).getByRole("button", { name: /Next/ }));
    expect(within(dialog).queryByText(/Special Block$/)).not.toBeInTheDocument();
  });
});
