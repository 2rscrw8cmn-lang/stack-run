import { addDaysToLocalDate, formatDateLabel } from "../../domain/dates";
import {
  CREW_AWARD_LABEL,
  formatCrewAwardResult,
  isFeatureCrewAward,
  type CrewAwardBlockRecord,
} from "../../crew/awards";
import { crewMemberAccent } from "../../crew/memberAccent";
import type { CrewMember } from "../../crew/types";
import { Sheet } from "../../components/ui/Sheet";
import { RunnerIcon } from "./RunnerIcon";

export function CrewAwardDetailSheet({
  award,
  member,
  isOpen,
  onClose,
}: {
  award: CrewAwardBlockRecord | null;
  member: CrewMember | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!award) return null;
  const end = addDaysToLocalDate(award.weekStart, 6);
  return (
    <Sheet
      title={CREW_AWARD_LABEL[award.awardType]}
      isOpen={isOpen}
      onClose={onClose}
      className="crew-award-detail"
    >
      <div className="crew-award-detail__body">
        <p className="machine-label">
          {isFeatureCrewAward(award.awardType) ? "Feature Special Block" : "Weekly Special Block"}
        </p>
        {member && (
          <div
            className="crew-award-detail__winner"
            data-member-color={crewMemberAccent(member.userId, member.accentColor)}
          >
            <RunnerIcon
              icon={member.runnerIcon}
              accent={crewMemberAccent(member.userId, member.accentColor)}
              size={38}
            />
            <div>
              <p className="machine-label">Winner</p>
              <p className="data-value">{member.displayName}</p>
            </div>
          </div>
        )}
        <div className="crew-award-detail__result">
          <p className="machine-label">Winning result</p>
          <p className="data-value">{formatCrewAwardResult(award.awardType, award.resultValue)}</p>
        </div>
        <p className="crew-award-detail__week machine-label">
          Week of {formatDateLabel(award.weekStart, { month: "short", day: "numeric" })} — {formatDateLabel(end, { month: "short", day: "numeric" })}
        </p>
        <p className="crew-award-detail__note">
          Award blocks add no mileage. This piece records the weekly win and lives in the Crew Build.
        </p>
      </div>
    </Sheet>
  );
}
