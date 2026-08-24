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
            kind: "best5k",
            value: 1290,
            runCount: null,
            runner: ZACK,
            localDate: "2026-08-11",
            activityType: "easy",
            runId: "quick",
          },
          {
            kind: "longestRun",
            value: 12,
            runCount: null,
            runner: DREW,
            localDate: "2026-08-12",
            activityType: "long",
            runId: "b",
          },
          {
            kind: "bestPace",
            value: 450,
            runCount: null,
            runner: ZACK,
            localDate: "2026-08-13",
            activityType: "easy",
            runId: "quick",
          },
          {
            kind: "biggestCrewDay",
            value: 9.5,
            runCount: 3,
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
  it("walks six pages in the new order, each with its own job", async () => {
    const user = userEvent.setup();
    const dialog = open();

    // 1 — Together: the week, the mileage, the scoreboard, participation.
    expect(within(dialog).getByText("Page 1 of 6")).toBeInTheDocument();
    expect(within(dialog).getByText("21.0")).toBeInTheDocument();
    expect(within(dialog).getByText("TOGETHER")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 10 – Aug 16")).toBeInTheDocument();
    // Participation is folded in here rather than taking a page of its own.
    expect(within(dialog).getByText("FULL CREW · 2 / 2")).toBeInTheDocument();
    const scoreboard = within(dialog).getByText("Hours").closest("dl")!;
    expect(within(scoreboard).getByText("3")).toBeInTheDocument();
    expect(within(scoreboard).getByText("3:20")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Back/ })).toBeDisabled();

    const next = within(dialog).getByRole("button", { name: /Next/ });

    // 2 — Best Performances: a hero effort plus the rest, led by the facts the
    // opening page could not give.
    await user.click(next);
    expect(within(dialog).getByText("Best Performances")).toBeInTheDocument();
    expect(within(dialog).getByText("Fastest 5K")).toBeInTheDocument();
    expect(within(dialog).getByText("21:30")).toBeInTheDocument();
    // The equivalent pace is the same verified 5K result per mile, not a
    // second measurement — and never the run's own average pace.
    expect(within(dialog).getByText(/TUESDAY · 6:55 \/MI/i)).toBeInTheDocument();
    expect(within(dialog).getByText("Longest Run")).toBeInTheDocument();
    expect(within(dialog).getByText("12")).toBeInTheDocument();
    expect(within(dialog).getByText("Wednesday")).toBeInTheDocument();
    expect(within(dialog).getByText("Fastest Avg Pace")).toBeInTheDocument();
    expect(within(dialog).getByText("7:30 /MI")).toBeInTheDocument();
    expect(within(dialog).getByText("2+ MI RUN")).toBeInTheDocument();
    // The crew-level effort names a day and its run count, not a runner.
    expect(within(dialog).getByText("Biggest Crew Day")).toBeInTheDocument();
    expect(within(dialog).getByText(/THURSDAY · 3 RUNS/i)).toBeInTheDocument();

    // 3 — Added to the Build: the real tower crop.
    await user.click(next);
    expect(within(dialog).getByText("Added To The Build")).toBeInTheDocument();
    expect(within(dialog).getByText("+2")).toBeInTheDocument();
    expect(within(dialog).getByText(/17.0 MI BUILT/i)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("img", { name: /2 blocks this week added 17.0 miles/ }),
    ).toBeInTheDocument();

    // 4 — Awards, by that name.
    await user.click(next);
    expect(within(dialog).getByText("Awards")).toBeInTheDocument();
    expect(within(dialog).getByText("Most Miles")).toBeInTheDocument();
    expect(within(dialog).getByText("21.4 MI")).toBeInTheDocument();

    // 5 — Against Last Week: the delta, then the two weeks it compares.
    await user.click(next);
    expect(within(dialog).getByText("Against Last Week")).toBeInTheDocument();
    expect(within(dialog).getByText("+11.0")).toBeInTheDocument();
    expect(within(dialog).getByText("Last Week")).toBeInTheDocument();
    expect(within(dialog).getByText("This Week")).toBeInTheDocument();

    // 6 — the handoff into the week already being run.
    await user.click(next);
    expect(within(dialog).getByText("NEW WEEK LIVE")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 17 – Aug 23")).toBeInTheDocument();
    expect(within(dialog).getByText("Page 6 of 6")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Done" })).toBeInTheDocument();
  });

  it("finishes without repeating the Build or the week's totals", async () => {
    const user = userEvent.setup();
    const dialog = open();
    for (let step = 0; step < 5; step += 1) {
      await user.click(within(dialog).getByRole("button", { name: /^Next/ }));
    }
    // The old finish repeated the emblem, the same mileage/runs/runners the
    // opening page had already given at display size, and the Build crop page
    // three had just animated. Evolution 2.1 removed all three.
    expect(within(dialog).queryByText("WEEK COMPLETE")).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/21.0 MI · 3 RUNS · 2 RUNNERS/)).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("img", { name: /blocks this week/ })).not.toBeInTheDocument();
  });

  it("never states a 5K for a week whose runs carry none", async () => {
    const user = userEvent.setup();
    const model = recap();
    const performances = model.beats.find((item) => item.kind === "performances")!;
    const dialog = open(
      recap({
        beats: model.beats.map((item) =>
          item === performances
            ? { ...performances, items: performances.items.filter((entry) => entry.kind !== "best5k") }
            : item,
        ),
      }),
    );
    await user.click(within(dialog).getByRole("button", { name: /^Next/ }));
    expect(within(dialog).getByText("Best Performances")).toBeInTheDocument();
    // Not a zero, not a dash, not an estimate from the totals: absent.
    expect(within(dialog).queryByText("Fastest 5K")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Longest Run")).toBeInTheDocument();
  });

  it("carries page identity on the sheet itself, so the backdrop is the whole panel", async () => {
    const user = userEvent.setup();
    const dialog = open();
    const seen: string[] = [];

    for (;;) {
      // The class lives on the dialog, above `.sheet__header` and
      // `.sheet__body` — not on a box inside the content.
      seen.push(
        [...dialog.classList].find((name) =>
          name.startsWith("sheet--crew-recap--"),
        )!,
      );
      const next = within(dialog).queryByRole("button", { name: /^Next/ });
      if (!next) break;
      await user.click(next);
    }

    expect(seen).toEqual([
      "sheet--crew-recap--together",
      "sheet--crew-recap--performances",
      "sheet--crew-recap--build",
      "sheet--crew-recap--awards",
      "sheet--crew-recap--change",
      "sheet--crew-recap--nextWeek",
    ]);
  });

  it("says nothing the page already shows", () => {
    const dialog = open();
    // Three sentences an earlier pass used to explain visuals that speak for
    // themselves. None of them belongs on a page of facts.
    expect(within(dialog).queryByText(/where the whole crew can see them/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/more miles than last week/)).not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Great work/)).not.toBeInTheDocument();
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

    expect(within(dialog).getByText("FULL CREW · 11 / 11")).toBeInTheDocument();
    const row = within(dialog).getByRole("list", {
      name: "Everyone in the crew ran this week",
    });
    // Six marks and a count, never eleven marks and a broken line.
    expect(within(row).getAllByRole("listitem")).toHaveLength(7);
    expect(within(row).getByText("+5")).toBeInTheDocument();
  });

  it("names the crew and the week it is recapping", () => {
    const dialog = open();
    expect(within(dialog).getByText("Night Shift · Week Recap")).toBeInTheDocument();
    expect(within(dialog).getByText("Aug 10 – Aug 16")).toBeInTheDocument();
  });
});
