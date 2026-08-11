import {
  BarChart3,
  CalendarCheck2,
  History,
  Layers3,
  Mountain,
  RefreshCw,
  UserRoundPlus,
  Users,
  WifiOff,
  type LucideIcon,
} from "lucide-react";
import {
  useEffect,
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
import type { RaceCrewController } from "../../crew/useRaceCrew";
import type { CrewMemberSummary, CrewSharedRun } from "../../crew/types";
import {
  comparisonBarPercent,
  comparisonValue,
  orderedComparisonRows,
  type ComparisonMetric,
} from "../../crew/comparisons";
import { crewFreshness } from "../../crew/freshness";
import { crewMemberAccent } from "../../crew/memberAccent";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
import { CrewRunDetailSheet } from "./CrewRunDetailSheet";
import { CrewRunRow } from "./CrewRunRow";

const METRIC_LABEL: Record<ComparisonMetric, string> = {
  "weekly-miles": "Weekly Miles",
  "longest-run": "Longest Run",
  consistency: "Consistency",
  "miles-built": "Miles Built",
};

const METRICS: Array<{
  id: ComparisonMetric;
  shortLabel: string;
  window: string;
  Icon: LucideIcon;
}> = [
  { id: "weekly-miles", shortLabel: "Miles", window: "This week", Icon: BarChart3 },
  { id: "longest-run", shortLabel: "Long", window: "Trailing 28 days", Icon: Mountain },
  { id: "consistency", shortLabel: "Consist", window: "Recent plan weeks", Icon: CalendarCheck2 },
  { id: "miles-built", shortLabel: "Built", window: "All time", Icon: Layers3 },
];

interface CrewRunsViewProps {
  crew: RaceCrewController | null;
  onOpenAccountCrew: () => void;
}

function formattedComparison(metric: ComparisonMetric, summary: CrewMemberSummary | null) {
  const value = comparisonValue(metric, summary);
  if (value === null || !summary) return { value: "—", detail: null };
  if (metric === "consistency") {
    return {
      value: `${Math.round(value * 100)}%`,
      detail: `${summary.consistencyCompleted} / ${summary.consistencyDue}`,
    };
  }
  return { value: `${formatMiles(value)} MI`, detail: null };
}

function raceDateLabel(date: string): string | null {
  if (!date) return null;
  try {
    return formatDateLabel(date, { month: "short", day: "numeric" });
  } catch {
    return null;
  }
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

export function CrewRunsView({ crew, onOpenAccountCrew }: CrewRunsViewProps) {
  const [metric, setMetric] = useState<ComparisonMetric>("weekly-miles");
  const [selectedRun, setSelectedRun] = useState<CrewSharedRun | null>(null);
  const metricRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const currentCrew = crew?.account?.crew ?? null;
  const currentCrewId = currentCrew?.id ?? null;
  const crewStatus = crew?.status;
  const refreshCrewData = crew?.refreshCrewData;

  useEffect(() => {
    if (crewStatus === "signed-in" && currentCrewId && refreshCrewData) {
      void refreshCrewData(false);
    }
  }, [crewStatus, currentCrewId, refreshCrewData]);

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
        Personal Runs is still available under You.
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
        icon={<Users size={24} strokeWidth={1.6} />}
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
        Race Crew could not be reached. Personal Runs is still available under You.
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

  const members = crew.crewData.members;
  const comparisonRows = orderedComparisonRows(metric, members, crew.crewData.summaries);
  const currentUserId = crew.account?.profile.id;
  const freshness = crewFreshness(crew.crewData.summaries);
  const maxDisplayedValue = comparisonRows.reduce((maximum, row) => {
    const value = comparisonValue(metric, row.summary);
    return value === null ? maximum : Math.max(maximum, value);
  }, 0);
  const raceFacts = [
    raceDateLabel(currentCrew.raceDate),
    currentCrew.raceName?.trim() || null,
    currentCrew.raceDistanceMiles > 0 ? `${formatMiles(currentCrew.raceDistanceMiles)} MI` : null,
    `${members.length} ${members.length === 1 ? "runner" : "runners"}`,
  ].filter(Boolean);

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
      <header className="crew-view__header technical-grid">
        <h2>{currentCrew.name}</h2>
        {raceFacts.length > 0 && <p className="crew-view__race">{raceFacts.join(" · ")}</p>}
      </header>

      <section
        className="crew-comparison technical-grid"
        data-metric={metric}
        aria-labelledby="crew-comparison-title"
      >
        <div className="crew-comparison__heading">
          <p className="machine-label">{METRICS.find((item) => item.id === metric)?.window}</p>
          <IconButton
            className="crew-comparison__refresh"
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

        <div className="crew-comparison__selector" role="tablist" aria-label="Comparison metric">
          {METRICS.map(({ id, shortLabel, Icon }, index) => (
            <button
              key={id}
              ref={(element) => { metricRefs.current[index] = element; }}
              id={`crew-metric-${id}`}
              type="button"
              role="tab"
              aria-label={METRIC_LABEL[id]}
              aria-selected={metric === id}
              aria-controls="crew-comparison-chart"
              tabIndex={metric === id ? 0 : -1}
              data-metric={id}
              onClick={() => setMetric(id)}
              onKeyDown={(event) => changeMetricFromKeyboard(event, index)}
            >
              <Icon size={17} strokeWidth={1.9} aria-hidden="true" />
              <span>{shortLabel}</span>
            </button>
          ))}
        </div>

        <h3 id="crew-comparison-title">{METRIC_LABEL[metric]}</h3>

        <div
          id="crew-comparison-chart"
          role="tabpanel"
          aria-labelledby={`crew-metric-${metric}`}
        >
          <ol
            className="crew-comparison__rows"
            aria-label={`${METRIC_LABEL[metric]} comparison`}
          >
            {comparisonRows.map(({ member, summary }) => {
              const formatted = formattedComparison(metric, summary);
              const isYou = member.userId === currentUserId;
              const percent = comparisonBarPercent(metric, summary, maxDisplayedValue);
              const barStyle = { "--crew-bar-value": `${percent}%` } as CSSProperties;
              return (
                <li
                  key={member.userId}
                  data-you={isYou || undefined}
                  data-member-color={crewMemberAccent(member.userId)}
                >
                  <div className="crew-comparison__row-topline">
                    <span className="crew-comparison__member">
                      <span className="crew-member-marker" aria-hidden="true" />
                      <span>{member.displayName}</span>
                      {isYou && <span className="crew-comparison__you machine-label">You</span>}
                    </span>
                    <span className="crew-comparison__reading">
                      <span className="data-value">{formatted.value}</span>
                      {formatted.detail && <span className="machine-label">{formatted.detail}</span>}
                    </span>
                  </div>
                  <span
                    className="crew-comparison__bar"
                    data-empty={percent === 0 || undefined}
                    data-unavailable={comparisonValue(metric, summary) === null || undefined}
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

        {freshness && (
          <p
            className="crew-comparison__freshness machine-label"
            data-warning={freshness.warning || undefined}
          >
            {freshness.label}
          </p>
        )}
        {members.length === 1 && (
          <p className="crew-comparison__invite-note">
            Invite your crew to start comparing training.
          </p>
        )}
        {crew.crewDataError && (
          <p className="crew-comparison__error" role="status">
            Crew data unavailable. Showing the last loaded view.
          </p>
        )}
      </section>

      <Section
        className="crew-recent"
        icon={<History size={15} strokeWidth={2} />}
        title="Recent Crew Runs"
      >
        {crew.crewData.runs.length === 0 ? (
          <p className="crew-recent__empty">No crew runs yet.</p>
        ) : (
          <ul className="crew-recent__list">
            {crew.crewData.runs.map((run) => (
              <CrewRunRow key={run.id} run={run} onOpen={() => setSelectedRun(run)} />
            ))}
          </ul>
        )}
      </Section>

      <CrewRunDetailSheet
        run={selectedRun}
        isOpen={selectedRun !== null}
        onClose={() => setSelectedRun(null)}
      />
    </div>
  );
}
