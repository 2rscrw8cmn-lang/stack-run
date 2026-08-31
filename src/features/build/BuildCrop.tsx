import type { CSSProperties } from "react";
import type { PlacedHeight, PlacedWidth } from "../../domain/footprint.js";
import type { GridVoid } from "../../domain/placement.js";
import { GRID_COLUMNS } from "../../domain/placement.js";
import type { CrewAwardType } from "../../crew/awards.js";
import { AwardBrick } from "../crew/AwardBrick.js";
import { Brick, type BrickFaceLabel } from "./Brick.js";
import "./buildCrop.css";

/**
 * A read-only piece of tower.
 *
 * Personal Build and Crew Build each own an interactive tower: placement, drag,
 * selection, landing slots, skyline, the ground plane. A surface that only
 * needs to *show* built blocks — the Crew Week Recap's slice of a week, and its
 * Today teaser — needs none of that, and copying the geometry into a local
 * stylesheet is how a second, drifting tower renderer gets built by accident.
 *
 * So this is the presentation half on its own: the same `built-tower` grid, the
 * same `placed-block` positioning, the same `Brick` / `AwardBrick` faces, the
 * same voids. Callers hand it blocks that are already placed and already
 * face-culled; it draws them and nothing else. `scale` picks the construction
 * tokens, because a crop in a Today module and a crop filling a recap frame are
 * the same object at two sizes, not two objects.
 */

export interface BuildCropBlock {
  id: string;
  columnStart: number;
  /** 0-based course, counted up from the lowest course in the crop. */
  row: number;
  /** The footprint as placed, so a turned block keeps its orientation here. */
  width: PlacedWidth;
  height: PlacedHeight;
  /** CSS custom property reference, e.g. `"var(--member-sky)"`. */
  pieceColor: string;
  /** Present for a run block; award blocks carry their glyph instead. */
  label?: BrickFaceLabel | null;
  awardType?: CrewAwardType;
  /** Member accent name, so the block picks up `--member-accent` like the tower. */
  memberColor?: string;
  activityType?: string;
  topFace: readonly boolean[];
  rightFace: readonly boolean[];
  depth: number;
}

interface BuildCropProps {
  blocks: readonly BuildCropBlock[];
  voids?: readonly GridVoid[];
  courses: number;
  /**
   * `hero` fills a recap frame; `teaser` sits inside a Today module. Both are
   * the same construction, and neither may drop the depth faces — a flattened
   * brick stops reading as built, which is the whole point of showing it.
   */
  scale?: "hero" | "teaser";
  columns?: number;
  /**
   * What the crop is, for a screen reader. The blocks themselves are decoration
   * of facts the frame states in text, so the default is to hide the whole crop
   * rather than announce a pile of rectangles.
   */
  label?: string;
  className?: string;
  /** Staggers the blocks settling in, lowest course first. Reduced Motion drops it. */
  animateSettle?: boolean;
}

export function BuildCrop({
  blocks,
  voids = [],
  courses,
  scale = "hero",
  columns = GRID_COLUMNS,
  label,
  className,
  animateSettle = false,
}: BuildCropProps) {
  const drawnCourses = Math.max(1, courses);
  return (
    <div
      className={["build-crop", className].filter(Boolean).join(" ")}
      data-scale={scale}
      data-settle={animateSettle || undefined}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <ul
        className="built-tower build-crop__tower"
        style={
          {
            "--grid-columns": columns,
            "--grid-courses": drawnCourses,
          } as CSSProperties
        }
      >
        {voids.map((cell) => (
          <li
            key={`void-${cell.column}:${cell.row}`}
            className="built-tower__void"
            style={
              { gridColumn: cell.column, gridRow: drawnCourses - cell.row } as CSSProperties
            }
          />
        ))}

        {blocks.map((block, index) => (
          <li
            key={block.id}
            className="placed-block"
            data-type={block.activityType}
            data-award={block.awardType}
            data-member-color={block.memberColor}
            style={
              {
                gridColumn: `${block.columnStart} / span ${block.width}`,
                gridRow: `${drawnCourses - block.row - block.height + 1} / span ${block.height}`,
                zIndex: block.depth,
                // Lowest course first, so the crop assembles the way it was built.
                "--settle-order": index,
              } as CSSProperties
            }
          >
            {block.awardType ? (
              <AwardBrick
                awardType={block.awardType}
                pieceColor={block.pieceColor}
                topFace={block.topFace}
                rightFace={block.rightFace}
              />
            ) : (
              <Brick
                pieceColor={block.pieceColor}
                label={block.label ?? null}
                topFace={block.topFace}
                rightFace={block.rightFace}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
