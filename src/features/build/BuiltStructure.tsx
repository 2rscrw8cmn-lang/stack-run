import { Flag } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import type {
  EarnedBlock,
  MortarLine,
  PhaseBand,
  PlacedBlock as PlacedBlockData,
} from "../../domain/build";
import { GRID_COLUMNS, type PlacementOption } from "../../domain/placement";
import { PlacedBlock } from "./PlacedBlock";
import { LandingSlot } from "./LandingSlot";

export interface StructurePlacing {
  block: EarnedBlock;
  options: PlacementOption[];
  candidate: PlacementOption | null;
  onChoose: (option: PlacementOption) => void;
}

interface BuiltStructureProps {
  blocks: PlacedBlockData[];
  courses: number;
  mortar: MortarLine[];
  projectedCourses: number;
  phaseBands: PhaseBand[];
  onSelectWorkout: (workoutId: string) => void;
  /** Set while a block is hovering over the tower, waiting to be dropped. */
  placing?: StructurePlacing;
}

/**
 * The tower and the site it stands on: ground below, sky above, and a
 * translucent shaft showing how far there is left to climb.
 *
 * The shaft is a height, not a schedule. It says the finished tower is about
 * this tall and the race caps it; it never says which block goes where. The
 * eighteen-week blueprint stays deleted.
 *
 * The tower is one grid rather than a list of course rows, because blocks are
 * now two-dimensional and a two-course block belongs to no single row. Blocks
 * are listed ground first, so reading order matches the order they were built
 * in, and paint order comes from each block's own top edge.
 */
export function BuiltStructure({
  blocks,
  courses,
  mortar,
  projectedCourses,
  phaseBands,
  onSelectWorkout,
  placing,
}: BuiltStructureProps) {
  const skylineRef = useRef<HTMLDivElement>(null);

  // A tower with arches in it can outgrow its projection; never go negative.
  const remainingCourses = Math.max(0, projectedCourses - courses);
  const totalCourses = Math.max(projectedCourses, courses);
  // While placing, the grid has to be tall enough to show the hovering block.
  const candidate = placing?.candidate ?? null;
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

  return (
    <section className="build-site" aria-label="Your build">
      <div className="build-site__heading">
        <h2 className="build-site__title">Your build</h2>
        <p className="build-site__scale">
          {courses} of about {projectedCourses} courses · {blocks.length}{" "}
          {blocks.length === 1 ? "block" : "blocks"}
        </p>
      </div>

      <div className="build-site__stage">
        <ol className="build-site__gauge" aria-label="Training phases">
          {[...phaseBands].reverse().map((band) => (
            <li
              key={band.label}
              className="build-site__phase"
              style={{ "--phase-courses": band.courses } as CSSProperties}
            >
              <span className="build-site__phase-label">{band.label}</span>
            </li>
          ))}
        </ol>

        <div className="build-site__tower">
          <div
            className="build-site__sky"
            style={
              { "--remaining-courses": remainingCourses } as CSSProperties
            }
            aria-hidden="true"
          >
            <p className="build-site__summit">
              <Flag size={14} strokeWidth={2} aria-hidden="true" />
              {`${totalCourses} courses to the race`}
            </p>
            <span className="build-site__capstone" />
            <span className="build-site__shaft" />
          </div>

          <div ref={skylineRef} className="build-site__skyline" aria-hidden="true" />

          <ul
            className="built-tower"
            aria-label="Built blocks"
            style={
              {
                "--grid-columns": GRID_COLUMNS,
                "--grid-courses": drawnCourses,
              } as CSSProperties
            }
          >
            {blocks.map((block) => (
              <PlacedBlock
                key={block.workout.id}
                block={block}
                courses={drawnCourses}
                onSelect={onSelectWorkout}
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
              />
            ))}

            {mortar.map((line) => (
              <li
                key={line.weekNumber}
                className="built-tower__mortar"
                data-active={line.isActiveWeek ? "true" : undefined}
                style={{ "--mortar-row": line.row } as CSSProperties}
              >
                <span className="built-tower__mortar-label" aria-hidden="true">
                  {line.weekNumber}
                </span>
                <span className="visually-hidden">
                  {`Week ${line.weekNumber} tops out at course ${line.row}`}
                </span>
              </li>
            ))}
          </ul>

          <div className="build-site__ground" aria-hidden="true" />
        </div>
      </div>

      <p className="build-site__caption">
        {blocks.length === 0
          ? "Nothing built yet. Complete a run to earn your first block."
          : `${courses} ${courses === 1 ? "course" : "courses"} standing.`}
      </p>
    </section>
  );
}
