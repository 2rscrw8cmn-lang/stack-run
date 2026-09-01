import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import { formatMiles, formatMilesBuilt } from "../../domain/distance.js";
import { formatTotalHoursMinutes } from "../../domain/duration.js";
import { isManualRun } from "../../domain/runSource.js";
import type { PlacedFootprint } from "../../domain/footprint.js";
import { GRID_UNITS, type PlacementOption } from "../../domain/placement.js";
import {
  CREW_AWARD_LABEL,
  formatCrewAwardResult,
  type CrewAwardBlockRecord,
} from "../../crew/awards.js";
import { crewMemberAccent } from "../../crew/memberAccent.js";
import {
  CREW_BUILD_MIN_VISIBLE_COURSES,
  type CrewBuildBlock,
  type CrewBuildModel,
  type CrewBuildRunBlock,
} from "../../crew/crewBuild.js";
import type { CrewBuildTotals } from "../../crew/crewTotals.js";
import type { CrewBuildRun, CrewMember } from "../../crew/types.js";
import { Button } from "../../components/ui/Button.js";
import { Brick } from "../build/Brick.js";
import { crewFaceLabel, memberPieceColor } from "./crewBrickFace.js";
import { LandingSlot } from "../build/LandingSlot.js";
import { PlacementBar } from "../build/PlacementBar.js";
import { PlacementContext } from "../build/PlacementContext.js";
import { blockIdentity, placementHint } from "../build/placementHand.js";
import { dropMarks, placementImpact } from "../build/placementDrop.js";
import { useColumnDragPlacement } from "../build/useColumnDragPlacement.js";
import { AwardBrick } from "./AwardBrick.js";
import { RunnerIcon } from "./RunnerIcon.js";

const MAX_VISIBLE_COURSES = 14;

interface PlacementBase {
  /** One lowest structurally valid landing for each horizontal anchor. */
  options: PlacementOption[];
  candidate: PlacementOption | null;
  /**
   * The footprint as currently turned. Rotation changes the grid footprint
   * rather than the artwork, so the landings, the ghost and the headroom are
   * all measured from this rather than from what the run earned.
   */
  footprint: PlacedFootprint;
  rotated: boolean;
  /** Why the block cannot be dropped where it stands, when it cannot. */
  blockedReason: string | null;
  /** False for a square block, which has no second orientation to offer. */
  canRotate: boolean;
  pending: boolean;
  error: string | null;
  onChoose: (option: PlacementOption) => void;
  onStep: (direction: -1 | 1) => void;
  onRotate: () => void;
  onAutoPlace: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export type CrewBuildPlacementMode =
  | (PlacementBase & { kind: "run"; run: CrewBuildRun })
  | (PlacementBase & { kind: "award"; award: CrewAwardBlockRecord; member: CrewMember });

interface CrewBuildProps {
  model: CrewBuildModel;
  /** Crew-wide totals for the selected crew's Build window (issue #137). */
  totals: CrewBuildTotals;
  members: CrewMember[];
  available: boolean;
  placement: CrewBuildPlacementMode | null;
  justPlacedRunId?: string | null;
  justPlacedAwardId?: string | null;
  onStartReady: () => void;
  onSelectRun: (runId: string) => void;
  onSelectAward: (awardId: string) => void;
  onSelectMember: (userId: string) => void;
}

function runBlockLabel(block: CrewBuildRunBlock): string {
  return [
    block.displayName,
    WORKOUT_TYPE_LABEL[block.activityType],
    `${formatMiles(block.distanceMiles)} miles`,
    // The asterisk on the face is decoration a screen reader never reaches,
    // so the accessible name says the same thing in words.
    ...(isManualRun(block) ? ["manual entry"] : []),
    formatDateLabel(block.localDate, { month: "long", day: "numeric" }),
    ...(block.recentlyPlaced ? ["newly placed"] : []),
  ].join(", ");
}

function awardBlockLabel(block: Extract<CrewBuildBlock, { kind: "award" }>, member: CrewMember | null): string {
  return [
    member?.displayName ?? "Crew member",
    CREW_AWARD_LABEL[block.awardType],
    formatCrewAwardResult(block.awardType, block.resultValue),
    `week of ${formatDateLabel(block.weekStart, { month: "long", day: "numeric" })}`,
    "zero-mile award block",
    ...(block.recentlyPlaced ? ["newly placed"] : []),
  ].join(", ");
}

function awardIdentity(award: CrewAwardBlockRecord) {
  return `${CREW_AWARD_LABEL[award.awardType]} · ${formatCrewAwardResult(award.awardType, award.resultValue)}`;
}

export function CrewBuild({
  model,
  totals,
  members,
  available,
  placement,
  justPlacedRunId = null,
  justPlacedAwardId = null,
  onStartReady,
  onSelectRun,
  onSelectAward,
  onSelectMember,
}: CrewBuildProps) {
  const towerRef = useRef<HTMLUListElement>(null);
  const skylineRef = useRef<HTMLDivElement>(null);

  // Supplied by the screen rather than re-derived here, because only the
  // screen knows which way the runner has turned the block.
  const placementFootprint = placement?.footprint ?? null;
  const candidate = placement?.candidate ?? null;
  const drawnCourses = Math.max(
    1,
    model.courses + (placement ? (placementFootprint?.height ?? 1) : 0),
  );
  const visibleCourses = Math.min(
    MAX_VISIBLE_COURSES,
    Math.max(CREW_BUILD_MIN_VISIBLE_COURSES, drawnCourses + 1),
  );
  const justPlacedId = justPlacedAwardId ?? justPlacedRunId;
  const justPlaced = model.blocks.find((block) => block.id === justPlacedId) ?? null;
  const firstReady = model.viewerReadyRuns[0] ?? null;
  const contributionCount = model.runCount + model.awardCount;
  const placementPieceColor = placement
    ? placement.kind === "run"
      ? memberPieceColor(placement.run.userId, placement.run.accentColor)
      : memberPieceColor(placement.member.userId, placement.member.accentColor)
    : "#171d21";
  const placementTitle = placement
    ? placement.kind === "run"
      ? `${placement.run.crewBuildRow === null ? "Place" : "Move"} ${WORKOUT_TYPE_LABEL[placement.run.activityType]}`
      : `${placement.award.crewBuildRow === null ? "Place" : "Move"} ${CREW_AWARD_LABEL[placement.award.awardType]}`
    : "Place block";

  const { grab, trackDrag, release, cancelDrag } = useColumnDragPlacement({
    containerRef: towerRef,
    gridUnits: GRID_UNITS,
    width: placementFootprint?.width ?? 1,
    options: placement?.options ?? [],
    chosenColumnStart: candidate?.columnStart,
    onChoose: (option) => placement?.onChoose(option),
    onCommit: () => placement?.onConfirm(),
  });

  const isPlacing = placement !== null;
  useEffect(() => {
    if (isPlacing) skylineRef.current?.scrollIntoView({ block: "center" });
  }, [isPlacing]);

  const stageStyle = {
    "--crew-build-visible-courses": visibleCourses,
  } as CSSProperties;

  return (
    <section
      className="crew-build crew-build--page"
      data-placing={placement ? "true" : undefined}
      aria-label="Crew Build"
    >
      {/*
        * Issue #137: the tower is the page, so nothing above it competes with
        * it. The `CREW BUILD` label went — the active Crew tab already says
        * where you are — and the oversized miles-built heading became four
        * even crew figures, none of them shouting.
        */}
      {!placement && (
        <dl className="crew-build__stats" aria-label="Crew totals">
          <div className="crew-build__stat crew-build__stat--miles">
            <dd className="data-value">{formatMilesBuilt(totals.miles)}</dd>
            <dt className="machine-label">Miles</dt>
          </div>
          <div className="crew-build__stat crew-build__stat--runs">
            <dd className="data-value">{totals.runs}</dd>
            <dt className="machine-label">Runs</dt>
          </div>
          <div className="crew-build__stat crew-build__stat--time">
            <dd className="data-value">{formatTotalHoursMinutes(totals.durationSeconds)}</dd>
            <dt className="machine-label">Hours</dt>
          </div>
          <div className="crew-build__stat crew-build__stat--runners">
            <dd className="data-value">{totals.runners}</dd>
            <dt className="machine-label">
              {totals.runners === 1 ? "Runner" : "Runners"}
            </dt>
          </div>
        </dl>
      )}

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

      {!available ? (
        <p className="crew-build__unavailable">Crew Build unavailable.</p>
      ) : contributionCount === 0 && !placement ? (
        <div className="crew-build__stage crew-build__stage--empty" style={stageStyle}>
          {/* No tower, but the same ground plane, so the same field tokens. */}
          <div className="tower-field tower-field--tokens">
            <div className="crew-build__field" aria-hidden="true" />
            <div className="crew-build__ground" aria-hidden="true" />
          </div>
          <p className="crew-build__empty">The first shared run earns the first Crew block.</p>
        </div>
      ) : (
        <div className="crew-build__stage" style={stageStyle}>
          {placement && (
            <PlacementContext
              label={placement.kind === "award" ? "Special Block in hand" : "Block in hand"}
              identity={
                placement.kind === "run"
                  ? blockIdentity({
                      activityType: placement.run.activityType,
                      distanceMiles: placement.run.distanceMiles,
                      date: placement.run.localDate,
                    })
                  : awardIdentity(placement.award)
              }
              hint={placementHint(placement.canRotate)}
            />
          )}
          {/*
            * The tower field: what sizes the square placement unit, which the
            * sky, the skyline, the fall and the ground all measure in. It
            * wraps the viewport *and* the ground because the ground is the
            * tower's sibling here — it sits below a viewport that scrolls —
            * and it draws its own depth from the same tokens. The wrapper
            * generates no box (`display: contents`), so the stage lays out
            * exactly as it did. See `.tower-field`.
            */}
          <div
            className="tower-field tower-field--tokens"
            style={
              {
                "--grid-units": GRID_UNITS,
                "--grid-courses": drawnCourses,
              } as CSSProperties
            }
          >
            <div className="crew-build__viewport">
              <div className="crew-build__sky" aria-hidden="true" />
              <div ref={skylineRef} className="crew-build__skyline" aria-hidden="true" />
              <ul
                ref={towerRef}
                className="built-tower crew-build__tower"
                aria-label={placement ? "Choose a Crew Build position" : "Crew Build blocks"}
                data-placement-grid={placement ? "true" : undefined}
                onPointerMove={placement ? trackDrag : undefined}
                onPointerUp={placement ? release : undefined}
                onPointerCancel={placement ? cancelDrag : undefined}
              >
                {model.voids.map((cell) => (
                  <li
                    key={`void-${cell.column}:${cell.row}`}
                    className="built-tower__void"
                    aria-hidden="true"
                    style={{ gridColumn: cell.column, gridRow: drawnCourses - cell.row } as CSSProperties}
                  />
                ))}

                {model.blocks.map((block) => {
                  const member = members.find((item) => item.userId === block.userId) ?? null;
                  const accent = member
                    ? crewMemberAccent(member.userId, member.accentColor)
                    : crewMemberAccent(block.userId, block.kind === "run" ? block.accentColor : null);
                  const isJustPlaced = block.id === justPlacedId;
                  return (
                    <li
                      key={`${block.kind}-${block.id}`}
                      className="placed-block"
                      data-type={block.kind === "run" ? block.activityType : undefined}
                      data-award={block.kind === "award" ? block.awardType : undefined}
                      data-row={block.row}
                      data-column-start={block.columnStart}
                      data-member-color={accent}
                      data-recent={block.recentlyPlaced || undefined}
                      {...dropMarks(isJustPlaced, block)}
                      style={
                        {
                          gridColumn: `${block.columnStart} / span ${block.width}`,
                          gridRow: `${drawnCourses - block.row - block.height + 1} / span ${block.height}`,
                          // The tower's own paint order, the same one Personal
                          // Build uses: derived from the projection for every
                          // block at once (`paintDepthsOf`) rather than guessed
                          // per block here. Crew's blocks arrive in placement
                          // order rather than geometric order, so nothing may
                          // be left to fall back on DOM order.
                          zIndex: block.depth,
                        } as CSSProperties
                      }
                    >
                      <button
                        type="button"
                        className="placed-block__button"
                        onClick={() => block.kind === "run" ? onSelectRun(block.id) : onSelectAward(block.id)}
                      >
                        <span className="visually-hidden">
                          {block.kind === "run" ? runBlockLabel(block) : awardBlockLabel(block, member)}
                        </span>
                        {block.kind === "run" ? (
                          <Brick
                            pieceColor={memberPieceColor(block.userId, block.accentColor)}
                            label={crewFaceLabel(block)}
                            topFace={block.topFace}
                            rightFace={block.rightFace}
                          />
                        ) : (
                          <AwardBrick
                            awardType={block.awardType}
                            pieceColor={memberPieceColor(block.userId, member?.accentColor ?? null)}
                            topFace={block.topFace}
                            rightFace={block.rightFace}
                          />
                        )}
                      </button>
                    </li>
                  );
                })}

                {placement && placementFootprint && placement.options.map((option) => (
                  <LandingSlot
                    key={option.columnStart}
                    option={option}
                    width={placementFootprint.width}
                    height={placementFootprint.height}
                    pieceColor={placementPieceColor}
                    courses={drawnCourses}
                    isChosen={option.columnStart === candidate?.columnStart}
                    blockCount={model.blocks.length}
                    blockDescription={placement.kind === "run"
                      ? `${WORKOUT_TYPE_LABEL[placement.run.activityType]} block`
                      : `${CREW_AWARD_LABEL[placement.award.awardType]} award block`}
                    onChoose={placement.onChoose}
                    onGrab={grab}
                  />
                ))}
              </ul>
            </div>
            <div
              key={justPlaced ? `ground-${justPlaced.kind}-${justPlaced.id}` : "ground"}
              className="crew-build__ground"
              aria-hidden="true"
              data-impact={justPlaced ? placementImpact(justPlaced) : undefined}
            />
          </div>
          {placement && (
            <PlacementBar
              pieceColor={placementPieceColor}
              title={placementTitle}
              canDrop={candidate !== null}
              blockedReason={placement.blockedReason}
              canStepBack={
                !!candidate && placement.options.findIndex((option) => option.columnStart === candidate.columnStart) > 0
              }
              canStepForward={
                !!candidate && placement.options.findIndex((option) => option.columnStart === candidate.columnStart) < placement.options.length - 1
              }
              onStep={placement.onStep}
              onRotate={placement.canRotate ? placement.onRotate : undefined}
              onAutoPlace={placement.onAutoPlace}
              onDrop={placement.onConfirm}
              onCancel={placement.onCancel}
              pending={placement.pending}
              error={placement.error}
            />
          )}
          {!placement && (model.blocks.length === 0 || drawnCourses > MAX_VISIBLE_COURSES) && (
            <p className="crew-build__caption">
              {model.blocks.length === 0
                ? `${model.readyCount + model.readyAwardCount} blocks are earned and ready to build.`
                : "Scroll the field for more courses."}
            </p>
          )}
        </div>
      )}

      {available && model.truncated && (
        <p className="crew-build__notice" role="status">Showing {model.runCount} shared runs.</p>
      )}

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
