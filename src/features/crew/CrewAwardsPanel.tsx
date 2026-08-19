import { useState } from "react";
import {
  CREW_AWARD_LABEL,
  STANDARD_CREW_AWARD_TYPES,
  formatCrewAwardResult,
  isFeatureCrewAward,
  type CrewAwardWeek,
  type CrewAwardType,
} from "../../crew/awards";
import { clearCrewAwardQaFixture, seedCrewAwardQaFixture } from "../../crew/crewAwardQa";
import type { CrewBuildReadyAward } from "../../crew/crewBuild";
import { crewMemberAccent } from "../../crew/memberAccent";
import type { CrewMember } from "../../crew/types";
import { Button } from "../../components/ui/Button";
import { RunnerIcon } from "./RunnerIcon";
import "./crewAwardsPanel.css";

interface CrewAwardsPanelProps {
  week: CrewAwardWeek | null;
  members: CrewMember[];
  /** Already filtered upstream to awards owned by the current viewer. */
  readyAwards: readonly CrewBuildReadyAward[];
  available: boolean;
  loading: boolean;
  onPlaceAward: (awardId: string) => void;
}

function awardTestModeEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("awardTest") === "1";
}

function AwardStanding({
  type,
  week,
  members,
  feature = false,
}: {
  type: CrewAwardType;
  week: CrewAwardWeek;
  members: CrewMember[];
  feature?: boolean;
}) {
  const leader = week.leaders.find((item) => item.awardType === type) ?? null;
  const member = leader ? members.find((item) => item.userId === leader.userId) ?? null : null;
  return (
    <li className="crew-awards__row" data-feature={feature || undefined} data-award={type}>
      <span className="crew-awards__mark" aria-hidden="true" />
      <span className="crew-awards__name">
        <span className="machine-label">{feature ? "Feature" : "Weekly"}</span>
        <strong>{CREW_AWARD_LABEL[type]}</strong>
      </span>
      {leader && member ? (
        <span
          className="crew-awards__leader"
          data-member-color={crewMemberAccent(member.userId, member.accentColor)}
        >
          <RunnerIcon icon={member.runnerIcon} accent={crewMemberAccent(member.userId, member.accentColor)} size={20} />
          <span>{member.displayName}</span>
          <span className="data-value">{formatCrewAwardResult(type, leader.resultValue)}</span>
        </span>
      ) : (
        <span className="crew-awards__empty machine-label">No qualifier yet</span>
      )}
    </li>
  );
}

function ReadyAwardPrompt({
  readyAwards,
  onPlaceAward,
}: Pick<CrewAwardsPanelProps, "readyAwards" | "onPlaceAward">) {
  const firstReady = readyAwards[0] ?? null;
  if (!firstReady) return null;
  const remaining = Math.max(0, readyAwards.length - 1);

  return (
    <section
      className="crew-award-ready"
      data-award={firstReady.awardType}
      data-feature={isFeatureCrewAward(firstReady.awardType) || undefined}
      aria-labelledby="crew-award-ready-title"
    >
      <span className="crew-award-ready__mark" aria-hidden="true" />
      <div className="crew-award-ready__copy">
        <p className="machine-label">
          {readyAwards.length === 1
            ? "Special Block Ready"
            : `${readyAwards.length} Special Blocks Ready`}
        </p>
        <h2 id="crew-award-ready-title">{CREW_AWARD_LABEL[firstReady.awardType]}</h2>
        <p className="crew-award-ready__result data-value">
          {formatCrewAwardResult(firstReady.awardType, firstReady.resultValue)}
          {remaining > 0 ? ` · +${remaining} more waiting` : ""}
        </p>
      </div>
      <Button variant="primary" onClick={() => onPlaceAward(firstReady.id)}>
        Place Block
      </Button>
    </section>
  );
}

function qaErrorMessage(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason);
  if (message.includes("qa_test_club_owner_required")) {
    return "Seed/Clear is restricted to the owner of TEST CLUB.";
  }
  if (message.includes("qa_second_member_required")) {
    return "TEST CLUB needs at least two members for the split-winner fixture.";
  }
  if (message.toLowerCase().includes("function") && message.toLowerCase().includes("does not exist")) {
    return "Run the temporary QA harness migration first.";
  }
  return message || "QA fixture action failed.";
}

function AwardQaHarness() {
  const [pending, setPending] = useState<"seed" | "clear" | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "seed" | "clear") {
    if (pending) return;
    setPending(action);
    setStatus(null);
    setError(null);
    try {
      const count = action === "seed"
        ? await seedCrewAwardQaFixture()
        : await clearCrewAwardQaFixture();
      setStatus(action === "seed"
        ? `${count} QA award blocks seeded. Reloading…`
        : `${count} QA award blocks cleared. Reloading…`);
      window.setTimeout(() => window.location.reload(), 250);
    } catch (reason) {
      setError(qaErrorMessage(reason));
    } finally {
      setPending(null);
    }
  }

  return (
    <section className="crew-awards-qa" aria-labelledby="crew-awards-qa-title">
      <div>
        <p className="machine-label">Temporary QA Harness</p>
        <h3 id="crew-awards-qa-title">Eight deterministic Special Blocks</h3>
        <p>
          Owner gets Miles, Pace, Long Haul and On Target. The second TEST CLUB member gets
          Zone 2, Runs, Steady and Level Up. All eight start READY so each account can verify
          winner-only placement against the real Supabase RPCs.
        </p>
      </div>
      <div className="crew-awards-qa__actions">
        <Button
          variant="secondary"
          isLoading={pending === "seed"}
          disabled={pending !== null}
          onClick={() => void run("seed")}
        >
          Seed 8 QA Blocks
        </Button>
        <Button
          variant="ghost"
          isLoading={pending === "clear"}
          disabled={pending !== null}
          onClick={() => void run("clear")}
        >
          Clear QA Blocks
        </Button>
      </div>
      {status && <p className="crew-awards-qa__status machine-label" role="status">{status}</p>}
      {error && <p className="crew-awards-qa__error" role="alert">{error}</p>}
    </section>
  );
}

export function CrewAwardsPanel({
  week,
  members,
  readyAwards,
  available,
  loading,
  onPlaceAward,
}: CrewAwardsPanelProps) {
  if (!awardTestModeEnabled()) {
    return <ReadyAwardPrompt readyAwards={readyAwards} onPlaceAward={onPlaceAward} />;
  }

  if (!available && !loading) return <AwardQaHarness />;
  const firstReady = readyAwards[0] ?? null;
  return (
    <div className="crew-awards-test-stack">
      <AwardQaHarness />
      <section className="crew-awards" aria-labelledby="crew-awards-title">
        <div className="crew-awards__heading">
          <div>
            <p className="machine-label">Crew Awards · Test View</p>
            <h2 id="crew-awards-title">Special Blocks</h2>
          </div>
          {firstReady && (
            <Button variant="primary" onClick={() => onPlaceAward(firstReady.id)}>
              {readyAwards.length === 1 ? "Place Award" : `Place Award · ${readyAwards.length}`}
            </Button>
          )}
        </div>
        {loading && !week ? (
          <p className="crew-awards__loading machine-label">Loading this week…</p>
        ) : week ? (
          <ul className="crew-awards__standings" aria-label="This week's Special Block leaders">
            {STANDARD_CREW_AWARD_TYPES.map((type) => (
              <AwardStanding key={type} type={type} week={week} members={members} />
            ))}
            <AwardStanding type={week.featureType} week={week} members={members} feature />
          </ul>
        ) : null}
      </section>
    </div>
  );
}
