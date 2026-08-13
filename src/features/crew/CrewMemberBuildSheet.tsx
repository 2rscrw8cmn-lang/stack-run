import type { CSSProperties } from "react";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles, formatMilesBuilt } from "../../domain/distance";
import type { CrewMiniBuildModel } from "../../crew/miniBuild";
import type { CrewMember } from "../../crew/types";
import { crewMemberAccent } from "../../crew/memberAccent";
import { RunnerIcon } from "./RunnerIcon";

interface CrewMemberBuildSheetProps {
  member: CrewMember | null;
  model: CrewMiniBuildModel | null;
  milesBuilt: number;
  isOpen: boolean;
  onClose: () => void;
  onSelectRun: (runId: string) => void;
}

function blockLabel(memberName: string, block: CrewMiniBuildModel["blocks"][number]) {
  return `Open ${memberName}'s ${WORKOUT_TYPE_LABEL[block.activityType]} on ${formatDateLabel(
    block.localDate,
    { weekday: "long", month: "long", day: "numeric" },
  )}, ${formatMiles(block.distanceMiles)} miles`;
}

export function CrewMemberBuildSheet({
  member,
  model,
  milesBuilt,
  isOpen,
  onClose,
  onSelectRun,
}: CrewMemberBuildSheetProps) {
  if (!member || !model) return null;
  const courses = Math.max(1, model.courses);

  return (
    <Sheet
      className="sheet--crew-member-build"
      title="Member Build"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div
        className="crew-member-build"
        data-member-color={crewMemberAccent(member.userId, member.accentColor)}
      >
        <header className="crew-member-build__heading">
          <p className="crew-member-build__name">
            <RunnerIcon icon={member.runnerIcon} size={32} />
            <span>{member.displayName}</span>
          </p>
          <p className="crew-member-build__miles data-value">
            {formatMilesBuilt(milesBuilt)} <span className="machine-label">miles built</span>
          </p>
        </header>

        {model.blocks.length === 0 ? (
          <p className="crew-member-build__empty">No shared blocks yet.</p>
        ) : (
          <div className="crew-member-build__stage">
            <ul
              className="crew-member-build__tower"
              aria-label={`${member.displayName}'s shared Build blocks`}
              style={{ "--crew-build-courses": courses } as CSSProperties}
            >
              {model.blocks.map((block) => (
                <li
                  key={block.id}
                  data-type={block.activityType}
                  data-row={block.row}
                  data-column-start={block.columnStart}
                  style={{
                    gridColumn: `${block.columnStart} / span ${block.width}`,
                    gridRow: `${courses - block.row - block.height + 1} / span ${block.height}`,
                  }}
                >
                  <button
                    type="button"
                    aria-label={blockLabel(member.displayName, block)}
                    onClick={() => onSelectRun(block.id)}
                  >
                    <span aria-hidden="true">
                      {block.activityType === "race" ? "RACE" : formatMiles(block.distanceMiles)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <div className="crew-member-build__ground" aria-hidden="true" />
          </div>
        )}

        <p className="crew-member-build__count machine-label">
          {model.blocks.length} {model.blocks.length === 1 ? "block" : "blocks"}
        </p>
      </div>
    </Sheet>
  );
}
