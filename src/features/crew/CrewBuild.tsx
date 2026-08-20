import { Dumbbell } from "lucide-react";
import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import {
  formatCompactMiles,
  formatMiles,
  formatMilesBuilt,
} from "../../domain/distance";
import { GRID_COLUMNS, type PlacementOption } from "../../domain/placement";
import { crewMemberAccent } from "../../crew/memberAccent";
import { RunnerIcon } from "./RunnerIcon";
import {
  CREW_BUILD_MIN_VISIBLE_COURSES,
  crewBuildFootprint,
  type CrewBuildBlock,
  type CrewBuildModel,
} from "../../crew/crewBuild";
import type { CrewBuildRun, CrewMember } from "../../crew/types";
import { Button } from "../../components/ui/Button";
import { Brick, type BrickFaceLabel } from "../build/Brick";
import { LandingSlot } from "../build/LandingSlot";
import { PlacementBar } from "../build/PlacementBar";
import { dropMarks, placementImpact } from "../build/placementDrop";
import { useColumnDragPlacement } from "../build/useColumnDragPlacement";

const MAX_VISIBLE_COURSES = 14;

interface CrewBuildPlacementMode {
  run: CrewBuildRun;
  /** Column-only gravity landings, exactly like Personal Build's. */
  options: PlacementOption[];
  candidate: PlacementOption | null;
  pending: boolean;
  error: string | null;
  onChoose: (option: PlacementOption) => void;
  onStep: (direction: -1 | 1) => void;
  onAutoPlace: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface CrewBuildProps {
  model: CrewBuildModel;
  members: CrewMember[];
  available: boolean;
  placement: CrewBuildPlacementMode | null;
  /**
   * The contribution this viewer just placed, while its landing plays. Only
   * an intentional placement sets it: a refresh or a fresh load of the same
   * tower brings every block back already standing (issue #76).
   */
  justPlacedRunId?: string | null;
  onStartReady: () => void;
  onSelectRun: (runId: string) => void;
  /** The member rail is one of Crew Profile's two front doors (issue #120). */
  onSelectMember: (userId: string) => void;
}

function blockLabel(block: CrewBuildBlock): string {
  return [
    block.displayName,
    WORKOUT_TYPE_LABEL[block.activityType],
    `${formatMiles(block.distanceMiles)} miles`,
    formatDateLabel(block.localDate, { month: "long", day: "numeric" }),
    ...(block.recentlyPlaced ? ["newly placed"] : []),
  ].join(", ");
}

/** Same convention as Personal Build's brick face: mileage, RACE, or — for
 * Cross Training, which is often distanceless — a dumbbell instead of a `0`. */
function faceLabel(
  block: Pick<CrewBuildBlock, "activityType" | "distanceMiles" | "width">,
): BrickFaceLabel {
  if (block.activityType === "race") return { text: "RACE", unit: false };
  if (block.activityType === "cross") return { icon: Dumbbell };
  return { text: formatCompactMiles(block.distanceMiles), unit: block.width >= 3 };
}

/** The CSS custom property reference for a member's stable block colour. */
function memberPieceColor(
  userId: string,
  accentColor: Parameters<typeof crewMemberAccent>[1],
): string {
  return `var(--member-${crewMemberAccent(userId, accentColor)})`;
}

function runIdentity(run: Pick<CrewBuildRun, "activityType" | "distanceMiles" | "localDate">) {
  return `${WORKOUT_TYPE_LABEL[run.activityType]} · ${formatMiles(run.distanceMiles)} MI · ${formatDateLabel(run.localDate, { month: "short", day: "numeric" })}`;
}

/**
 * The shared tower and the runner-owned READY interaction that builds it.
 *
 * Reuses Personal Build's brick primitive (`Brick`), landing slot, placement
 * bar and column-drag interaction, per issue #65 — Crew Build is a Crew-
 * scoped skin over the same construction language, not a second renderer.
 * Ownership replaces activity type as the block's colour; the geometry
 * (skyline, gravity, face culling, voids) is computed upstream in
 * `deriveCrewBuild` with the identical helpers Personal Build's view model
 * uses.
 */
export function CrewBuild({
  model,
  members,
  available,
  placement,
  justPlacedRunId = null,
  onStartReady,
  onSelectRun,
  onSelectMember,
}: CrewBuildProps) {
  const towerRef = useRef<HTMLUListElement>(null);
  const skylineRef = useRef<HTMLDivElement>(null);

  const placementFootprint = placement ? crewBuildFootprint(placement.run) : null;
  const candidate = placement?.candidate ?? null;

  /*
   * How many courses the *grid* draws — the tower's own height, and nothing
   * more, exactly like Personal Build. The tall field comes from the
   * viewport below, not from padding this out with empty rows: inflating the
   * grid would push the skyline anchor up into open air, and the scroll that
   * frames it would then carry the built tower off the bottom of the field.
   *
   * While placing it grows by the hovering block's height. That bound is
   * deliberately independent of which column is hovered — a landing can
   * never rest higher than the tower's own skyline, so `courses + height`
   * covers every option the drag can reach. Deriving it from the *current*
   * candidate instead resized the grid on each column change, which
   * re-flowed every block's row and slid the tower vertically under the
   * finger mid-drag.
   */
  const drawnCourses = Math.max(
    1,
    model.courses + (placement ? (placementFootprint?.height ?? 1) : 0),
  );
  /* The field: how much site the stage holds open, tower plus sky. */
  const visibleCourses = Math.min(
    MAX_VISIBLE_COURSES,
    Math.max(CREW_BUILD_MIN_VISIBLE_COURSES, drawnCourses + 1),
  );
  // The block that is landing right now, if it is one of ours and still in
  // the tower — the shared site response reads its footprint for weight.
  const justPlaced =
    model.blocks.find((block) => block.id === justPlacedRunId) ?? null;
  const firstReady = model.viewerReadyRuns[0] ?? null;
  const contributionCount = model.placedCount + model.readyCount;

  const { grab, trackDrag, release, cancelDrag } = useColumnDragPlacement({
    containerRef: towerRef,
    gridColumns: GRID_COLUMNS,
    width: placementFootprint?.width ?? 1,
    options: placement?.options ?? [],
    chosenColumnStart: candidate?.columnStart,
    onChoose: (option) => placement?.onChoose(option),
    onCommit: () => placement?.onConfirm(),
  });

  /*
   * Frame the top of the tower when placement opens.
   *
   * Only when it opens: Crew's field is its own scroll container, so
   * re-running this on every candidate change yanked the viewport (and the
   * page under it) sideways-to-vertically on every column the drag crossed.
   * The grid is already tall enough to show any landing, so there is nothing
   * to chase once the block is in hand.
   */
  const isPlacing = placement !== null;
  useEffect(() => {
    if (isPlacing) {
      skylineRef.current?.scrollIntoView({ block: "center" });
    }
  }, [isPlacing]);

  const stageStyle = {
    "--crew-build-visible-courses": visibleCourses,
  } as CSSProperties;

  return (
    <section
      className="crew-build technical-grid"
      data-placing={placement ? "true" : undefined}
      aria-labelledby="crew-build-title"
    >
      <div className="crew-build__lead">
        <p id="crew-build-title" className="machine-label">Crew Build</p>
        <p className="crew-build__miles data-value">
          {formatMilesBuilt(model.placedMiles)}
          <span className="machine-label">miles built</span>
        </p>
      </div>

      {available && firstReady && !placement && (
        <div className="crew-build__ready" role="status">
          <div>
            <p className="machine-label">
              {model.viewerReadyRuns.length} {model.viewerReadyRuns.length === 1 ? "block" : "blocks"} ready
            </p>
          </div>
          <Button variant="primary" onClick={onStartReady}>
            {model.viewerReadyRuns.length === 1 ? "Place Block" : "Build Now"}
          </Button>
        </div>
      )}

      {placement && (
        <div className="crew-build__placement-lead">
          <p className="machine-label">Place your block</p>
          <p className="data-value">{runIdentity(placement.run)}</p>
          <p>Drag sideways or tap a spot. Your block will land where it fits.</p>
        </div>
      )}

      {!available ? (
        <p className="crew-build__unavailable">Crew Build unavailable.</p>
      ) : contributionCount === 0 && !placement ? (
        <div className="crew-build__stage crew-build__stage--empty" style={stageStyle}>
          <div className="crew-build__field" aria-hidden="true" />
          <div className="crew-build__ground" aria-hidden="true" />
          <p className="crew-build__empty">The first shared run earns the first Crew block.</p>
        </div>
      ) : (
        <div className="crew-build__stage" style={stageStyle}>
          <div className="crew-build__viewport">
            <div className="crew-build__sky" aria-hidden="true" />
            <div ref={skylineRef} className="crew-build__skyline" aria-hidden="true" />
            {/*
              `built-tower` is Personal Build's own grid class, not a lookalike:
              it carries the shared course height and the depth padding the 3D
              faces need to overhang into (issue #65).
            */}
            <ul
              ref={towerRef}
              className="built-tower crew-build__tower"
              aria-label={placement ? "Choose a Crew Build position" : "Crew Build blocks"}
              data-placement-grid={placement ? "true" : undefined}
              style={
                {
                  "--grid-columns": GRID_COLUMNS,
                  "--grid-courses": drawnCourses,
                } as CSSProperties
              }
              onPointerMove={placement ? trackDrag : undefined}
              onPointerUp={placement ? release : undefined}
              onPointerCancel={placement ? cancelDrag : undefined}
            >
              {model.voids.map((cell) => (
                <li
                  key={`void-${cell.column}:${cell.row}`}
                  className="built-tower__void"
                  aria-hidden="true"
                  style={
                    {
                      gridColumn: cell.column,
                      gridRow: drawnCourses - cell.row,
                    } as CSSProperties
                  }
                />
              ))}

              {model.blocks.map((block) => (
                <li
                  key={block.id}
                  className="placed-block"
                  data-type={block.activityType}
                  data-row={block.row}
                  data-column-start={block.columnStart}
                  data-member-color={crewMemberAccent(block.userId, block.accentColor)}
                  data-recent={block.recentlyPlaced || undefined}
                  // Personal Build's landing marks, on Personal Build's block
                  // class: the shared Build language, not a Crew copy of it.
                  {...dropMarks(block.id === justPlacedRunId, block)}
                  style={
                    {
                      gridColumn: `${block.columnStart} / span ${block.width}`,
                      gridRow: `${drawnCourses - block.row - block.height + 1} / span ${block.height}`,
                      zIndex: block.depth,
                    } as CSSProperties
                  }
                >
                  <button
                    type="button"
                    className="placed-block__button"
                    onClick={() => onSelectRun(block.id)}
                  >
                    <span className="visually-hidden">{blockLabel(block)}</span>
                    <Brick
                      pieceColor={memberPieceColor(block.userId, block.accentColor)}
                      label={faceLabel(block)}
                      topFace={block.topFace}
                      rightFace={block.rightFace}
                    />
                  </button>
                </li>
              ))}

              {placement && placementFootprint &&
                placement.options.map((option) => (
                  <LandingSlot
                    key={option.columnStart}
                    option={option}
                    width={placementFootprint.width}
                    height={placementFootprint.height}
                    pieceColor={memberPieceColor(placement.run.userId, placement.run.accentColor)}
                    courses={drawnCourses}
                    isChosen={option.columnStart === candidate?.columnStart}
                    blockDescription={`${WORKOUT_TYPE_LABEL[placement.run.activityType]} block`}
                    onChoose={placement.onChoose}
                    onGrab={grab}
                  />
                ))}
            </ul>
          </div>
          <div
            key={justPlaced ? `ground-${justPlaced.id}` : "ground"}
            className="crew-build__ground"
            aria-hidden="true"
            data-impact={justPlaced ? placementImpact(justPlaced) : undefined}
          />
          {!placement && (model.blocks.length === 0 || drawnCourses > MAX_VISIBLE_COURSES) && (
            <p className="crew-build__caption">
              {model.blocks.length === 0
                ? `${model.readyCount} ${model.readyCount === 1 ? "block is" : "blocks are"} earned and ready to build.`
                : "Scroll the field for more courses."}
            </p>
          )}
        </div>
      )}

      {placement && (
        <PlacementBar
          pieceColor={memberPieceColor(placement.run.userId, placement.run.accentColor)}
          width={placementFootprint?.width ?? 1}
          height={placementFootprint?.height ?? 1}
          title={`${placement.run.crewBuildRow === null ? "Place" : "Move"} ${WORKOUT_TYPE_LABEL[placement.run.activityType]}`}
          positionLabel={candidate ? `Column ${candidate.columnStart}` : null}
          showPositionLabel={false}
          canStepBack={
            !!candidate &&
            placement.options.findIndex((option) => option.columnStart === candidate.columnStart) > 0
          }
          canStepForward={
            !!candidate &&
            placement.options.findIndex((option) => option.columnStart === candidate.columnStart) <
              placement.options.length - 1
          }
          onStep={placement.onStep}
          onAutoPlace={placement.onAutoPlace}
          onDrop={placement.onConfirm}
          onCancel={placement.onCancel}
          pending={placement.pending}
          error={placement.error}
        />
      )}

      {available && model.truncated && (
        <p className="crew-build__notice" role="status">
          Showing {model.runCount} shared runs.
        </p>
      )}

      {/*
        The runners, as a single icon-only row (issue #120). A named legend
        wrapped onto a second and third line as the crew grew, and every line
        it took came out of the tower above it. Names live one tap away in
        Crew Profile — and, permanently, in each icon's accessible name.
      */}
      {members.length > 0 && (
        <ul className="crew-build__rail" aria-label="Crew Build runners">
          {members.map((member) => (
            <li key={member.userId} data-member-color={crewMemberAccent(member.userId, member.accentColor)}>
              <button
                type="button"
                className="crew-build__rail-runner"
                aria-label={`Open ${member.displayName}'s Crew Profile`}
                onClick={() => onSelectMember(member.userId)}
              >
                <RunnerIcon icon={member.runnerIcon} size={30} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {members.length === 1 && (
        <p className="crew-build__invite-note">Invite your crew to build together.</p>
      )}
    </section>
  );
}
