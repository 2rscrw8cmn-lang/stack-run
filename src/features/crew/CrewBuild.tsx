import type { CSSProperties, MouseEvent } from "react";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import {
  formatCompactMiles,
  formatMiles,
  formatMilesBuilt,
} from "../../domain/distance";
import { crewMemberAccent } from "../../crew/memberAccent";
import {
  CREW_BUILD_MIN_VISIBLE_COURSES,
  crewBuildFootprint,
  type CrewBuildBlock,
  type CrewBuildModel,
  type CrewBuildPlacement,
  type CrewBuildReadyRun,
} from "../../crew/crewBuild";
import type { CrewBuildRun, CrewMember } from "../../crew/types";
import { Button } from "../../components/ui/Button";

const MAX_VISIBLE_COURSES = 14;

interface CrewBuildPlacementMode {
  run: CrewBuildRun;
  selection: CrewBuildPlacement | null;
  pending: boolean;
  error: string | null;
  onSelect: (placement: CrewBuildPlacement) => void;
  onNextOpenSpot: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

interface CrewBuildProps {
  model: CrewBuildModel;
  members: CrewMember[];
  available: boolean;
  viewerReadyRuns: CrewBuildReadyRun[];
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
  ].join(", ");
}

function faceText(block: Pick<CrewBuildBlock, "activityType" | "distanceMiles">): string {
  return block.activityType === "race"
    ? "RACE"
    : formatCompactMiles(block.distanceMiles);
}

function runIdentity(run: Pick<CrewBuildRun, "activityType" | "distanceMiles" | "localDate">) {
  return `${WORKOUT_TYPE_LABEL[run.activityType]} · ${formatMiles(run.distanceMiles)} MI · ${formatDateLabel(run.localDate, { month: "short", day: "numeric" })}`;
}

/** The shared tower and the runner-owned READY interaction that builds it. */
export function CrewBuild({
  model,
  members,
  available,
  viewerReadyRuns,
  placement,
  onStartReady,
  onSelectRun,
}: CrewBuildProps) {
  const placementFootprint = placement ? crewBuildFootprint(placement.run) : null;
  const placementTop = placement?.selection && placementFootprint
    ? placement.selection.row + placementFootprint.height
    : 0;
  const gridCourses = placement
    ? Math.max(
      CREW_BUILD_MIN_VISIBLE_COURSES,
      model.courses + 3,
      placementTop + 1,
    )
    : Math.max(1, model.courses);
  const visibleCourses = Math.min(
    MAX_VISIBLE_COURSES,
    Math.max(CREW_BUILD_MIN_VISIBLE_COURSES, gridCourses + (placement ? 0 : 1)),
  );
  const renderedBlocks = placement
    ? model.blocks.filter((block) => block.id !== placement.run.id)
    : model.blocks;
  const firstReady = viewerReadyRuns[0] ?? null;

  function chooseFromStage(event: MouseEvent<HTMLUListElement>) {
    if (!placement) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;
    const columnStart = Math.min(
      8,
      Math.max(1, Math.floor(((event.clientX - bounds.left) / bounds.width) * 8) + 1),
    );
    const row = Math.min(
      gridCourses - 1,
      Math.max(0, Math.floor(((bounds.bottom - event.clientY) / bounds.height) * gridCourses)),
    );
    placement.onSelect({ row, columnStart });
  }

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
          {formatMilesBuilt(model.milesBuilt)}
          <span className="machine-label">miles built</span>
        </p>
        <p className="crew-build__totals machine-label">
          {model.runCount} {model.runCount === 1 ? "run" : "runs"} ·{" "}
          {members.length} {members.length === 1 ? "runner" : "runners"}
        </p>
        {model.readyCount > 0 && (
          <p className="crew-build__construction machine-label">
            {model.placedCount} built · {model.readyCount} ready
          </p>
        )}
      </div>

      {available && firstReady && !placement && (
        <div className="crew-build__ready" role="status">
          <div>
            <p className="machine-label">
              {viewerReadyRuns.length} {viewerReadyRuns.length === 1 ? "block" : "blocks"} ready
            </p>
            <p className="crew-build__ready-run data-value">{runIdentity(firstReady)}</p>
          </div>
          <Button variant="primary" onClick={onStartReady}>
            {viewerReadyRuns.length === 1 ? "Place Your Block" : "Build Now"}
          </Button>
        </div>
      )}

      {placement && (
        <div className="crew-build__placement-lead">
          <p className="machine-label">Place your block</p>
          <p className="data-value">{runIdentity(placement.run)}</p>
          <p>Tap an open grid space. Your block snaps to the eight-column Build.</p>
        </div>
      )}

      {!available ? (
        <p className="crew-build__unavailable">Crew Build unavailable.</p>
      ) : model.runCount === 0 ? (
        <div className="crew-build__stage crew-build__stage--empty" style={stageStyle}>
          <div className="crew-build__field" aria-hidden="true" />
          <div className="crew-build__ground" aria-hidden="true" />
          <p className="crew-build__empty">The first shared run earns the first Crew block.</p>
        </div>
      ) : (
        <div className="crew-build__stage" style={stageStyle}>
          <div className="crew-build__viewport">
            <ul
              className="crew-build__tower"
              aria-label={placement ? "Choose a Crew Build position" : "Crew Build blocks"}
              data-placement-grid={placement ? "true" : undefined}
              style={{ "--crew-build-courses": gridCourses } as CSSProperties}
              onClick={placement ? chooseFromStage : undefined}
            >
              {renderedBlocks.map((block) => (
                <li
                  key={block.id}
                  data-type={block.activityType}
                  data-row={block.row}
                  data-column-start={block.columnStart}
                  data-member-color={crewMemberAccent(block.userId)}
                  style={{
                    gridColumn: `${block.columnStart} / span ${block.width}`,
                    gridRow: `${gridCourses - block.row - block.height + 1} / span ${block.height}`,
                  }}
                >
                  {placement ? (
                    <span className="crew-build__block" aria-hidden="true">
                      <span className="crew-build__cap" />
                      <span className="crew-build__face">{faceText(block)}</span>
                    </span>
                  ) : (
                    <button type="button" onClick={() => onSelectRun(block.id)}>
                      <span className="visually-hidden">{blockLabel(block)}</span>
                      <span className="crew-build__cap" aria-hidden="true" />
                      <span className="crew-build__face" aria-hidden="true">{faceText(block)}</span>
                    </button>
                  )}
                </li>
              ))}

              {placement?.selection && placementFootprint && (
                <li
                  className="crew-build__preview"
                  data-type={placement.run.activityType}
                  data-member-color={crewMemberAccent(placement.run.userId)}
                  style={{
                    gridColumn: `${placement.selection.columnStart} / span ${placementFootprint.width}`,
                    gridRow: `${gridCourses - placement.selection.row - placementFootprint.height + 1} / span ${placementFootprint.height}`,
                  }}
                  aria-hidden="true"
                >
                  <span className="crew-build__block">
                    <span className="crew-build__cap" />
                    <span className="crew-build__face">{faceText(placement.run)}</span>
                  </span>
                </li>
              )}
            </ul>
          </div>
          <div className="crew-build__ground" aria-hidden="true" />
          {!placement && (model.blocks.length === 0 || gridCourses > MAX_VISIBLE_COURSES) && (
            <p className="crew-build__caption">
              {model.blocks.length === 0
                ? `${model.readyCount} ${model.readyCount === 1 ? "block is" : "blocks are"} earned and ready to build.`
                : "Scroll the field for more courses."}
            </p>
          )}
        </div>
      )}

      {placement && (
        <div className="crew-build__placement-controls">
          <Button variant="secondary" onClick={placement.onNextOpenSpot} disabled={placement.pending}>
            Next Open Spot
          </Button>
          <Button
            variant="primary"
            onClick={placement.onConfirm}
            disabled={!placement.selection || placement.pending}
          >
            {placement.pending ? "Placing…" : "Confirm Placement"}
          </Button>
          <Button variant="ghost" onClick={placement.onCancel} disabled={placement.pending}>
            Cancel
          </Button>
          {placement.selection && (
            <p className="machine-label" aria-live="polite">
              Row {placement.selection.row + 1} · Column {placement.selection.columnStart}
            </p>
          )}
          {placement.error && <p className="crew-build__placement-error" role="status">{placement.error}</p>}
        </div>
      )}

      {available && model.truncated && (
        <p className="crew-build__notice" role="status">
          Showing {model.runCount} shared runs.
        </p>
      )}

      {members.length > 0 && (
        <ul className="crew-build__legend" aria-label="Crew Build runners">
          {members.map((member) => (
            <li key={member.userId} data-member-color={crewMemberAccent(member.userId)}>
              <span className="crew-member-marker" aria-hidden="true" />
              <span>{member.displayName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
