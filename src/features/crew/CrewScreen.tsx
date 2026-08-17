import {
  BarChart3,
  CalendarCheck2,
  CalendarDays,
  ChevronDown,
  History,
  Layers3,
  Mountain,
  RefreshCw,
  UserRoundPlus,
  UsersRound,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { IconButton } from "../../components/ui/IconButton";
import { Section } from "../../components/ui/Section";
import { Sheet } from "../../components/ui/Sheet";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import type { CrewBuildRun, CrewType } from "../../crew/types";
import {
  comparisonBarPercent,
  comparisonValue,
  formatComparisonReading,
  orderedComparisonRows,
  type ComparisonMetric,
  type ComparisonSummary,
} from "../../crew/comparisons";
import { crewFreshness } from "../../crew/freshness";
import { crewMemberAccent } from "../../crew/memberAccent";
import { RunnerIcon } from "./RunnerIcon";
import { crewClubLine, crewRaceLine, raceCountdown } from "../../crew/raceCountdown";
import { runDaysByUserId, RUN_DAYS_WINDOW } from "../../crew/runDays";
import {
  crewBuildLandingOptions,
  deriveCrewBuild,
  EMPTY_CREW_BUILD,
} from "../../crew/crewBuild";
import { todayLocalDate } from "../../domain/dates";
import { formatMilesBuilt } from "../../domain/distance";
import { autoPlaceOption } from "../../domain/placement";
import { useJustPlaced } from "../build/useJustPlaced";
import { CrewBuild } from "./CrewBuild";
import { CrewEmblem } from "./CrewEmblem";
import { CrewRunDetailSheet } from "./CrewRunDetailSheet";
import { CrewRunRow } from "./CrewRunRow";
import { CrewMiniBuild } from "./CrewMiniBuild";
import { CrewMemberProfileSheet } from "./CrewMemberProfileSheet";
import { PropNotifications } from "./PropNotifications";
import {
  deriveCrewMiniBuild,
  orderedMiniBuildMembers,
} from "../../crew/miniBuild";

const DEFAULT_RECENT_RUNS = 6;
const MAX_RECENT_RUNS = 20;

const METRIC_LABEL: Record<ComparisonMetric, string> = {
  "weekly-miles": "Weekly Miles",
  "longest-run": "Longest Run",
  consistency: "Consistency",
  "run-days": "Run Days",
  "miles-built": "Miles Built",
};

type MetricDescriptor = {
  id: ComparisonMetric;
  shortLabel: string;
  window: string;
  Icon: LucideIcon;
};

const WEEKLY_MILES_METRIC: MetricDescriptor =
  { id: "weekly-miles", shortLabel: "Miles", window: "This week", Icon: BarChart3 };
const LONGEST_RUN_METRIC: MetricDescriptor =
  { id: "longest-run", shortLabel: "Long", window: "Trailing 28 days", Icon: Mountain };
const MILES_BUILT_METRIC: MetricDescriptor =
  { id: "miles-built", shortLabel: "Built", window: "All time", Icon: Layers3 };

// Race Crew comparisons keep Consistency, which needs a training plan. Run
// Club has no plan to measure against, so Run Days takes the same slot.
const RACE_METRICS: MetricDescriptor[] = [
  WEEKLY_MILES_METRIC,
  LONGEST_RUN_METRIC,
  { id: "consistency", shortLabel: "Consist", window: "Recent plan weeks", Icon: CalendarCheck2 },
  MILES_BUILT_METRIC,
];
const CLUB_METRICS: MetricDescriptor[] = [
  WEEKLY_MILES_METRIC,
  LONGEST_RUN_METRIC,
  { id: "run-days", shortLabel: "Days", window: `Trailing ${RUN_DAYS_WINDOW} days`, Icon: CalendarDays },
  MILES_BUILT_METRIC,
];

function metricsForCrewType(crewType: CrewType): MetricDescriptor[] {
  return crewType === "club" ? CLUB_METRICS : RACE_METRICS;
}

interface CrewScreenProps {
  crew: RaceCrewController | null;
  onOpenAccountCrew: () => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
}

function CrewAccessState({
  title,
  children,
  icon,
  onOpenAccountCrew,
}: {
  title: string;
  children: string;
  icon: ReactNode;
  onOpenAccountCrew: () => void;
}) {
  return (
    <EmptyState
      icon={icon}
      title={title}
      action={
        <Button variant="secondary" onClick={onOpenAccountCrew}>
          Account &amp; Crew
        </Button>
      }
    >
      {children}
    </EmptyState>
  );
}

/**
 * Crew — the shared destination.
 *
 * The hierarchy is deliberate and reads top to bottom: the tower we are
 * building together, then how our training compares, then what just happened,
 * then each runner's own Build. Everything below the Crew Build is support for
 * it, which is why the crew name, the runner count and Miles Built are each
 * stated once rather than repeated by every module.
 */
export function CrewScreen({
  crew,
  onOpenAccountCrew,
  today = todayLocalDate(),
}: CrewScreenProps) {
  const [metric, setMetric] = useState<ComparisonMetric>("weekly-miles");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  // Run Detail opened from inside Crew Profile is a drill-down, not a
  // replacement: the member stays selected underneath it, and closing Run
  // Detail restores the same profile rather than dropping to the Crew page
  // (issue #93). Run Detail opened from the main Recent Crew Runs feed
  // never sets this, so it still closes back to the Crew page as before.
  const [runDetailFromProfile, setRunDetailFromProfile] = useState(false);
  const [showAllRecentRuns, setShowAllRecentRuns] = useState(false);
  const [isCrewPickerOpen, setCrewPickerOpen] = useState(false);
  const [placingRunId, setPlacingRunId] = useState<string | null>(null);
  // The chosen column, held as a key rather than the full landing option, so
  // it survives the options list being recomputed on every render — the same
  // pattern Personal Build's `BuildScreen` uses.
  const [candidateColumn, setCandidateColumn] = useState<string | null>(null);
  const [placementLocalError, setPlacementLocalError] = useState<string | null>(null);
  // Only a placement this viewer just confirmed lands; refreshes and reloads
  // of the same shared tower never do (issue #76).
  const { justPlacedId, markJustPlaced } = useJustPlaced();
  const metricRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentCrew = crew?.account?.crew ?? null;
  const currentCrewId = currentCrew?.id ?? null;
  const memberships = crew?.account?.memberships ?? [];
  const canSwitchCrews = memberships.length > 1;
  const currentUserId = crew?.account?.profile.id;
  const crewStatus = crew?.status;
  const refreshCrewData = crew?.refreshCrewData;
  const markPropsSeen = crew?.markPropsSeen;
  const crewBuildRuns = crew?.crewData?.crewBuildRuns;

  // One read-model derivation per loaded payload. The server owns the Crew
  // coordinates; refresh only separates their placed and READY views.
  const crewBuild = useMemo(
    () => (crewBuildRuns
      ? deriveCrewBuild(crewBuildRuns, undefined, currentUserId)
      : EMPTY_CREW_BUILD),
    [crewBuildRuns, currentUserId],
  );

  useEffect(() => {
    if (crewStatus === "signed-in" && currentCrewId && refreshCrewData) {
      void refreshCrewData(false);
    }
  }, [crewStatus, currentCrewId, refreshCrewData]);

  // Arriving on the Crew tab is a read: whatever Props were unread when it
  // loaded clear from here and the header identity marker alike.
  useEffect(() => {
    if (crewStatus === "signed-in" && currentCrewId && markPropsSeen) {
      void markPropsSeen();
    }
  }, [crewStatus, currentCrewId, markPropsSeen]);

  if (crew && (!crew.configured || crew.status === "unconfigured")) {
    return (
      <EmptyState
        icon={<WifiOff size={24} strokeWidth={1.6} />}
        title="Crew data unavailable"
        action={
          <Button variant="secondary" onClick={() => void crew.refreshCrewData(true)}>
            Try Again
          </Button>
        }
      >
        Personal STACK is unaffected.
      </EmptyState>
    );
  }

  if (crew?.status === "loading") {
    return (
      <div className="crew-view__state" role="status">
        <p className="machine-label">Race Crew</p>
        <p>Loading crew data…</p>
      </div>
    );
  }

  if (!crew || crew.status !== "signed-in") {
    return (
      <CrewAccessState
        title="Race Crew"
        icon={<UsersRound size={24} strokeWidth={1.6} />}
        onOpenAccountCrew={onOpenAccountCrew}
      >
        Sign in to see your crew.
      </CrewAccessState>
    );
  }

  if (!currentCrew) {
    return (
      <CrewAccessState
        title="Race Crew"
        icon={<UserRoundPlus size={24} strokeWidth={1.6} />}
        onOpenAccountCrew={onOpenAccountCrew}
      >
        Join or create a crew to train with friends.
      </CrewAccessState>
    );
  }

  if (!crew.crewData && crew.crewDataStatus === "error") {
    return (
      <EmptyState
        icon={<WifiOff size={24} strokeWidth={1.6} />}
        title="Crew data unavailable"
        action={
          <Button variant="secondary" onClick={() => void crew.refreshCrewData(true)}>
            Try Again
          </Button>
        }
      >
        Race Crew could not be reached. Personal STACK is unaffected.
      </EmptyState>
    );
  }

  if (!crew.crewData) {
    return (
      <div className="crew-view__state" role="status">
        <p className="machine-label">Race Crew</p>
        <p>Loading crew data…</p>
      </div>
    );
  }

  const dashboardData = crew.crewData;
  const members = dashboardData.members;
  const metrics = metricsForCrewType(currentCrew.crewType);
  // Consistency needs a plan and Run Days needs a Run Club: switching crews
  // (or a metric no longer offered) falls back to the first tab rather than
  // rendering a tab that isn't shown.
  const activeMetric = metrics.some((item) => item.id === metric) ? metric : metrics[0].id;
  const placedMilesByUserId = new Map<string, number>();
  for (const block of crewBuild.blocks) {
    placedMilesByUserId.set(
      block.userId,
      (placedMilesByUserId.get(block.userId) ?? 0) + block.distanceMiles,
    );
  }
  const runDays = runDaysByUserId(dashboardData.runs, today);
  const comparisonSummaries: ComparisonSummary[] = dashboardData.summaries.map((summary) => ({
    ...summary,
    milesBuilt: placedMilesByUserId.get(summary.userId) ?? 0,
    runDays: runDays.get(summary.userId) ?? 0,
  }));
  const comparisonRows = orderedComparisonRows(activeMetric, members, comparisonSummaries);
  const freshness = crewFreshness(dashboardData.summaries);
  const selectedRun = dashboardData.runs.find((run) => run.id === selectedRunId) ?? null;
  const selectedMember = members.find((member) => member.userId === selectedMemberId) ?? null;
  const selectedMemberSummary = selectedMember
    ? comparisonSummaries.find((row) => row.userId === selectedMember.userId) ?? null
    : null;
  const selectedMemberRuns = selectedMember
    ? dashboardData.runs.filter((run) => run.userId === selectedMember.userId)
    : [];
  const recentRunPool = dashboardData.runs.slice(0, MAX_RECENT_RUNS);
  const recentRuns = showAllRecentRuns
    ? recentRunPool
    : recentRunPool.slice(0, DEFAULT_RECENT_RUNS);
  const hiddenRecentRunCount = recentRunPool.length - recentRuns.length;
  const miniBuildMembers = orderedMiniBuildMembers(members, currentUserId);
  const maxDisplayedValue = comparisonRows.reduce((maximum, row) => {
    const value = comparisonValue(activeMetric, row.summary);
    return value === null ? maximum : Math.max(maximum, value);
  }, 0);
  // Race Crew leads with the race and its countdown; a Run Club has neither,
  // so it states a compact non-race context instead — never both, never
  // a fabricated countdown for a Crew with no race.
  const isRaceCrew = currentCrew.crewType === "race";
  // The Member Profile's stat strip mirrors the comparison section's own
  // Race Crew / Run Club split: Consistency needs a training plan, Run Club
  // has none, so Run Days takes that slot instead (issue #87).
  const profileMetric = isRaceCrew
    ? { id: "consistency" as const, label: "Consistency" }
    : { id: "run-days" as const, label: "Run Days" };
  const raceLine = isRaceCrew ? crewRaceLine(currentCrew) : "";
  const countdown = isRaceCrew && currentCrew.raceDate
    ? raceCountdown(currentCrew.raceDate, today)
    : null;
  const contextLine = isRaceCrew
    ? [raceLine, countdown?.label].filter(Boolean).join(" · ")
    : crewClubLine(currentCrew);
  const build = {
    ...crewBuild,
    truncated: crewBuild.truncated || dashboardData.sharedRunsTruncated,
  };
  const viewerReadyRuns = build.viewerReadyRuns;
  const placingRun = dashboardData.crewBuildRuns.find((run) => run.id === placingRunId) ?? null;

  // A block being moved does not block its own current position — the same
  // rule Personal Build's `BuildScreen` applies before computing options.
  const placementBlocks = placingRun
    ? build.blocks.filter((block) => block.id !== placingRun.id)
    : build.blocks;
  const placementOptions = placingRun
    ? crewBuildLandingOptions(placingRun, placementBlocks)
    : [];
  const placementCandidate =
    placementOptions.find((option) => String(option.columnStart) === candidateColumn) ??
    autoPlaceOption(placementOptions) ??
    null;
  const placementCandidateIndex = placementCandidate
    ? placementOptions.findIndex(
      (option) => option.columnStart === placementCandidate.columnStart,
    )
    : -1;

  function startPlacement(run: CrewBuildRun) {
    crew!.clearCrewBuildPlacementError();
    setPlacementLocalError(null);
    setPlacingRunId(run.id);
    setCandidateColumn(
      run.crewBuildColumnStart === null ? null : String(run.crewBuildColumnStart),
    );
  }

  function cancelPlacement() {
    crew!.clearCrewBuildPlacementError();
    setPlacementLocalError(null);
    setCandidateColumn(null);
    setPlacingRunId(null);
  }

  function choosePlacement(option: { columnStart: number }) {
    crew!.clearCrewBuildPlacementError();
    setPlacementLocalError(null);
    setCandidateColumn(String(option.columnStart));
  }

  function stepPlacement(direction: -1 | 1) {
    const next = placementOptions[placementCandidateIndex + direction];
    if (next) choosePlacement(next);
  }

  function autoPlacePlacement() {
    const automatic = autoPlaceOption(placementOptions);
    if (automatic) choosePlacement(automatic);
  }

  async function confirmPlacement() {
    if (!placingRun || !placementCandidate) return;
    const placed = await crew!.placeCrewBuildBlock(
      placingRun.id,
      placementCandidate.row,
      placementCandidate.columnStart,
    );
    if (placed) {
      markJustPlaced(placingRun.id);
      cancelPlacement();
    } else setCandidateColumn(null);
  }

  function changeMetricFromKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % metrics.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + metrics.length) % metrics.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = metrics.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    setMetric(metrics[nextIndex].id);
    metricRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="crew-view">
      {/*
        The crew identity is a compact standing line, not another bordered
        card: the visual weight below it belongs to the Crew Build.
      */}
      <header className="crew-view__lead">
        <div className={`crew-view__lead-row${canSwitchCrews ? " crew-view__lead-row--picker" : ""}`}>
          {canSwitchCrews ? (
            <div className="crew-view__identity">
              <h1 className="crew-view__name data-value">
                <button
                  type="button"
                  className="crew-view__picker-trigger"
                  aria-label={`Choose crew: ${currentCrew.name}`}
                  aria-haspopup="dialog"
                  aria-expanded={isCrewPickerOpen}
                  disabled={crew.busy}
                  onClick={() => setCrewPickerOpen(true)}
                >
                  <CrewEmblem emblem={currentCrew.emblem} size={46} />
                  <span>{currentCrew.name}</span>
                  <ChevronDown aria-hidden="true" size={18} strokeWidth={2} />
                </button>
              </h1>
              {contextLine && (
                <p className="crew-view__race machine-label" data-kind={countdown?.kind}>
                  {contextLine}
                </p>
              )}
            </div>
          ) : (
            <>
              <CrewEmblem
                className="crew-view__emblem"
                emblem={currentCrew.emblem}
                size={46}
              />
              <div className="crew-view__identity">
                <h1 className="crew-view__name data-value">{currentCrew.name}</h1>
                {contextLine && (
                  <p className="crew-view__race machine-label" data-kind={countdown?.kind}>
                    {contextLine}
                  </p>
                )}
              </div>
            </>
          )}
          {/*
            Freshness lives beside the control that fixes it (issue #93):
            it used to sit below the comparison rows, detached from both
            Refresh and its own meaning. It appears exactly once.
          */}
          <div className="crew-view__refresh-group">
            {freshness && (
              <p
                className="crew-view__freshness machine-label"
                data-warning={freshness.warning || undefined}
              >
                {freshness.label}
              </p>
            )}
            <IconButton
              className="crew-view__refresh"
              label="Refresh crew data"
              icon={
                <RefreshCw
                  className={crew.crewDataStatus === "loading" ? "crew-comparison__refresh-icon--loading" : undefined}
                  size={16}
                  strokeWidth={1.8}
                />
              }
              disabled={crew.crewDataStatus === "loading"}
              aria-busy={crew.crewDataStatus === "loading"}
              onClick={() => void crew.refreshCrewData(true)}
            />
          </div>
        </div>
      </header>

      <PropNotifications
        notifications={crew.visiblePropNotifications}
        propsSeenAt={crew.account?.profile.propsSeenAt ?? new Date(0).toISOString()}
        onDismiss={crew.dismissPropNotification}
      />

      {canSwitchCrews && isCrewPickerOpen && (
        <Sheet
          title="Choose Crew"
          isOpen
          onClose={() => setCrewPickerOpen(false)}
          className="crew-picker"
        >
          <ul className="crew-picker__list" aria-label="Your crews">
            {memberships.map(({ crew: option }) => {
              const isCurrentCrew = option.id === currentCrew.id;
              return (
                <li key={option.id}>
                  <button
                    type="button"
                    className="crew-picker__option"
                    aria-pressed={isCurrentCrew}
                    disabled={crew.busy}
                    onClick={() => {
                      setCrewPickerOpen(false);
                      if (!isCurrentCrew) void crew.switchCrew(option.id);
                    }}
                  >
                    <CrewEmblem emblem={option.emblem} size={34} />
                    <span>{option.name}</span>
                    {isCurrentCrew && <span className="machine-label">Current</span>}
                  </button>
                </li>
              );
            })}
          </ul>
        </Sheet>
      )}

      <CrewBuild
        model={build}
        members={members}
        available={dashboardData.sharedRunsAvailable}
        justPlacedRunId={justPlacedId}
        placement={placingRun ? {
          run: placingRun,
          options: placementOptions,
          candidate: placementCandidate,
          pending: crew.crewBuildPlacementPending,
          error: crew.crewBuildPlacementError ?? placementLocalError,
          onChoose: choosePlacement,
          onStep: stepPlacement,
          onAutoPlace: autoPlacePlacement,
          onConfirm: () => void confirmPlacement(),
          onCancel: cancelPlacement,
        } : null}
        onStartReady={() => {
          const next = viewerReadyRuns[0];
          if (next) {
            const source = dashboardData.crewBuildRuns.find((run) => run.id === next.id);
            if (source) startPlacement(source);
          }
        }}
        onSelectRun={(runId) => setSelectedRunId(runId)}
      />

      <section
        className="crew-comparison"
        data-metric={activeMetric}
        aria-labelledby="crew-comparison-title"
      >
        <div className="crew-comparison__heading">
          <h2 id="crew-comparison-title">{METRIC_LABEL[activeMetric]}</h2>
          <p className="crew-comparison__window machine-label">
            {metrics.find((item) => item.id === activeMetric)?.window}
          </p>
        </div>

        <div className="crew-comparison__selector" role="tablist" aria-label="Comparison metric">
          {metrics.map(({ id, Icon }, index) => (
            <button
              key={id}
              ref={(element) => { metricRefs.current[index] = element; }}
              id={`crew-metric-${id}`}
              type="button"
              role="tab"
              aria-label={METRIC_LABEL[id]}
              aria-selected={activeMetric === id}
              aria-controls="crew-comparison-chart"
              tabIndex={activeMetric === id ? 0 : -1}
              data-metric={id}
              onClick={() => setMetric(id)}
              onKeyDown={(event) => changeMetricFromKeyboard(event, index)}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
            </button>
          ))}
        </div>

        <div
          id="crew-comparison-chart"
          role="tabpanel"
          aria-labelledby={`crew-metric-${activeMetric}`}
        >
          <ol
            className="crew-comparison__rows"
            aria-label={`${METRIC_LABEL[activeMetric]} comparison`}
          >
            {comparisonRows.map(({ member, summary }) => {
              const formatted = formatComparisonReading(activeMetric, summary);
              const isYou = member.userId === currentUserId;
              const percent = comparisonBarPercent(activeMetric, summary, maxDisplayedValue);
              const barStyle = { "--crew-bar-value": `${percent}%` } as CSSProperties;
              return (
                <li
                  key={member.userId}
                  data-you={isYou || undefined}
                  data-member-color={crewMemberAccent(member.userId, member.accentColor)}
                >
                  <div className="crew-comparison__row-topline">
                    <span className="crew-comparison__member">
                      <RunnerIcon icon={member.runnerIcon} size={26} />
                      <span>{member.displayName}</span>
                      {isYou && <span className="crew-comparison__you machine-label">You</span>}
                    </span>
                    <span className="crew-comparison__reading">
                      <span className="data-value">{formatted.value}</span>
                      {formatted.detail && (
                        <span className="machine-label">· {formatted.detail}</span>
                      )}
                    </span>
                  </div>
                  <span
                    className="crew-comparison__bar"
                    data-empty={percent === 0 || undefined}
                    data-unavailable={comparisonValue(activeMetric, summary) === null || undefined}
                    style={barStyle}
                    aria-hidden="true"
                  >
                    <span className="crew-comparison__bar-fill" />
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {crew.crewDataError && (
          <p className="crew-comparison__error" role="status">
            Crew data unavailable. Showing the last loaded view.
          </p>
        )}
      </section>

      {/*
        The Crew now sits above Recent Crew Runs (issue #93): who is here
        outranks what they just did, now that tapping a member opens a real
        profile rather than just a mini Build widget.
      */}
      <Section
        className="crew-builds"
        icon={<Layers3 size={15} strokeWidth={2} />}
        title="The Crew"
      >
        {members.length === 1 && (
          <p className="crew-builds__invite-note">Invite your crew to build together.</p>
        )}
        {!dashboardData.sharedRunsAvailable ? (
          <p className="crew-builds__unavailable">Member Builds unavailable.</p>
        ) : <ul className="crew-builds__rail" aria-label="Member Builds">
          {miniBuildMembers.map((member) => {
            const model = deriveCrewMiniBuild(dashboardData.miniBuildRuns, member.userId);
            const isYou = member.userId === currentUserId;
            return (
              <li
                key={member.userId}
                data-member-color={crewMemberAccent(member.userId, member.accentColor)}
                data-you={isYou || undefined}
              >
                <button
                  type="button"
                  className="crew-build-card"
                  data-you={isYou || undefined}
                  aria-label={`Open ${member.displayName}'s Build`}
                  onClick={() => setSelectedMemberId(member.userId)}
                >
                  <span className="crew-build-card__name">
                    <RunnerIcon icon={member.runnerIcon} size={24} />
                    <span>{member.displayName}</span>
                    {isYou && <span className="crew-build-card__you machine-label">You</span>}
                  </span>
                  <CrewMiniBuild model={model} />
                  <span className="crew-build-card__context machine-label">
                    <span className="crew-build-card__miles data-value">
                      {formatMilesBuilt(model.totalMiles)} MI <span>BUILT</span>
                    </span>
                    {model.sourceRunCount > 0 && (
                      <span className="crew-build-card__blocks">
                        {model.sourceRunCount} {model.sourceRunCount === 1 ? "block" : "blocks"}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>}
      </Section>

      <Section
        className="crew-recent"
        icon={<History size={15} strokeWidth={2} />}
        title="Recent Crew Runs"
      >
        {!dashboardData.sharedRunsAvailable ? (
          <p className="crew-recent__empty">Recent crew runs unavailable.</p>
        ) : dashboardData.runs.length === 0 ? (
          <p className="crew-recent__empty">No crew runs yet.</p>
        ) : (
          <ul className="crew-recent__list">
            {recentRuns.map((run) => (
              <CrewRunRow
                key={run.id}
                run={run}
                currentUserId={currentUserId ?? ""}
                propsPending={crew.propsPendingRunIds.includes(run.id)}
                propsError={crew.propsErrors[run.id] ?? null}
                propsAvailable={dashboardData.propsAvailable}
                onOpen={() => setSelectedRunId(run.id)}
                onToggleProps={() => void crew.toggleProps(run.id)}
              />
            ))}
          </ul>
        )}
        {hiddenRecentRunCount > 0 && (
          <Button variant="ghost" onClick={() => setShowAllRecentRuns(true)}>
            Show {hiddenRecentRunCount} more
          </Button>
        )}
      </Section>

      <CrewMemberProfileSheet
        key={selectedMember?.userId ?? "none"}
        member={selectedMember}
        isYou={selectedMember?.userId === currentUserId}
        model={selectedMember ? deriveCrewMiniBuild(dashboardData.miniBuildRuns, selectedMember.userId) : null}
        summary={selectedMemberSummary}
        consistencyMetric={profileMetric}
        runs={selectedMemberRuns}
        // Visually closed while its own Run Detail drill-down is open, so
        // only one dialog is ever interactive at a time (issue #93). The
        // member stays selected underneath, so this sheet reopens on the
        // same profile — same scroll position — once Run Detail closes.
        isOpen={selectedMember !== null && !runDetailFromProfile}
        onClose={() => {
          // The native <dialog> fires this same "close" event whether a
          // person dismissed it or the drill-down above just hid it
          // programmatically. Only the former should drop the member
          // selection — otherwise opening Run Detail from inside the
          // profile would itself clear the profile it is drilling into.
          if (runDetailFromProfile) return;
          setSelectedMemberId(null);
        }}
        onSelectRun={(runId) => {
          setRunDetailFromProfile(true);
          setSelectedRunId(runId);
        }}
        currentUserId={currentUserId ?? ""}
        propsPendingRunIds={crew.propsPendingRunIds}
        propsErrors={crew.propsErrors}
        propsAvailable={dashboardData.propsAvailable}
        onToggleProps={(runId) => void crew.toggleProps(runId)}
      />

      <CrewRunDetailSheet
        run={selectedRun}
        isOpen={selectedRun !== null}
        currentUserId={currentUserId ?? ""}
        propsPending={selectedRun ? crew.propsPendingRunIds.includes(selectedRun.id) : false}
        propsError={selectedRun ? crew.propsErrors[selectedRun.id] ?? null : null}
        propsAvailable={dashboardData.propsAvailable}
        onToggleProps={() => {
          if (selectedRun) void crew.toggleProps(selectedRun.id);
        }}
        onMoveBlock={selectedRun && selectedRun.userId === currentUserId && selectedRun.crewBuildRow !== null
          ? () => {
            const source = dashboardData.crewBuildRuns.find((run) => run.id === selectedRun!.id);
            if (!source) return;
            // Moving a block leaves the read-only profile for the main
            // Crew Build's placement flow, so the drill-down ends here
            // rather than reopening the profile underneath it.
            setSelectedMemberId(null);
            setRunDetailFromProfile(false);
            setSelectedRunId(null);
            startPlacement(source);
          }
          : undefined}
        onClose={() => {
          setSelectedRunId(null);
          setRunDetailFromProfile(false);
        }}
      />
    </div>
  );
}
