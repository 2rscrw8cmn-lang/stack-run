import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_CREW_EMBLEM } from "../../crew/emblem";
import type { CrewDashboardData, CrewMember, CrewSharedRun } from "../../crew/types";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { loadSeenCrewRecapKeys } from "../../storage/crewRecapAcknowledgementRepository";
import { CrewRecapNotification } from "./CrewRecapNotification";

const ICON = { head: 0, face: 0, body: 0, flair: 0, background: 0 };

/** Monday of the week after the recapped Monday–Sunday week (Aug 10–16). */
const MONDAY_AFTER = "2026-08-17";
const MONDAY_AFTER_ROLLOVER = new Date("2026-08-17T10:00:00Z");

function member(userId: string, displayName: string): CrewMember {
  return {
    userId,
    role: userId === "zack" ? "owner" : "member",
    joinedAt: "2026-06-01T00:00:00Z",
    displayName,
    accentColor: null,
    runnerIcon: ICON,
  };
}

function run(
  id: string,
  userId: string,
  localDate: string,
  overrides: Partial<CrewSharedRun> = {},
): CrewSharedRun {
  return {
    id,
    localRunId: `local-${id}`,
    userId,
    displayName: userId === "zack" ? "Zack" : "Drew",
    accentColor: null,
    runnerIcon: ICON,
    localDate,
    activityType: "easy",
    distanceMiles: 5,
    durationSeconds: 2700,
    createdAt: `${localDate}T12:00:00Z`,
    updatedAt: `${localDate}T12:00:00Z`,
    buildRow: null,
    buildColumnStart: null,
    crewBuildRow: null,
    crewBuildColumnStart: null,
    crewBuildPlacedAt: null,
    propsCount: 0,
    viewerHasPropped: false,
    ...overrides,
  };
}

function controller(
  runs: CrewSharedRun[],
  overrides: { sharedRunsAvailable?: boolean } = {},
): RaceCrewController {
  const dashboard: CrewDashboardData = {
    members: [member("zack", "Zack"), member("drew", "Drew")],
    summaries: [],
    runs,
    miniBuildRuns: [],
    crewBuildRuns: [],
    sharedRunsAvailable: overrides.sharedRunsAvailable ?? true,
    sharedRunsTruncated: false,
    propsAvailable: true,
    propNotifications: [],
    loadedAt: `${MONDAY_AFTER}T08:00:00Z`,
  };
  return {
    status: "signed-in",
    account: {
      profile: { id: "zack", displayName: "Zack" },
      crew: {
        id: "crew-1",
        name: "Night Shift",
        buildStartDate: "2026-06-01",
        emblem: DEFAULT_CREW_EMBLEM,
      },
    },
    crewData: dashboard,
  } as unknown as RaceCrewController;
}

const WEEK_RUNS = [
  run("a", "zack", "2026-08-10", { distanceMiles: 5, durationSeconds: 2700 }),
  run("b", "drew", "2026-08-12", {
    distanceMiles: 12,
    durationSeconds: 7200,
    activityType: "long",
    best5kSeconds: 1290,
  }),
  run("c", "zack", "2026-08-15", { distanceMiles: 4, durationSeconds: 2100 }),
];

function notification(
  props: Partial<{ runs: CrewSharedRun[]; today: string; now: Date }> = {},
) {
  return render(
    <CrewRecapNotification
      crew={controller(props.runs ?? WEEK_RUNS)}
      today={props.today ?? MONDAY_AFTER}
      now={props.now ?? MONDAY_AFTER_ROLLOVER}
    />,
  );
}

/** Scoped to the notification's own list: the open recap has a progress rail. */
function row(): HTMLElement {
  return within(
    document.querySelector<HTMLElement>(".crew-recap-notification__list")!,
  ).getByRole("listitem");
}

/**
 * Clearing plays the same exit a completed swipe does, so the row leaves the
 * DOM only once it has visibly left the screen. Waited for rather than slept
 * through: a fixed delay races the exit timer under load.
 */
async function clearRow(): Promise<void> {
  fireEvent.click(screen.getByRole("button", { name: /^Clear: Week Recap/ }));
  await waitFor(() =>
    expect(document.querySelector(".crew-recap-notification__list")).toBeNull(),
  );
}

describe("Crew Week Recap notification", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("states the closed week's headline facts rather than announcing itself", () => {
    notification();
    const section = screen.getByRole("heading", { level: 2 }).closest("section")!;
    expect(within(section).getByText("Week Recap")).toBeInTheDocument();
    expect(within(section).getByText(/WEEK RECAP · Aug 10 – Aug 16/)).toBeInTheDocument();
    expect(within(section).getByText("21.0 MI · 3 RUNS")).toBeInTheDocument();
  });

  it("arrives unread, and opening it clears the unread treatment for good", async () => {
    const user = userEvent.setup();
    const { unmount } = notification();
    expect(row()).toHaveAttribute("data-unread", "true");

    await user.click(screen.getByRole("button", { name: /WEEK RECAP/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Night Shift · Week Recap")).toBeInTheDocument();
    // Seen, not hidden: the row stays, and the recap can be replayed.
    expect(row()).not.toHaveAttribute("data-unread");
    expect(loadSeenCrewRecapKeys("zack").has("crew-1:2026-08-10")).toBe(true);

    unmount();
    notification();
    expect(row()).not.toHaveAttribute("data-unread");
  });

  it("opens the same derived recap Today does, including the week's 5K", async () => {
    const user = userEvent.setup();
    notification();
    await user.click(screen.getByRole("button", { name: /WEEK RECAP/ }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Next/ }));
    expect(within(dialog).getByText("Fastest 5K")).toBeInTheDocument();
    expect(within(dialog).getByText("21:30")).toBeInTheDocument();
  });

  it("clears for good when the runner clears it, and mutates no Crew fact", async () => {
    const crew = controller(WEEK_RUNS);
    const { unmount } = render(
      <CrewRecapNotification crew={crew} today={MONDAY_AFTER} now={MONDAY_AFTER_ROLLOVER} />,
    );

    await clearRow();
    expect(screen.queryByText(/WEEK RECAP/)).not.toBeInTheDocument();

    unmount();
    notification();
    expect(screen.queryByText(/WEEK RECAP/)).not.toBeInTheDocument();
    // Clearing is a statement about this screen. The shared week is untouched.
    expect(crew.crewData!.runs).toHaveLength(3);
    expect(crew.crewData!.runs.every((item) => item.crewBuildRow === null)).toBe(true);
  });

  it("holds the Monday recap until 06:00 Eastern, then ages out with the window", () => {
    const before = notification({ now: new Date("2026-08-17T09:59:59Z") });
    expect(screen.queryByText(/WEEK RECAP/)).not.toBeInTheDocument();
    before.unmount();

    notification();
    expect(screen.getByText(/WEEK RECAP/)).toBeInTheDocument();
  });

  it("is absent before the week closes and after Wednesday", () => {
    const during = notification({ today: "2026-08-16", now: new Date("2026-08-16T16:00:00Z") });
    expect(screen.queryByText(/WEEK RECAP · Aug 10/)).not.toBeInTheDocument();
    during.unmount();

    const wednesday = notification({ today: "2026-08-19", now: new Date("2026-08-19T16:00:00Z") });
    expect(screen.getByText(/WEEK RECAP · Aug 10/)).toBeInTheDocument();
    wednesday.unmount();

    notification({ today: "2026-08-20", now: new Date("2026-08-20T16:00:00Z") });
    expect(screen.queryByText(/WEEK RECAP · Aug 10/)).not.toBeInTheDocument();
  });

  it("renders nothing for a week with no shared running, or an unreachable read", () => {
    const quiet = notification({ runs: [run("old", "zack", "2026-08-03")] });
    expect(screen.queryByText(/WEEK RECAP/)).not.toBeInTheDocument();
    quiet.unmount();

    render(
      <CrewRecapNotification
        crew={controller(WEEK_RUNS, { sharedRunsAvailable: false })}
        today={MONDAY_AFTER}
        now={MONDAY_AFTER_ROLLOVER}
      />,
    );
    expect(screen.queryByText(/WEEK RECAP/)).not.toBeInTheDocument();
  });

  /**
   * The addendum to issue #186: the owner has to be able to review this on
   * demand, from a phone, without waiting for a real Monday 06:00 ET or having
   * the right Crew data in place.
   */
  it("reviews unread → open → cleared on a preview host with no crew at all", async () => {
    const user = userEvent.setup();
    // jsdom serves localhost, which is a preview review host.
    window.history.replaceState({}, "", "/?demo=recap");

    // Saturday, and no crew: neither would produce a live recap.
    render(<CrewRecapNotification crew={null} today="2026-08-22" />);

    expect(screen.getByText(/RECAP DEMO · FAKE CREW DATA/)).toBeInTheDocument();
    expect(screen.getByText(/WEEK RECAP · Sep 7 – Sep 13/)).toBeInTheDocument();
    expect(row()).toHaveAttribute("data-unread", "true");

    await user.click(screen.getByRole("button", { name: /WEEK RECAP/ }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("TOGETHER")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /^Next/ }));
    // The revised Page 2, with the representative source-verified 5K.
    expect(within(dialog).getByText("Fastest 5K")).toBeInTheDocument();
    expect(within(dialog).getByText("20:55")).toBeInTheDocument();
    expect(within(dialog).getByText("Fastest Avg Pace")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: /Close/ }));

    expect(row()).not.toHaveAttribute("data-unread");
    // Reviewing the demo writes no acknowledgement into the real record.
    expect(loadSeenCrewRecapKeys("zack").size).toBe(0);
    expect(localStorage.length).toBe(0);

    await clearRow();
    expect(screen.queryByText(/WEEK RECAP/)).not.toBeInTheDocument();
  });

  it("renders nothing without a signed-in crew", () => {
    render(<CrewRecapNotification crew={null} today={MONDAY_AFTER} now={MONDAY_AFTER_ROLLOVER} />);
    expect(screen.queryByText(/WEEK RECAP/)).not.toBeInTheDocument();
  });
});
