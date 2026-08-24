import { CalendarCheck, X } from "lucide-react";
import { useMemo, useState } from "react";
import { Section } from "../../components/ui/Section";
import { useSwipeToDismiss } from "../../components/ui/useSwipeToDismiss";
import { isLocalDateString, todayLocalDate } from "../../domain/dates";
import { formatMilesBuilt } from "../../domain/distance";
import { formatWeekRange } from "../../domain/plan";
import type { CrewEmblem as CrewEmblemModel } from "../../crew/emblem";
import { useCrewAwards } from "../../crew/useCrewAwards";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { isCrewRecapReleaseOpen } from "../../crew/weekRollover";
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
  loadSeenCrewRecapKeys,
  markCrewRecapSeen,
} from "../../storage/crewRecapAcknowledgementRepository";
import { CrewEmblem } from "./CrewEmblem";
import { CrewWeekRecapSheet } from "./CrewWeekRecapSheet";
import { crewRecapDemoData, crewRecapDemoVariant } from "./crewRecapDemo";
import "./crewWeekRecap.css";

/**
 * The Crew screen's Week Recap notification.
 *
 * Evolution 2.1's discovery fix. Before it, Today's teaser was the only way to
 * find a recap, so a runner who opened STACK on Crew — the screen the recap is
 * actually about — never learned there was one.
 *
 * It is deliberately a **notification, not a second dashboard card**. Crew
 * already has a notification language in Props, and it is the right one here:
 * a row directly under the header rather than a panel, an unread mark that
 * clears when you open it, a swipe (or a Clear button) that takes it away, and
 * seen and cleared kept as separate statements. Introducing a second Crew
 * alert pattern for one weekly row would be inventing a dialect.
 *
 * The row states the week's headline facts rather than announcing itself. "Your
 * recap is ready" is a notification about a notification.
 *
 * Both surfaces derive the same `CrewWeekRecap` from the same shared data and
 * share one acknowledgement record, so Today and Crew cannot disagree about
 * the week or about what the runner has already done with it.
 */

/**
 * Gate. Owner review first, then the live Crew.
 *
 * `?demo=recap` is preview-host-only and carries its own fake crew, so it
 * short-circuits before any real account, week or acknowledgement is
 * consulted — see `crewRecapDemo.ts` for why the recap needs a review path at
 * all, and the addendum to issue #186 for why that path is required scope
 * rather than optional QA polish.
 */
export function CrewRecapNotification({
  crew,
  today = todayLocalDate(),
  now = new Date(),
}: {
  crew: RaceCrewController | null;
  today?: string;
  now?: Date;
}) {
  const demoVariant = crewRecapDemoVariant();
  const demo = demoVariant ? crewRecapDemoData(demoVariant) : null;
  if (demo) {
    return <CrewRecapNotificationDemo recap={demo.recap} emblem={demo.emblem} />;
  }

  const viewerUserId = crew?.account?.profile.id;
  const activeCrew = crew?.account?.crew ?? null;
  const dashboard = crew?.crewData ?? null;
  const week = lastClosedCrewWeek(today);

  if (
    !viewerUserId ||
    !activeCrew ||
    // A Crew whose Build start date did not arrive is a Crew this module
    // cannot honestly window a week against, exactly as on Today.
    !isLocalDateString(activeCrew.buildStartDate) ||
    !dashboard?.sharedRunsAvailable ||
    !isCrewRecapCurrent(week, today) ||
    !isCrewRecapReleaseOpen(now)
  ) {
    return null;
  }

  return (
    <CrewRecapNotificationModule
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
 * The Crew screen has already read the awards it renders in the tower, so this
 * costs no extra round trip — `useCrewAwards` is the same cached read. It is
 * failure-tolerant the same way Today's is: an unavailable award read costs the
 * recap its Special Blocks page, never the notification.
 */
function CrewRecapNotificationModule({
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

  const [cleared, setCleared] = useState(() =>
    loadDismissedCrewRecapKeys(viewerUserId).has(recapKey),
  );
  const [seen, setSeen] = useState(() =>
    loadSeenCrewRecapKeys(viewerUserId).has(recapKey),
  );

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

  if (!recap || cleared) return null;

  return (
    <CrewRecapNotificationRow
      recap={recap}
      emblem={activeCrew.emblem}
      unread={!seen}
      onOpened={() => {
        markCrewRecapSeen(viewerUserId, recapKey);
        setSeen(true);
      }}
      onClear={() => {
        dismissCrewRecap(viewerUserId, recapKey);
        setCleared(true);
      }}
    />
  );
}

/**
 * Owner review for the Crew notification.
 *
 * The real row, the real sheet, the real derivation — only the facts and the
 * acknowledgement are fake. Seen is held in memory so the unread state is
 * reviewable repeatedly and no real stored recap state is touched; cleared
 * removes the row for the session, which is what a reviewer needs to see it do.
 */
function CrewRecapNotificationDemo({
  recap,
  emblem,
}: {
  recap: CrewWeekRecap;
  emblem: CrewEmblemModel;
}) {
  const [seen, setSeen] = useState(false);
  const [cleared, setCleared] = useState(false);
  if (cleared) return null;

  return (
    <CrewRecapNotificationRow
      recap={recap}
      emblem={emblem}
      unread={!seen}
      onOpened={() => setSeen(true)}
      onClear={() => setCleared(true)}
      isDemo
    />
  );
}

/**
 * The row itself, and the sheet it opens.
 *
 * The live path and the review path both render exactly this — they differ
 * only in where the recap comes from and where the acknowledgement goes. A
 * review path with a row of its own is not reviewing the product.
 */
function CrewRecapNotificationRow({
  recap,
  emblem,
  unread,
  onOpened,
  onClear,
  isDemo = false,
}: {
  recap: CrewWeekRecap;
  emblem: CrewEmblemModel;
  unread: boolean;
  onOpened: () => void;
  onClear: () => void;
  isDemo?: boolean;
}) {
  const [isOpen, setOpen] = useState(false);
  const { offsetX, isDragging, isExiting, trigger, handlers } =
    useSwipeToDismiss(onClear);

  const range = formatWeekRange(recap.weekStart, recap.weekEnd);
  const { totals } = recap;
  const facts = `${formatMilesBuilt(totals.miles)} MI · ${totals.runs} ${
    totals.runs === 1 ? "RUN" : "RUNS"
  }`;

  return (
    <>
      <Section
        className="crew-recap-notification"
        icon={<CalendarCheck size={15} strokeWidth={2} />}
        title="Week Recap"
      >
        {isDemo && (
          <p className="crew-recap-notification__demo machine-label">
            RECAP DEMO · FAKE CREW DATA
          </p>
        )}
        <ul className="crew-recap-notification__list">
          <li
            data-unread={unread || undefined}
            data-exiting={isExiting || undefined}
            style={
              offsetX
                ? {
                  transform: `translateX(${offsetX}px)`,
                  transition: isDragging ? "none" : undefined,
                }
                : undefined
            }
            {...handlers}
          >
            {/*
              The Crew's own emblem, not a generic analytics glyph. The recap is
              about this crew, and the emblem is how the product already says so.
            */}
            <CrewEmblem emblem={emblem} size={24} />
            <button
              type="button"
              className="crew-recap-notification__open"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              onClick={() => {
                setOpen(true);
                onOpened();
              }}
            >
              <span className="machine-label">
                WEEK RECAP · {range}
                {unread && <span className="visually-hidden"> New.</span>}
              </span>
              <span className="crew-recap-notification__facts">
                Last week is in ·{" "}
                <span className="data-value">{facts}</span>
              </span>
            </button>
            <button
              type="button"
              className="crew-recap-notification__dismiss"
              aria-label={`Clear: Week Recap for ${range}`}
              onClick={trigger}
            >
              <X size={14} strokeWidth={2} aria-hidden="true" />
            </button>
          </li>
        </ul>
      </Section>

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
