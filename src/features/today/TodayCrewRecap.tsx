import { X } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton } from "../../components/ui/IconButton.js";
import { isLocalDateString } from "../../domain/dates.js";
import { formatMilesBuilt } from "../../domain/distance.js";
import { formatWeekRange } from "../../domain/plan.js";
import type { CrewEmblem as CrewEmblemModel } from "../../crew/emblem.js";
import { useCrewAwards } from "../../crew/useCrewAwards.js";
import type { RaceCrewController } from "../../crew/useRaceCrew.js";
import { isCrewRecapReleaseOpen } from "../../crew/weekRollover.js";
import {
  crewWeekRecap,
  crewWeekRecapKey,
  crewWeekRecapRunsFrom,
  isCrewRecapCurrent,
  lastClosedCrewWeek,
  type CrewWeekRecap,
  type CrewWeekRecapBeat,
} from "../../crew/weekRecap.js";
import {
  dismissCrewRecap,
  loadDismissedCrewRecapKeys,
  markCrewRecapSeen,
} from "../../storage/crewRecapAcknowledgementRepository.js";
import { CrewEmblem } from "../crew/CrewEmblem.js";
import { CrewWeekRecapSheet } from "../crew/CrewWeekRecapSheet.js";
import { RecapBuildCrop } from "../crew/RecapBuildCrop.js";
import { crewRecapDemoData, crewRecapDemoVariant } from "../crew/crewRecapDemo.js";
import "../crew/crewWeekRecap.css";

/**
 * Today's Crew Week Recap module.
 *
 * Limited-time by construction. It appears only in the days right after a
 * Monday–Sunday Crew week closes (`isCrewRecapCurrent`), only when that week
 * actually had shared running in it, and only until the runner dismisses it —
 * so Today gains a weekly moment rather than a permanent seventh section.
 *
 * It sits below Today's own action surface. The workout, the run just logged
 * and the blocks it owes are still the first things on the screen; last week's
 * story is a payoff on the way down, not a thing standing between a runner and
 * this morning's run.
 *
 * The card states the week's headline facts itself, because a module that says
 * only "your recap is ready" is a notification wearing a card's clothes. The
 * fuller frame-by-frame recap is one tap away and can be replayed for as long
 * as the module is on Today.
 */

/**
 * Gate. Owner review first, then the live Crew.
 *
 * `?demo=recap` is preview-host-only and carries its own fake crew, so it
 * short-circuits before any real account, week or dismissal is consulted —
 * see `crewRecapDemo.ts` for why the recap needs a review path at all.
 */
export function TodayCrewRecap({
  crew,
  today,
  now = new Date(),
}: {
  crew: RaceCrewController | null;
  today: string;
  now?: Date;
}) {
  const demoVariant = crewRecapDemoVariant();
  const demo = demoVariant ? crewRecapDemoData(demoVariant) : null;
  if (demo) {
    return (
      <CrewRecapCard
        recap={demo.recap}
        emblem={demo.emblem}
        crewName={demo.recap.crewName}
        isDemo
      />
    );
  }

  const viewerUserId = crew?.account?.profile.id;
  const activeCrew = crew?.account?.crew ?? null;
  const dashboard = crew?.crewData ?? null;
  const week = lastClosedCrewWeek(today);

  if (
    !viewerUserId ||
    !activeCrew ||
    // A Crew whose Build start date did not arrive is a Crew this module
    // cannot honestly window a week against. Today declines the recap rather
    // than deriving one from a date it does not have.
    !isLocalDateString(activeCrew.buildStartDate) ||
    !dashboard?.sharedRunsAvailable ||
    !isCrewRecapCurrent(week, today) ||
    !isCrewRecapReleaseOpen(now)
  ) {
    return null;
  }

  return (
    <CrewWeekRecapModule
      key={crewWeekRecapKey(activeCrew.id, week.weekStart)}
      crew={crew!}
      viewerUserId={viewerUserId}
      today={today}
    />
  );
}

/**
 * Data owner for the live path.
 *
 * The award read only happens once the week, the crew and the dismissal have
 * all already said yes, which is why it lives in this inner component: Today
 * must not spend a Supabase round trip on a recap it is not going to show.
 */
function CrewWeekRecapModule({
  crew,
  viewerUserId,
  today,
}: {
  crew: RaceCrewController;
  viewerUserId: string;
  today: string;
}) {
  const activeCrew = crew.account!.crew!;
  const dashboard = crew.crewData!;
  const week = useMemo(() => lastClosedCrewWeek(today), [today]);
  const recapKey = crewWeekRecapKey(activeCrew.id, week.weekStart);

  const [dismissed, setDismissed] = useState(() =>
    loadDismissedCrewRecapKeys(viewerUserId).has(recapKey),
  );

  // Additive and failure-tolerant, exactly as Crew treats it: a Crew whose
  // award schema or read is unavailable simply gets a recap with no Special
  // Blocks beat, never a missing recap and never an error on Today.
  const awards = useCrewAwards({ crewId: activeCrew.id, viewerUserId });

  const recap = useMemo<CrewWeekRecap | null>(
    () =>
      crewWeekRecap({
        crewId: activeCrew.id,
        crewName: activeCrew.name,
        buildStartDate: activeCrew.buildStartDate,
        members: dashboard.members,
        runs: crewWeekRecapRunsFrom(dashboard.runs),
        awards: awards.available ? awards.blocks : [],
        week,
      }),
    [
      activeCrew.id,
      activeCrew.name,
      activeCrew.buildStartDate,
      dashboard.members,
      dashboard.runs,
      awards.available,
      awards.blocks,
      week,
    ],
  );

  if (!recap || dismissed) return null;

  return (
    <CrewRecapCard
      recap={recap}
      emblem={activeCrew.emblem}
      crewName={activeCrew.name}
      // Issue #186: one acknowledgement record, both surfaces. Opening the
      // recap here is the same statement as opening it from Crew, so the
      // notification on Crew is no longer unread either — and dismissing here
      // is still the stronger statement that takes the prompt off both.
      onOpened={() => markCrewRecapSeen(viewerUserId, recapKey)}
      onDismiss={() => {
        dismissCrewRecap(viewerUserId, recapKey);
        setDismissed(true);
      }}
    />
  );
}

/**
 * The module itself.
 *
 * A teaser, and deliberately small: one line of copy, one compact machine
 * line, a way in, and a crop of the week's own blocks. It is the same card for
 * the live Crew and for owner review — a review path that renders a different
 * card is not reviewing the product.
 *
 * The demo's dismissal stays in memory: there is no account to remember it for.
 */
function CrewRecapCard({
  recap,
  emblem,
  crewName,
  onOpened,
  onDismiss,
  isDemo = false,
}: {
  recap: CrewWeekRecap;
  emblem: CrewEmblemModel;
  crewName: string;
  onOpened?: () => void;
  onDismiss?: () => void;
  isDemo?: boolean;
}) {
  const [isOpen, setOpen] = useState(false);
  const [demoDismissed, setDemoDismissed] = useState(false);
  if (demoDismissed) return null;

  const { totals } = recap;
  const range = formatWeekRange(recap.weekStart, recap.weekEnd);
  const build =
    (recap.beats.find((beat) => beat.kind === "build") as
      | Extract<CrewWeekRecapBeat, { kind: "build" }>
      | undefined) ?? null;

  return (
    <>
      <section
        className="today-crew-recap"
        aria-labelledby="today-crew-recap-title"
      >
        {isDemo && (
          <p className="today-crew-recap__demo machine-label">
            RECAP DEMO · FAKE CREW DATA
          </p>
        )}

        <div className="today-crew-recap__head">
          <CrewEmblem
            className="today-crew-recap__emblem"
            emblem={emblem}
            size={19}
          />
          <p className="machine-label">Crew Week Recap · {range}</p>
          <IconButton
            className="today-crew-recap__dismiss"
            label="Dismiss Crew Week Recap"
            icon={<X size={17} strokeWidth={1.9} />}
            onClick={() => (onDismiss ? onDismiss() : setDemoDismissed(true))}
          />
        </div>

        <h2 id="today-crew-recap-title" className="today-crew-recap__headline">
          {crewName} built{" "}
          <span className="data-value">{formatMilesBuilt(totals.miles)} mi</span>{" "}
          together.
        </h2>

        <p className="today-crew-recap__support machine-label">
          {totals.runs} {totals.runs === 1 ? "RUN" : "RUNS"} ·{" "}
          {totals.activeRunners}{" "}
          {totals.activeRunners === 1 ? "RUNNER" : "RUNNERS"}
          {build
            ? ` · +${build.blocksPlaced} ${build.blocksPlaced === 1 ? "BLOCK" : "BLOCKS"}`
            : ""}
        </p>

        <div className="today-crew-recap__body">
          <button
            type="button"
            className="today-crew-recap__open"
            aria-haspopup="dialog"
            aria-expanded={isOpen}
            onClick={() => {
              setOpen(true);
              onOpened?.();
            }}
          >
            View recap →
          </button>

          {/*
            A crop of the week's real blocks, at teaser scale. It says what the
            recap is about faster than another sentence would, and it is the
            Crew's own Build rather than an illustration of one. It shares the
            row with the way in, which is the shortest line the module has.
          */}
          {build && (
            <RecapBuildCrop
              beat={build}
              scale="teaser"
              className="today-crew-recap__crop"
              animateSettle={false}
            />
          )}
        </div>
      </section>

      {isOpen && (
        <CrewWeekRecapSheet
          recap={recap}
          emblem={emblem}
          isOpen
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
