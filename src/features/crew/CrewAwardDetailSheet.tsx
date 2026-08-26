import { Calendar, Flag, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { addDaysToLocalDate, formatDateLabel } from "../../domain/dates.js";
import {
  CREW_AWARD_DESCRIPTION,
  CREW_AWARD_LABEL,
  formatCrewAwardResult,
  isFeatureCrewAward,
  type CrewAwardBlockRecord,
} from "../../crew/awards.js";
import { crewMemberAccent } from "../../crew/memberAccent.js";
import type { CrewMember } from "../../crew/types.js";
import { Button } from "../../components/ui/Button.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { AwardBrick } from "./AwardBrick.js";
import "./awardBlock.css";

function Fact({ icon, label, value, name = false }: { icon: ReactNode; label: string; value: string; name?: boolean }) {
  return (
    <div className="crew-award-detail__fact">
      <span className="crew-award-detail__fact-icon" aria-hidden="true">{icon}</span>
      <div>
        <dt className="machine-label">{label}</dt>
        <dd className={name ? "crew-award-detail__fact-name" : "data-value"}>{value}</dd>
      </div>
    </div>
  );
}

export function CrewAwardDetailSheet({
  award,
  member,
  isOpen,
  onMoveBlock,
  onClose,
}: {
  award: CrewAwardBlockRecord | null;
  member: CrewMember | null;
  isOpen: boolean;
  onMoveBlock?: () => void;
  onClose: () => void;
}) {
  if (!award) return null;
  const end = addDaysToLocalDate(award.weekStart, 6);
  const accent = member ? crewMemberAccent(member.userId, member.accentColor) : null;
  return (
    <Sheet
      title={CREW_AWARD_LABEL[award.awardType]}
      isOpen={isOpen}
      onClose={onClose}
      className="sheet--crew-award-detail"
    >
      <div className="crew-award-detail" data-award={award.awardType}>
        <p className="machine-label crew-award-detail__kind">
          {isFeatureCrewAward(award.awardType) ? "Feature Special Block" : "Weekly Special Block"}
        </p>

        <div className="crew-award-detail__lead">
          {/*
            The trophy is the block itself, at the size the tower can never
            give it — the same `AwardBrick` the Crew Build renders, with both
            depth faces drawn because nothing is stacked on it here.
          */}
          <div className="crew-award-detail__hero">
            <AwardBrick
              awardType={award.awardType}
              pieceColor={accent ? `var(--member-${accent})` : "var(--border-strong)"}
              topFace={[true]}
              rightFace={[true]}
            />
          </div>

          <dl className="crew-award-detail__facts">
            <Fact
              icon={<Trophy size={19} strokeWidth={1.9} />}
              label="Winner"
              value={member?.displayName ?? "Crew member"}
              name
            />
            <Fact
              icon={<Flag size={19} strokeWidth={1.9} />}
              label="Winning result"
              value={formatCrewAwardResult(award.awardType, award.resultValue)}
            />
            <Fact
              icon={<Calendar size={19} strokeWidth={1.9} />}
              label="Week"
              value={`${formatDateLabel(award.weekStart, { month: "short", day: "numeric" })} – ${formatDateLabel(end, { month: "short", day: "numeric" })}`.toUpperCase()}
            />
          </dl>
        </div>

        <p className="crew-award-detail__note">{CREW_AWARD_DESCRIPTION[award.awardType]}</p>

        {onMoveBlock && (
          <div className="crew-award-detail__move">
            <Button variant="secondary" onClick={onMoveBlock}>Move Award Block</Button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
