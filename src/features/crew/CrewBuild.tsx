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
  onStartReady: () => void;
  onSelectRun: (runId: string) => void;
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

function faceLabel(
  block: Pick<CrewBuildBlock, "activityType" | "distanceMiles" | "width">,
): BrickFaceLabel {
  return block.activityType === "race"
    ? { text: "RACE", unit: false }
    : { text: formatCompactMiles(block.distanceMiles), unit: block.width >= 3 };
}

function memberInitial(displayName: string): string {
  return displayName ? displayName[0].toUpperCase() : "?";
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
  onStartReady,
  onSelectRun,
}: CrewBuildProps) {
  const towerRef = useRef<HTMLUListElement>(null);
  const skylineRef = useRef<HTMLDivElement>(null);

  const placementFootprint = placement ? crewBuildFootprint(placement.run) : null;
  const candidate = placement?.candidate ?? null;
  const drawnCourses = placement
    ? Math.max(
      CREW_BUILD_MIN_VISIBLE_COURSES,
      model.courses + 3,
      candidate && placementFootprint ? candidate.row + placementFootprint.height + 1 : 0,
    )
    : Math.max(1, model.courses);
  const visibleCourses = Math.min(
    MAX_VISIBLE_COURSES,
    Math.max(CREW_BUILD_MIN_VISIBLE_COURSES, drawnCourses + (placement ? 0 : 1)),
  );
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

  // Keep the landing in view while a block is being placed, the same way
  // Personal Build's tower does.
  const candidateKey = candidate ? `${candidate.columnStart}:${candidate.row}` : "";
  useEffect(() => {
    if (placement) {
      skylineRef.current?.scrollIntoView({ block: "center" });
    }
  }, [placement, candidateKey]);

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
          <p>Drag sideways or tap a column. Your block snaps to the eight-column Build and lands where gravity puts it.</p>
        </div>
      )}

      {!available ? (
        <p className="crew-build__unavailable">Crew Build unavailable.</p>
      ) : contributionCount === 0 && !placement ? (
        <div className="crew-build__stage crew-build__stage--empty" style={stageStyle}>
          <div className="crew-build__sky" aria-hidden="true" />
          <div className="crew-build__field" aria-hidden="true" />
          <div className="crew-build__ground" aria-hidden="true" />
          <p className="crew-build__empty">The first shared run earns the first Crew block.</p>
        </div>
      ) : (
        <div className="crew-build__stage" style={stageStyle}>
          <div className="crew-build__sky" aria-hidden="true" />
          <div className="crew-build__viewport">
            <div ref={skylineRef} className="crew-build__skyline" aria-hidden="true" />
            <ul
              ref={towerRef}
              className="crew-build__tower"
              aria-label={placement ? "Choose a Crew Build position" : "Crew Build blocks"}
              data-placement-grid={placement ? "true" : undefined}
              style={{ "--crew-build-courses": drawnCourses } as CSSProperties}
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
                      monogram={memberInitial(block.displayName)}
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
          <div className="crew-build__ground" aria-hidden="true" />
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

      {members.length > 0 && (
        <ul className="crew-build__legend" aria-label="Crew Build runners">
          {members.map((member) => (
            <li key={member.userId} data-member-color={crewMemberAccent(member.userId, member.accentColor)}>
              <span className="crew-member-marker" aria-hidden="true" />
              <span>{member.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
