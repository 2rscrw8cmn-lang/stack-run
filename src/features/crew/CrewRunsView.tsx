import { History, RefreshCw, UserRoundPlus, Users, WifiOff } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "../../components/ui/Button";
import { EmptyState } from "../../components/ui/EmptyState";
import { Section } from "../../components/ui/Section";
import type { RaceCrewController } from "../../crew/useRaceCrew";
import type { CrewMemberSummary, CrewSharedRun } from "../../crew/types";
import {
  comparisonValue,
  orderedComparisonRows,
  type ComparisonMetric,
} from "../../crew/comparisons";
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

function freshnessLabel(summaries: readonly CrewMemberSummary[]): string | null {
  const newest = summaries
    .map((summary) => summary.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  if (!newest || Number.isNaN(new Date(newest).getTime())) return null;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(newest));
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
  const freshness = freshnessLabel(crew.crewData.summaries);
  const raceFacts = [
    raceDateLabel(currentCrew.raceDate),
    currentCrew.raceName?.trim() || null,
    currentCrew.raceDistanceMiles > 0 ? `${formatMiles(currentCrew.raceDistanceMiles)} MI` : null,
  ].filter(Boolean);

  return (
    <div className="crew-view">
      <header className="crew-view__header technical-grid">
        <p className="machine-label">Race Crew</p>
        <h2>{currentCrew.name}</h2>
        {raceFacts.length > 0 && <p className="crew-view__race">{raceFacts.join(" · ")}</p>}
        <p className="crew-view__count machine-label">
          {members.length} {members.length === 1 ? "runner" : "runners"}
        </p>
      </header>

      <section className="crew-comparison" aria-labelledby="crew-comparison-title">
        <div className="crew-comparison__heading">
          <div>
            <p className="machine-label">Comparison</p>
            <h3 id="crew-comparison-title">{METRIC_LABEL[metric]}</h3>
          </div>
          <Button
            variant="ghost"
            className="crew-comparison__refresh"
            icon={<RefreshCw size={15} strokeWidth={1.8} />}
            isLoading={crew.crewDataStatus === "loading"}
            onClick={() => void crew.refreshCrewData(true)}
          >
            Refresh
          </Button>
        </div>

        <label className="crew-comparison__selector">
          <span className="visually-hidden">Comparison metric</span>
          <select
            value={metric}
            aria-label="Comparison metric"
            onChange={(event) => setMetric(event.target.value as ComparisonMetric)}
          >
            <option value="weekly-miles">Weekly Miles</option>
            <option value="longest-run">Longest Run</option>
            <option value="consistency">Consistency</option>
            <option value="miles-built">Miles Built</option>
          </select>
        </label>

        <ol className="crew-comparison__rows">
          {comparisonRows.map(({ member, summary }) => {
            const formatted = formattedComparison(metric, summary);
            const isYou = member.userId === currentUserId;
            return (
              <li key={member.userId} data-you={isYou || undefined}>
                <span className="crew-comparison__member">
                  <span>{member.displayName}</span>
                  {isYou && <span className="crew-comparison__you machine-label">You</span>}
                </span>
                <span className="crew-comparison__reading">
                  <span className="data-value">{formatted.value}</span>
                  {formatted.detail && <span className="machine-label">{formatted.detail}</span>}
                </span>
              </li>
            );
          })}
        </ol>

        {freshness && <p className="crew-comparison__freshness machine-label">Updated {freshness}</p>}
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
