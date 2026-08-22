import { Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { IconButton } from "../../components/ui/IconButton";
import { isLocalDateString } from "../../domain/dates";
import { formatMilesBuilt } from "../../domain/distance";
import { formatTotalHoursMinutes } from "../../domain/duration";
import { formatWeekRange } from "../../domain/plan";
import { useCrewAwards } from "../../crew/useCrewAwards";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import {
  crewWeekRecap,
  crewWeekRecapKey,
  crewWeekRecapRunsFrom,
  isCrewRecapCurrent,
  lastClosedCrewWeek,
  type CrewWeekRecap,
} from "../../crew/weekRecap";
import {
  dismissCrewRecap,
  loadDismissedCrewRecapKeys,
} from "../../storage/dismissedCrewRecapRepository";
import { CrewWeekRecapSheet } from "../crew/CrewWeekRecapSheet";
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
 * Gate and data owner.
 *
 * The award read only happens once the week, the crew and the dismissal have
 * all already said yes, which is why it lives in the inner component: Today
 * must not spend a Supabase round trip on a recap it is not going to show.
 */
export function TodayCrewRecap({
  crew,
  today,
}: {
  crew: RaceCrewController | null;
  today: string;
}) {
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
    !isCrewRecapCurrent(week, today)
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
  const [isOpen, setOpen] = useState(false);

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

  const { totals } = recap;
  const range = formatWeekRange(recap.weekStart, recap.weekEnd);

  return (
    <>
      <section
        className="today-crew-recap"
        aria-labelledby="today-crew-recap-title"
      >
        <div className="today-crew-recap__head">
          <span className="today-crew-recap__mark" aria-hidden="true">
            <Sparkles size={15} strokeWidth={2} />
          </span>
          <p className="machine-label">Crew Week Recap · {range}</p>
          <IconButton
            className="today-crew-recap__dismiss"
            label="Dismiss Crew Week Recap"
            icon={<X size={17} strokeWidth={1.9} />}
            onClick={() => {
              dismissCrewRecap(viewerUserId, recapKey);
              setDismissed(true);
            }}
          />
        </div>

        <h2 id="today-crew-recap-title" className="today-crew-recap__headline">
          {activeCrew.name} ran{" "}
          <span className="data-value">{formatMilesBuilt(totals.miles)} mi</span>{" "}
          together
        </h2>

        <p className="today-crew-recap__support machine-label">
          {totals.runs} {totals.runs === 1 ? "RUN" : "RUNS"} ·{" "}
          {formatTotalHoursMinutes(totals.durationSeconds)} ·{" "}
          {totals.activeRunners}{" "}
          {totals.activeRunners === 1 ? "RUNNER" : "RUNNERS"}
        </p>

        <button
          type="button"
          className="today-crew-recap__open"
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          onClick={() => setOpen(true)}
        >
          Open the recap
        </button>
      </section>

      {isOpen && (
        <CrewWeekRecapSheet
          recap={recap}
          emblem={activeCrew.emblem}
          isOpen
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
