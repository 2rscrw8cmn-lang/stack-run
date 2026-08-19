import {
  CREW_AWARD_LABEL,
  STANDARD_CREW_AWARD_TYPES,
  formatCrewAwardResult,
  type CrewAwardBlockRecord,
  type CrewAwardWeek,
  type CrewAwardType,
} from "../../crew/awards";
import type { CrewBuildReadyAward } from "../../crew/crewBuild";
import { crewMemberAccent } from "../../crew/memberAccent";
import type { CrewMember } from "../../crew/types";
import { Button } from "../../components/ui/Button";
import { RunnerIcon } from "./RunnerIcon";
import "./crewAwardsPanel.css";

interface CrewAwardsPanelProps {
  week: CrewAwardWeek | null;
  members: CrewMember[];
  readyAwards: readonly CrewBuildReadyAward[];
  available: boolean;
  loading: boolean;
  onPlaceAward: (awardId: string) => void;
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

export function CrewAwardsPanel({
  week,
  members,
  readyAwards,
  available,
  loading,
  onPlaceAward,
}: CrewAwardsPanelProps) {
  if (!available && !loading) return null;
  const firstReady = readyAwards[0] ?? null;
  return (
    <section className="crew-awards" aria-labelledby="crew-awards-title">
      <div className="crew-awards__heading">
        <div>
          <p className="machine-label">Crew Awards</p>
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
  );
}
