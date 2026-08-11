import { Blocks } from "lucide-react";
import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useRef } from "react";
import { EmptyState } from "../../components/ui/EmptyState";
import { Section } from "../../components/ui/Section";
import type {
  EarnedBlock,
  PlacedBlock as PlacedBlockData,
  TowerVoid,
} from "../../domain/build";
import { GRID_COLUMNS, type PlacementOption } from "../../domain/placement";
import { PlacedBlock } from "./PlacedBlock";
import { LandingSlot } from "./LandingSlot";

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
 * How far a pointer has to travel before it counts as a drag rather than a
 * tap. Below this a finger that wobbles on the way up is still a tap, and a
 * tap must never commit a placement — it selects, and the user commits with
 * `Drop`. Above it the user is unmistakably carrying the block somewhere.
 */
const DRAG_THRESHOLD_PX = 8;

interface DragSession {
  pointerId: number;
  startX: number;
  /** Set once the pointer has travelled past the threshold. */
  isDrag: boolean;
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
  const dragRef = useRef<DragSession | null>(null);

  const candidate = placing?.candidate ?? null;
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

  /**
   * Dragging the hovering block, snapped to the same valid columns tapping
   * offers. The pointer only picks a column: where the block lands is still
   * gravity's answer, so a drag can never place a block somewhere the keyboard
   * could not. Tap, the left/right steppers, and `Auto Place` all stay live —
   * this is a layer over the choices, never the only way to make them.
   */
  function dragToColumn(clientX: number) {
    const tower = towerRef.current;
    if (!tower || !placing || placing.options.length === 0) {
      return;
    }
    const bounds = tower.getBoundingClientRect();
    const columnWidth = bounds.width / GRID_COLUMNS;
    if (columnWidth <= 0) {
      return;
    }

    const width = placing.block.footprint.width;
    // Centre the block under the finger rather than pinning its left edge.
    const wanted = Math.round(
      (clientX - bounds.left) / columnWidth - width / 2 + 1,
    );
    const nearest = placing.options.reduce((best, option) =>
      Math.abs(option.columnStart - wanted) <
      Math.abs(best.columnStart - wanted)
        ? option
        : best,
    );
    if (nearest.columnStart !== placing.candidate?.columnStart) {
      placing.onChoose(nearest);
    }
  }

  /**
   * Picking the block up, from wherever the finger went down.
   *
   * Every landing gets this, not only the chosen one. A block three columns
   * wide has a landing starting at six different columns and they overlap, so
   * the topmost thing under a finger is usually not the slot the block is
   * currently sitting in — gating this on "chosen" meant a press in most of
   * the tower started no drag at all. Pressing anywhere brings the block to
   * the finger and takes hold of it, which is also what "drag the block where
   * you want it" ought to mean.
   *
   * Capture is taken on the slot the press landed on so the block keeps
   * following a finger that slides off it. The move and release handlers live
   * on the tower rather than the slot for the same reason: the slot that was
   * grabbed stops being the chosen one the moment the drag reaches the next
   * column.
   */
  function grab(event: PointerEvent<HTMLElement>, option: PlacementOption) {
    if (!placing) {
      return;
    }
    if (option.columnStart !== placing.candidate?.columnStart) {
      placing.onChoose(option);
    }
    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      isDrag: false,
    };
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }

  function trackDrag(event: PointerEvent<HTMLElement>) {
    const session = dragRef.current;
    // `buttons` is 0 for a mouse merely passing over the tower.
    if (!session || session.pointerId !== event.pointerId || event.buttons === 0) {
      return;
    }
    if (Math.abs(event.clientX - session.startX) >= DRAG_THRESHOLD_PX) {
      session.isDrag = true;
    }
    if (session.isDrag) {
      dragToColumn(event.clientX);
    }
  }

  /**
   * Letting go. Release commits only after a deliberate drag, per D-045 — a
   * plain tap on a landing selects it and leaves `Drop` to commit, which is
   * what keeps the tap and keyboard paths honest.
   */
  function release(event: PointerEvent<HTMLElement>) {
    const session = dragRef.current;
    dragRef.current = null;
    if (!session || session.pointerId !== event.pointerId || !session.isDrag) {
      return;
    }
    placing?.onCommit();
  }

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
            onPointerCancel={placing ? () => { dragRef.current = null; } : undefined}
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
                block={placing.block}
                courses={drawnCourses}
                isChosen={option.columnStart === candidate?.columnStart}
                onChoose={placing.onChoose}
                onGrab={grab}
              />
            ))}
          </ul>

          <div className="build-site__ground" aria-hidden="true" />
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
