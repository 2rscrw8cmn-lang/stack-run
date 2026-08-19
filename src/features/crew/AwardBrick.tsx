import type { CSSProperties } from "react";
import {
  isFeatureCrewAward,
  type CrewAwardType,
} from "../../crew/awards";
import type { CrewMemberAccent } from "../../crew/memberAccent";
import type { RunnerIcon as RunnerIconModel } from "../../crew/runnerIcon";
import { RunnerIcon } from "./RunnerIcon";
import "./awardBlock.css";

function AwardGlyph({ type }: { type: CrewAwardType }) {
  if (type === "miles") return <span className="award-brick__glyph award-brick__glyph--miles"><i /><i /><i /></span>;
  if (type === "zone2") return <span className="award-brick__glyph award-brick__glyph--zone2"><i /><i /></span>;
  if (type === "pace") return <span className="award-brick__glyph award-brick__glyph--pace"><i /><i /><i /></span>;
  if (type === "runs") return <span className="award-brick__glyph award-brick__glyph--runs"><i /><i /><i /></span>;
  if (type === "longHaul") return <span className="award-brick__glyph award-brick__glyph--long"><i /></span>;
  if (type === "steady") return <span className="award-brick__glyph award-brick__glyph--steady"><i /><i /></span>;
  if (type === "onTarget") return <span className="award-brick__glyph award-brick__glyph--target"><i /><i /></span>;
  return <span className="award-brick__glyph award-brick__glyph--level"><i /><i /><i /></span>;
}

interface AwardBrickProps {
  awardType: CrewAwardType;
  runnerIcon: RunnerIconModel;
  runnerAccent?: CrewMemberAccent;
  topFace: readonly boolean[];
  rightFace: readonly boolean[];
}

/**
 * A zero-mile Crew award using the exact same outer 3D face geometry as a run
 * brick. Only the front face changes: runner mark = who, colored glyph = what.
 */
export function AwardBrick({
  awardType,
  runnerIcon,
  runnerAccent,
  topFace,
  rightFace,
}: AwardBrickProps) {
  return (
    <span
      className="placed-block__brick award-brick"
      data-award={awardType}
      data-feature={isFeatureCrewAward(awardType) || undefined}
      aria-hidden="true"
      style={{ "--piece-color": "#171d21" } as CSSProperties}
    >
      <span className="placed-block__face placed-block__face--front award-brick__front">
        <span className="award-brick__runner">
          <RunnerIcon icon={runnerIcon} accent={runnerAccent} size={24} />
        </span>
        <span className="award-brick__badge">
          <AwardGlyph type={awardType} />
        </span>
      </span>
      {topFace.map((visible, column) =>
        visible ? (
          <span
            key={`top-${column}`}
            className="placed-block__face placed-block__face--top award-brick__edge"
            style={{
              "--face-offset": column,
              "--face-cells": topFace.length,
            } as CSSProperties}
          />
        ) : null,
      )}
      {rightFace.map((visible, row) =>
        visible ? (
          <span
            key={`right-${row}`}
            className="placed-block__face placed-block__face--right award-brick__edge"
            style={{
              "--face-offset": row,
              "--face-cells": rightFace.length,
            } as CSSProperties}
          />
        ) : null,
      )}
    </span>
  );
}
