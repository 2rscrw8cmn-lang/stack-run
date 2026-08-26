import { Blocks } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { EmptyState } from "../../components/ui/EmptyState.js";
import { Section } from "../../components/ui/Section.js";
import {
  WORKOUT_TYPE_LABEL,
  type EarnedBlock,
  type PlacedBlock as PlacedBlockData,
  type TowerVoid,
} from "../../domain/build.js";
import { GRID_COLUMNS, type PlacementOption } from "../../domain/placement.js";
import { PlacedBlock } from "./PlacedBlock.js";
import { LandingSlot } from "./LandingSlot.js";
import { placementImpact } from "./placementDrop.js";
import { useColumnDragPlacement } from "./useColumnDragPlacement.js";

export interface StructurePlacing {
  block: EarnedBlock;
  options: PlacementOption[];
  candidate: PlacementOption | null;
  onChoose: (option: PlacementOption) => void;
  /** Commits the chosen candidate. Release after a drag calls this. */
  onCommit: () => void;
}

interface BuiltStructureProps {
  blocks: PlacedBlockData[];
  courses: number;
  /** Openings the tower spans, drawn so a bridging block is not left floating. */
  voids?: TowerVoid[];
  /** The block this session just committed, while its payoff plays. */
  justPlacedRunLogId?: string | null;
  onSelectBlock: (runLogId: string) => void;
  /** Set while a block is hovering over the tower, waiting to be dropped. */
  placing?: StructurePlacing;
}

/**
 * The tower and the ground it stands on.
 *
 * What used to be here as well — a projected-height shaft, a phase gauge, week
 * mortar lines, a course-count readout — described the packing model rather
 * than the thing built. The tower reads as an object you made; the schedule
 * lives on Plan and the week lives in block detail.
 *
 * The tower is one grid rather than a list of course rows, because blocks are
 * two-dimensional and a two-course block belongs to no single row. Blocks are
 * listed ground first, so reading order matches the order they were built in,
 * and paint order comes from each block's own top edge.
 */
export function BuiltStructure({
  blocks,
  courses,
  voids = [],
  justPlacedRunLogId = null,
  onSelectBlock,
  placing,
}: BuiltStructureProps) {
  const skylineRef = useRef<HTMLDivElement>(null);
  const towerRef = useRef<HTMLUListElement>(null);

  const candidate = placing?.candidate ?? null;

  // The site's own answer to a landing (issue #76): the ground takes the
  // weight of the block that just arrived. Keyed by that block so a second
  // placement replays it rather than inheriting a finished animation, and
  // absent entirely the rest of the time.
  const justPlaced =
    blocks.find((block) => block.placement.runLogId === justPlacedRunLogId) ??
    null;

  // While placing, the grid has to be tall enough to show the hovering block.
  const drawnCourses = Math.max(
    1,
    courses,
    candidate ? candidate.row + placing!.block.footprint.height : 0,
  );

  // Open framed on the top of what has been built, not the foundation, and
  // keep the landing in view while a block is being placed.
  const candidateKey = candidate
    ? `${candidate.columnStart}:${candidate.row}`
    : "";
  useEffect(() => {
    skylineRef.current?.scrollIntoView({ block: "center" });
  }, [candidateKey]);

  // The pointer only ever picks a column: where the block lands is still
  // gravity's answer, so a drag can never place a block somewhere the
  // keyboard could not. Tap, the left/right steppers, and `Auto Place` all
  // stay live — this is a layer over the choices, never the only way to make
  // them. `useColumnDragPlacement` is the same hook Crew Build's tower uses.
  const { grab, trackDrag, release, cancelDrag } = useColumnDragPlacement({
    containerRef: towerRef,
    gridColumns: GRID_COLUMNS,
    width: placing?.block.footprint.width ?? 1,
    options: placing?.options ?? [],
    chosenColumnStart: placing?.candidate?.columnStart,
    onChoose: (option) => placing?.onChoose(option),
    onCommit: () => placing?.onCommit(),
  });

  // An empty site with a ground line and nothing on it reads as a rendering
  // fault rather than a beginning, so the first-run state says so in words.
  if (blocks.length === 0 && !placing) {
    return (
      <Section
        className="build-site"
        icon={<Blocks size={15} strokeWidth={2} />}
        title="Your Build"
      >
        <EmptyState
          icon={<Blocks size={26} strokeWidth={1.6} />}
          title="Nothing built yet"
        >
          Your first completed run earns the first block.
        </EmptyState>
      </Section>
    );
  }

  return (
    <Section
      className="build-site"
      icon={<Blocks size={15} strokeWidth={2} />}
      title="Your Build"
      meta={`${blocks.length} ${blocks.length === 1 ? "block" : "blocks"}`}
    >
      <div className="build-site__stage">
        <div className="build-site__tower">
          <div className="build-site__sky" aria-hidden="true" />

          <div ref={skylineRef} className="build-site__skyline" aria-hidden="true" />

          <ul
            ref={towerRef}
            className="built-tower"
            aria-label="Built blocks"
            onPointerMove={placing ? trackDrag : undefined}
            onPointerUp={placing ? release : undefined}
            onPointerCancel={placing ? cancelDrag : undefined}
            style={
              {
                "--grid-columns": GRID_COLUMNS,
                "--grid-courses": drawnCourses,
              } as CSSProperties
            }
          >
            {voids.map((cell) => (
              <li
                key={`void-${cell.column}:${cell.row}`}
                className="built-tower__void"
                aria-hidden="true"
                style={
                  {
                    gridColumn: cell.column,
                    gridRow: courses === 0 ? 1 : drawnCourses - cell.row,
                  } as CSSProperties
                }
              />
            ))}

            {blocks.map((block) => (
              <PlacedBlock
                key={block.placement.runLogId}
                block={block}
                courses={drawnCourses}
                isJustPlaced={block.placement.runLogId === justPlacedRunLogId}
                onSelect={onSelectBlock}
              />
            ))}

            {placing?.options.map((option) => (
              <LandingSlot
                key={option.columnStart}
                option={option}
                width={placing.block.footprint.width}
                height={placing.block.footprint.height}
                pieceColor={`var(--${placing.block.runLog.activityType})`}
                courses={drawnCourses}
                isChosen={option.columnStart === candidate?.columnStart}
                blockDescription={`${WORKOUT_TYPE_LABEL[placing.block.runLog.activityType]} block`}
                onChoose={placing.onChoose}
                onGrab={grab}
              />
            ))}
          </ul>

          <div
            key={justPlaced ? `ground-${justPlaced.placement.runLogId}` : "ground"}
            className="build-site__ground"
            aria-hidden="true"
            data-impact={
              justPlaced ? placementImpact(justPlaced.placement) : undefined
            }
          />
        </div>
      </div>

      {placing && (
        <p className="build-site__caption">
          Drag and let go, or tap a spot then Drop.
        </p>
      )}
    </Section>
  );
}
