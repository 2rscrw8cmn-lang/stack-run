import { useMemo } from "react";
import { formatMilesBuilt } from "../../domain/distance.js";
import {
  faceCulledRecapSlice,
  type CrewWeekRecapBeat,
} from "../../crew/weekRecap.js";
import { crewMemberAccent } from "../../crew/memberAccent.js";
import { BuildCrop, type BuildCropBlock } from "../build/BuildCrop.js";
import { crewFaceLabel, memberPieceColor } from "./crewBrickFace.js";

/**
 * The week's own slice of the Crew Build, drawn as Crew Build draws it.
 *
 * The one place the recap turns its build beat into blocks, so the Today teaser
 * and the recap frames cannot disagree about the shape of a week. Everything
 * about how a brick looks — the member colour, the stamped mileage, issue
 * #129's hand-logged asterisk, the depth faces — comes from the shared Crew
 * rules rather than being re-derived here.
 */
export function RecapBuildCrop({
  beat,
  scale = "hero",
  className,
  animateSettle = true,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "build" }>;
  scale?: "hero" | "teaser";
  className?: string;
  animateSettle?: boolean;
}) {
  const tower = useMemo(() => faceCulledRecapSlice(beat), [beat]);

  const blocks: BuildCropBlock[] = tower.blocks.map((block) => ({
    id: block.id,
    columnStart: block.columnStart,
    row: block.row,
    width: block.width,
    height: block.height,
    activityType: block.activityType,
    memberColor: crewMemberAccent(block.userId, block.accentColor),
    pieceColor: memberPieceColor(block.userId, block.accentColor),
    label: crewFaceLabel(block),
    topFace: block.topFace,
    rightFace: block.rightFace,
    depth: block.depth,
  }));

  return (
    <BuildCrop
      blocks={blocks}
      voids={tower.voids}
      courses={tower.courses}
      scale={scale}
      className={className}
      animateSettle={animateSettle}
      label={`${beat.blocksPlaced} ${
        beat.blocksPlaced === 1 ? "block" : "blocks"
      } this week added ${formatMilesBuilt(beat.milesPlaced)} miles to the Crew Build.`}
    />
  );
}
