import {
  BarChart3,
  ChevronDown,
  Gauge,
  History,
  Layers3,
  Mountain,
  RefreshCw,
  Trophy,
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
import {
  awardsWonByUserId,
  comparisonBarPercent,
  comparisonBest,
  comparisonValue,
  formatComparisonReading,
  orderedComparisonRows,
  type ComparisonMetric,
  type ComparisonSummary,
} from "../../crew/comparisons";
import { avgPaceSecondsByUserId, AVG_PACE_WINDOW } from "../../crew/avgPace";
import {
  crewAwardLandingOptions,
  crewBuildLandingOptions,
  deriveCrewBuildWithAwards,
  EMPTY_CREW_BUILD,
} from "../../crew/crewBuild";
import { crewSyncStatus } from "../../crew/freshness";
import { crewMemberAccent } from "../../crew/memberAccent";
import { deriveCrewMiniBuild } from "../../crew/miniBuild";
import { viewerFirstMembers } from "../../crew/memberOrder";
import { crewClubLine, crewRaceLine, raceCountdown } from "../../crew/raceCountdown";
import type { CrewBuildRun } from "../../crew/types";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import { useCrewAwards } from "../../crew/useCrewAwards";
import { todayLocalDate } from "../../domain/dates";
import { autoPlaceOption } from "../../domain/placement";
import { useJustPlaced } from "../build/useJustPlaced";
import { CrewAwardDetailSheet } from "./CrewAwardDetailSheet";
import { CrewAwardsPanel } from "./CrewAwardsPanel";
import { CrewBuild, type CrewBuildPlacementMode } from "./CrewBuild";
import { CrewEmblem } from "./CrewEmblem";
import { CrewMemberProfileSheet } from "./CrewMemberProfileSheet";
import { CrewRunDetailSheet } from "./CrewRunDetailSheet";
import { CrewRunRow } from "./CrewRunRow";
import { PropNotifications } from "./PropNotifications";
import { RunnerIcon } from "./RunnerIcon";

const DEFAULT_RECENT_RUNS = 6;
const MAX_RECENT_RUNS = 20;

const METRIC_LABEL: Record<ComparisonMetric, string> = {
  "weekly-miles": "Weekly Miles",
  "longest-run": "Longest Run",
  "avg-pace": "Avg Pace",
  "miles-built": "Miles Built",
  "awards-28d": "Awards",
};

type MetricDescriptor = {
  id: ComparisonMetric;
  shortLabel: string;
  window: string;
  Icon: LucideIcon;
};

const METRICS: MetricDescriptor[] = [
  { id: "weekly-miles", shortLabel: "Miles", window: "This week", Icon: BarChart3 },
  { id: "longest-run", shortLabel: "Long", window: "Trailing 28 days", Icon: Mountain },
  { id: "avg-pace", shortLabel: "Pace", window: `Trailing ${AVG_PACE_WINDOW} days`, Icon: Gauge },
  { id: "miles-built", shortLabel: "Built", window: "All time", Icon: Layers3 },
  { id: "awards-28d", shortLabel: "Awards", window: "Trailing 28 days", Icon: Trophy },
];

interface CrewScreenProps {
  crew: RaceCrewController | null;
  onOpenAccountCrew: () => void;
  placeCrewRunId?: string | null;
  onCrewPlacementHandled?: () => void;
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

export function CrewScreen({
  crew,
  onOpenAccountCrew,
  placeCrewRunId = null,
  onCrewPlacementHandled,
  today = todayLocalDate(),
}: CrewScreenProps) {
  const [metric, setMetric] = useState<ComparisonMetric>("weekly-miles");
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [selectedAwardId, setSelectedAwardId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [runDetailFromProfile, setRunDetailFromProfile] = useState(false);
  const [awardDetailFromProfile, setAwardDetailFromProfile] = useState(false);
  const [showAllRecentRuns, setShowAllRecentRuns] = useState(false);
  const [isCrewPickerOpen, setCrewPickerOpen] = useState(false);
  const [placingRunId, setPlacingRunId] = useState<string | null>(null);
  const [placingAwardId, setPlacingAwardId] = useState<string | null>(null);
  const [candidateColumn, setCandidateColumn] = useState<string | null>(null);
  const [placementLocalError, setPlacementLocalError] = useState<string | null>(null);
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

  const crewAwards = useCrewAwards({
    crewId: currentCrewId,
    viewerUserId: currentUserId,
  });
  const refreshAwards = crewAwards.refresh;

  const crewBuild = useMemo(
    () => (crewBuildRuns
      ? deriveCrewBuildWithAwards(
        crewBuildRuns,
        crewAwards.blocks,
        currentUserId ?? undefined,
      )
      : EMPTY_CREW_BUILD),
    [crewAwards.blocks, crewBuildRuns, currentUserId],
  );

  useEffect(() => {
    if (crewStatus === "signed-in" && currentCrewId && refreshCrewData) {
      void refreshCrewData(false);
    }
  }, [crewStatus, currentCrewId, refreshCrewData]);

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

  const activeCrew = crew;
  const dashboardData = activeCrew.crewData!;
  const members = dashboardData.members;
  const activeMetric = metric;
  const placedMilesByUserId = new Map<string, number>();
  for (const block of crewBuild.blocks) {
    if (block.kind !== "run") continue;
    placedMilesByUserId.set(
      block.userId,
      (placedMilesByUserId.get(block.userId) ?? 0) + block.distanceMiles,
    );
  }
  const avgPace = avgPaceSecondsByUserId(dashboardData.runs, today);
  const awardsWon = awardsWonByUserId(crewAwards.blocks, today);
  const comparisonSummaries: ComparisonSummary[] = dashboardData.summaries.map((summary) => ({
    ...summary,
    milesBuilt: placedMilesByUserId.get(summary.userId) ?? 0,
    avgPaceSeconds: avgPace.get(summary.userId) ?? null,
    awardsWon28d: awardsWon.get(summary.userId) ?? 0,
  }));
  const comparisonRows = orderedComparisonRows(activeMetric, members, comparisonSummaries);
  const syncStatus = crewSyncStatus({
    summaries: dashboardData.summaries,
    loading: activeCrew.crewDataStatus === "loading",
    error: Boolean(activeCrew.crewDataError),
  });
  const selectedRun = dashboardData.runs.find((run) => run.id === selectedRunId) ?? null;
  const selectedAward = crewAwards.blocks.find((award) => award.id === selectedAwardId) ?? null;
  const selectedAwardMember = selectedAward
    ? members.find((member) => member.userId === selectedAward.winnerUserId) ?? null
    : null;
  const selectedMember = members.find((member) => member.userId === selectedMemberId) ?? null;
  const selectedMemberSummary = selectedMember
    ? comparisonSummaries.find((row) => row.userId === selectedMember.userId) ?? null
    : null;
  const selectedMemberRuns = selectedMember
    ? dashboardData.runs.filter((run) => run.userId === selectedMember.userId)
    : [];
  const selectedMemberAwards = selectedMember
    ? crewAwards.blocks
      .filter((award) => award.winnerUserId === selectedMember.userId)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart) || b.createdAt.localeCompare(a.createdAt))
    : [];
  const recentRunPool = dashboardData.runs.slice(0, MAX_RECENT_RUNS);
  const recentRuns = showAllRecentRuns
    ? recentRunPool
    : recentRunPool.slice(0, DEFAULT_RECENT_RUNS);
  const hiddenRecentRunCount = recentRunPool.length - recentRuns.length;
  const railMembers = viewerFirstMembers(members, currentUserId);
  const bestDisplayedValue = comparisonBest(activeMetric, comparisonRows);
  const isRaceCrew = currentCrew.crewType === "race";
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
  const viewerReadyAwards = build.viewerReadyAwards;

  const requestedPlacementRun = placeCrewRunId
    ? dashboardData.crewBuildRuns.find((run) => run.id === placeCrewRunId) ?? null
    : null;
  const placingAward = placingAwardId
    ? crewAwards.blocks.find((award) => award.id === placingAwardId) ?? null
    : null;
  const placingAwardMember = placingAward
    ? members.find((member) => member.userId === placingAward.winnerUserId) ?? null
    : null;
  const placingRun = placingAward
    ? null
    : dashboardData.crewBuildRuns.find((run) => run.id === placingRunId)
      ?? requestedPlacementRun;

  const placementBlocks = build.blocks.filter((block) => {
    if (placingRun) return !(block.kind === "run" && block.id === placingRun.id);
    if (placingAward) return !(block.kind === "award" && block.id === placingAward.id);
    return true;
  });
  const placementOptions = placingRun
    ? crewBuildLandingOptions(placingRun, placementBlocks)
    : placingAward
      ? crewAwardLandingOptions(placingAward, placementBlocks)
      : [];
  const placementCandidate =
    placementOptions.find((option) => String(option.columnStart) === candidateColumn) ??
    autoPlaceOption(placementOptions) ??
    null;
  const placementCandidateIndex = placementCandidate
    ? placementOptions.findIndex((option) => option.columnStart === placementCandidate.columnStart)
    : -1;

  function startPlacement(run: CrewBuildRun) {
    onCrewPlacementHandled?.();
    activeCrew.clearCrewBuildPlacementError();
    crewAwards.clearPlacementError();
    setPlacementLocalError(null);
    setPlacingAwardId(null);
    setPlacingRunId(run.id);
    setCandidateColumn(
      run.crewBuildColumnStart === null ? null : String(run.crewBuildColumnStart),
    );
  }

  function startAwardPlacement(awardId: string) {
    const award = crewAwards.blocks.find((item) => item.id === awardId);
    if (!award || award.winnerUserId !== currentUserId) return;
    onCrewPlacementHandled?.();
    activeCrew.clearCrewBuildPlacementError();
    crewAwards.clearPlacementError();
    setPlacementLocalError(null);
    setPlacingRunId(null);
    setPlacingAwardId(award.id);
    setCandidateColumn(
      award.crewBuildColumnStart === null ? null : String(award.crewBuildColumnStart),
    );
  }

  function cancelPlacement() {
    onCrewPlacementHandled?.();
    activeCrew.clearCrewBuildPlacementError();
    crewAwards.clearPlacementError();
    setPlacementLocalError(null);
    setCandidateColumn(null);
    setPlacingRunId(null);
    setPlacingAwardId(null);
  }

  function choosePlacement(option: { columnStart: number }) {
    activeCrew.clearCrewBuildPlacementError();
    crewAwards.clearPlacementError();
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
    if (!placementCandidate) return;
    if (placingRun) {
      const placed = await activeCrew.placeCrewBuildBlock(
        placingRun.id,
        placementCandidate.row,
        placementCandidate.columnStart,
      );
      if (placed) {
        markJustPlaced(placingRun.id);
        cancelPlacement();
      } else setCandidateColumn(null);
      return;
    }
    if (placingAward) {
      const placed = await crewAwards.placeAward(
        placingAward.id,
        placementCandidate.row,
        placementCandidate.columnStart,
      );
      if (placed) {
        markJustPlaced(placingAward.id);
        cancelPlacement();
      } else setCandidateColumn(null);
    }
  }

  const placementMode: CrewBuildPlacementMode | null = placingRun
    ? {
      kind: "run",
      run: placingRun,
      options: placementOptions,
      candidate: placementCandidate,
      pending: activeCrew.crewBuildPlacementPending,
      error: activeCrew.crewBuildPlacementError ?? placementLocalError,
      onChoose: choosePlacement,
      onStep: stepPlacement,
      onAutoPlace: autoPlacePlacement,
      onConfirm: () => void confirmPlacement(),
      onCancel: cancelPlacement,
    }
    : placingAward && placingAwardMember
      ? {
        kind: "award",
        award: placingAward,
        member: placingAwardMember,
        options: placementOptions,
        candidate: placementCandidate,
        pending: crewAwards.placementPending,
        error: crewAwards.placementError ?? placementLocalError,
        onChoose: choosePlacement,
        onStep: stepPlacement,
        onAutoPlace: autoPlacePlacement,
        onConfirm: () => void confirmPlacement(),
        onCancel: cancelPlacement,
      }
      : null;

  function changeMetricFromKeyboard(
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number,
  ) {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (currentIndex + 1) % METRICS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (currentIndex - 1 + METRICS.length) % METRICS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = METRICS.length - 1;
    }
    if (nextIndex === null) return;
    event.preventDefault();
    setMetric(METRICS[nextIndex].id);
    metricRefs.current[nextIndex]?.focus();
  }

  return (
    <div className="crew-view">
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
                  disabled={activeCrew.busy}
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
              <CrewEmblem className="crew-view__emblem" emblem={currentCrew.emblem} size={46} />
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
          <div className="crew-view__refresh-group">
            <IconButton
              className="crew-view__refresh"
              data-sync-state={syncStatus.state}
              label={syncStatus.label}
              icon={
                <RefreshCw
                  className={syncStatus.state === "syncing" ? "crew-comparison__refresh-icon--loading" : undefined}
                  size={16}
                  strokeWidth={1.8}
                />
              }
              disabled={activeCrew.crewDataStatus === "loading"}
              aria-busy={activeCrew.crewDataStatus === "loading"}
              onClick={() => {
                void activeCrew.refreshCrewData(true);
                void refreshAwards();
              }}
            />
          </div>
        </div>
      </header>

      <PropNotifications
        notifications={activeCrew.visiblePropNotifications}
        propsSeenAt={activeCrew.account?.profile.propsSeenAt ?? new Date(0).toISOString()}
        onDismiss={activeCrew.dismissPropNotification}
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
                    disabled={activeCrew.busy}
                    onClick={() => {
                      setCrewPickerOpen(false);
                      if (!isCurrentCrew) void activeCrew.switchCrew(option.id);
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
        members={railMembers}
        available={dashboardData.sharedRunsAvailable}
        justPlacedRunId={justPlacedId}
        justPlacedAwardId={justPlacedId}
        placement={placementMode}
        onStartReady={() => {
          const next = viewerReadyRuns[0];
          if (next) {
            const source = dashboardData.crewBuildRuns.find((run) => run.id === next.id);
            if (source) startPlacement(source);
          }
        }}
        onSelectRun={(runId) => setSelectedRunId(runId)}
        onSelectAward={(awardId) => setSelectedAwardId(awardId)}
        onSelectMember={(userId) => setSelectedMemberId(userId)}
      />

      <CrewAwardsPanel
        readyAwards={viewerReadyAwards}
        onPlaceAward={startAwardPlacement}
      />

      <section
        className="crew-comparison"
        data-metric={activeMetric}
        aria-labelledby="crew-comparison-title"
      >
        <div className="crew-comparison__heading">
          <h2 id="crew-comparison-title">{METRIC_LABEL[activeMetric]}</h2>
          <p className="crew-comparison__window machine-label">
            {METRICS.find((item) => item.id === activeMetric)?.window}
          </p>
        </div>

        <div className="crew-comparison__selector" role="tablist" aria-label="Comparison metric">
          {METRICS.map(({ id, Icon }, index) => (
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
          <ol className="crew-comparison__rows" aria-label={`${METRIC_LABEL[activeMetric]} comparison`}>
            {comparisonRows.map(({ member, summary }) => {
              const formatted = formatComparisonReading(activeMetric, summary);
              const isYou = member.userId === currentUserId;
              const percent = comparisonBarPercent(activeMetric, summary, bestDisplayedValue);
              const barStyle = { "--crew-bar-value": `${percent}%` } as CSSProperties;
              return (
                <li
                  key={member.userId}
                  data-you={isYou || undefined}
                  data-member-color={crewMemberAccent(member.userId, member.accentColor)}
                >
                  <div className="crew-comparison__row-topline">
                    <button
                      type="button"
                      className="crew-comparison__member"
                      aria-label={`Open ${member.displayName}'s Crew Profile`}
                      onClick={() => setSelectedMemberId(member.userId)}
                    >
                      <RunnerIcon icon={member.runnerIcon} size={26} />
                      <span>{member.displayName}</span>
                      {isYou && <span className="crew-comparison__you machine-label">You</span>}
                    </button>
                    <span className="crew-comparison__reading">
                      <span className="data-value">{formatted.value}</span>
                      {formatted.detail && <span className="machine-label">· {formatted.detail}</span>}
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

        {activeCrew.crewDataError && (
          <p className="crew-comparison__error" role="status">
            Crew data unavailable. Showing the last loaded view.
          </p>
        )}
      </section>

      <Section className="crew-recent" icon={<History size={15} strokeWidth={2} />} title="Recent Crew Runs">
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
                propsPending={activeCrew.propsPendingRunIds.includes(run.id)}
                propsError={activeCrew.propsErrors[run.id] ?? null}
                propsAvailable={dashboardData.propsAvailable}
                onOpen={() => setSelectedRunId(run.id)}
                onToggleProps={() => void activeCrew.toggleProps(run.id)}
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
        runs={selectedMemberRuns}
        awards={selectedMemberAwards}
        isOpen={selectedMember !== null && !runDetailFromProfile && !awardDetailFromProfile}
        onClose={() => {
          if (runDetailFromProfile || awardDetailFromProfile) return;
          setSelectedMemberId(null);
        }}
        onSelectRun={(runId) => {
          setRunDetailFromProfile(true);
          setSelectedRunId(runId);
        }}
        onSelectAward={(awardId) => {
          setAwardDetailFromProfile(true);
          setSelectedAwardId(awardId);
        }}
        currentUserId={currentUserId ?? ""}
        propsPendingRunIds={activeCrew.propsPendingRunIds}
        propsErrors={activeCrew.propsErrors}
        propsAvailable={dashboardData.propsAvailable}
        onToggleProps={(runId) => void activeCrew.toggleProps(runId)}
      />

      <CrewRunDetailSheet
        run={selectedRun}
        isOpen={selectedRun !== null}
        currentUserId={currentUserId ?? ""}
        propsPending={selectedRun ? activeCrew.propsPendingRunIds.includes(selectedRun.id) : false}
        propsError={selectedRun ? activeCrew.propsErrors[selectedRun.id] ?? null : null}
        propsAvailable={dashboardData.propsAvailable}
        onToggleProps={() => {
          if (selectedRun) void activeCrew.toggleProps(selectedRun.id);
        }}
        onMoveBlock={selectedRun && selectedRun.userId === currentUserId && selectedRun.crewBuildRow !== null
          ? () => {
            const source = dashboardData.crewBuildRuns.find((run) => run.id === selectedRun.id);
            if (!source) return;
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

      <CrewAwardDetailSheet
        award={selectedAward}
        member={selectedAwardMember}
        isOpen={selectedAward !== null}
        onMoveBlock={selectedAward && selectedAward.winnerUserId === currentUserId && selectedAward.crewBuildRow !== null
          ? () => {
            const awardId = selectedAward.id;
            setSelectedAwardId(null);
            startAwardPlacement(awardId);
          }
          : undefined}
        onClose={() => {
          setSelectedAwardId(null);
          setAwardDetailFromProfile(false);
        }}
      />
    </div>
  );
}
