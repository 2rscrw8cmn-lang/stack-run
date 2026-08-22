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
        kind: "performances",
        items: [
          {
            kind: "longestRun",
            value: 12,
            runner: DREW,
            localDate: "2026-08-12",
            activityType: "long",
            runId: "b",
          },
          {
            kind: "bestPace",
            value: 450,
            runner: ZACK,
            localDate: "2026-08-13",
            activityType: "easy",
            runId: "quick",
          },
          {
            kind: "busiestDay",
            value: 3,
            runner: null,
            localDate: "2026-08-13",
            activityType: null,
            runId: null,
          },
        ],
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
      { kind: "change", previousMiles: 10, deltaMiles: 11, percent: 110 },
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
  it("walks six pages in the new order, each with its own job", async () => {
    const user = userEvent.setup();
    const dialog = open();

    // 1 — Together: the week, the mileage, the scoreboard, participation.
    expect(within(dialog).getByText("Page 1 of 6")).toBeInTheDocument();
    expect(within(dialog).getByText("21.0")).toBeInTheDocument();
    expect(within(dialog).getByText("TOGETHER")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 10 – Aug 16")).toBeInTheDocument();
    // Participation is folded in here rather than taking a page of its own.
    expect(within(dialog).getByText("Everyone ran this week.")).toBeInTheDocument();
    const scoreboard = within(dialog).getByText("On Your Feet").closest("dl")!;
    expect(within(scoreboard).getByText("3")).toBeInTheDocument();
    expect(within(scoreboard).getByText("3:20")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Back/ })).toBeDisabled();

    const next = within(dialog).getByRole("button", { name: /Next/ });

    // 2 — Best Performances: a hero effort plus the rest.
    await user.click(next);
    expect(within(dialog).getByText("Best Performances")).toBeInTheDocument();
    expect(within(dialog).getByText("Longest Run")).toBeInTheDocument();
    expect(within(dialog).getByText("12")).toBeInTheDocument();
    expect(within(dialog).getByText(/WEDNESDAY · LONG RUN/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Best Avg. Pace")).toBeInTheDocument();
    expect(within(dialog).getByText("7:30 /MI")).toBeInTheDocument();
    expect(within(dialog).getByText(/FROM 2 MI\+/)).toBeInTheDocument();
    // The crew-level effort names a day, not a runner.
    expect(within(dialog).getByText("Busiest Day")).toBeInTheDocument();

    // 3 — Added to the Build: the real tower crop.
    await user.click(next);
    expect(within(dialog).getByText("Added To The Build")).toBeInTheDocument();
    expect(within(dialog).getByText("+2")).toBeInTheDocument();
    expect(within(dialog).getByText(/17.0 MI STANDING IN THE TOWER/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: /2 blocks this week added 17.0 miles/ }),
    ).toBeInTheDocument();

    // 4 — Awards, by that name.
    await user.click(next);
    expect(within(dialog).getByText("Awards")).toBeInTheDocument();
    expect(within(dialog).getByText("Most Miles")).toBeInTheDocument();
    expect(within(dialog).getByText("21.4 MI")).toBeInTheDocument();

    // 5 — Against Last Week, with the percentage reading.
    await user.click(next);
    expect(within(dialog).getByText("Against Last Week")).toBeInTheDocument();
    expect(within(dialog).getByText("+11.0")).toBeInTheDocument();
    expect(within(dialog).getByText("110%")).toBeInTheDocument();

    // 6 — the finish.
    await user.click(next);
    expect(within(dialog).getByText("WEEK COMPLETE")).toBeInTheDocument();
    expect(within(dialog).getByText("Great work, Night Shift.")).toBeInTheDocument();
    expect(within(dialog).getByText("Page 6 of 6")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("gives every page its own backdrop", async () => {
    const user = userEvent.setup();
    const dialog = open();
    const backdrop = dialog.querySelector(".crew-recap__backdrop")!;
    const seen: string[] = [];

    for (;;) {
      seen.push(backdrop.getAttribute("data-page")!);
      const next = within(dialog).queryByRole("button", { name: /^Next/ });
      if (!next) break;
      await user.click(next);
    }

    expect(seen).toEqual([
      "together",
      "performances",
      "build",
      "awards",
      "change",
      "complete",
    ]);
  });

  it("steps back through the story it just told", async () => {
    const user = userEvent.setup();
    const dialog = open();
    await user.click(within(dialog).getByRole("button", { name: /Next/ }));
    await user.click(within(dialog).getByRole("button", { name: /Back/ }));
    expect(within(dialog).getByText("TOGETHER")).toBeInTheDocument();
    expect(within(dialog).getByText("Page 1 of 6")).toBeInTheDocument();
  });

  it("drops pages a sparse week cannot fill, keeping the opening and the finish", () => {
    const dialog = open(
      recap({
        totals: { miles: 3.1, runs: 1, durationSeconds: 1800, activeRunners: 1 },
        beats: [],
      }),
    );
    expect(within(dialog).getByText("Page 1 of 2")).toBeInTheDocument();
    expect(within(dialog).getByText("3.1")).toBeInTheDocument();
    expect(within(dialog).queryByText("Added To The Build")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Best Performances")).not.toBeInTheDocument();
  });

  it("counts the overflow rather than growing a row for a large crew", () => {
    const roster = Array.from({ length: 11 }, (_, index) => ({
      userId: `runner-${index}`,
      displayName: `Runner ${index}`,
      accentColor: null,
      runnerIcon: ICON,
    }));
    const dialog = open(
      recap({
        beats: [
          {
            kind: "participation",
            everyoneRan: true,
            activeRunners: 11,
            rosterSize: 11,
            runners: roster,
          },
        ],
      }),
    );

    const row = within(dialog).getByRole("list", {
      name: "Everyone in the crew ran this week",
    });
    // Seven marks and a count, never eleven marks and a broken line.
    expect(within(row).getAllByRole("listitem")).toHaveLength(8);
    expect(within(row).getByText("+4")).toBeInTheDocument();
  });

  it("names the crew and the week it is recapping", () => {
    const dialog = open();
    expect(within(dialog).getByText("Night Shift · Week Recap")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 10 – Aug 16")).toBeInTheDocument();
  });
});
