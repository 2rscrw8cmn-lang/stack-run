import type { CSSProperties } from "react";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import {
  formatCompactMiles,
  formatMiles,
  formatMilesBuilt,
} from "../../domain/distance";
import { crewMemberAccent } from "../../crew/memberAccent";
import type { CrewBuildBlock, CrewBuildModel } from "../../crew/crewBuild";
import type { CrewMember } from "../../crew/types";

/**
 * Above this many courses the tower is taller than its viewport on a phone and
 * the older courses are behind a scroll, so the caption says so. Blocks keep
 * their size either way — a hundred-course tower squeezed into a fixed box is
 * a picture of a tower rather than one you can read.
 */
const TALL_COURSES = 12;

interface CrewBuildProps {
  model: CrewBuildModel;
  /** Active crew members — the runner count, and the legend. */
  members: CrewMember[];
  /** False when the safe shared-run read did not succeed. */
  available: boolean;
  onSelectRun: (runId: string) => void;
}

/** e.g. `Test Turco, Long Run, 8 miles, August 11`. */
function blockLabel(block: CrewBuildBlock): string {
  return [
    block.displayName,
    WORKOUT_TYPE_LABEL[block.activityType],
    `${formatMiles(block.distanceMiles)} miles`,
    formatDateLabel(block.localDate, { month: "long", day: "numeric" }),
  ].join(", ");
}

/** The race says its name; every other brick carries its compact mileage. */
function faceText(block: CrewBuildBlock): string {
  return block.activityType === "race"
    ? "RACE"
    : formatCompactMiles(block.distanceMiles);
}

/**
 * The Crew Build — one tower, built by everybody.
 *
 * This is the hero of the Crew destination and the reason Crew is a
 * destination at all. Every safe shared run in the crew is one block in it,
 * and the arrangement is derived rather than arranged: nobody places a block
 * here, and nobody can move one. The running is the contribution.
 *
 * A block keeps STACK's activity color, because activity color means training
 * type everywhere in the app. Whose run it was is a separate, smaller cue — a
 * thin cap along the block's top edge in that runner's stable member accent —
 * so identity never competes with the training meaning of the color.
 */
export function CrewBuild({
  model,
  members,
  available,
  onSelectRun,
}: CrewBuildProps) {
  const courses = Math.max(1, model.courses);
  const runnerCount = members.length;

  return (
    <section className="crew-build technical-grid" aria-labelledby="crew-build-title">
      <div className="crew-build__lead">
        <p id="crew-build-title" className="machine-label">Crew Build</p>
        <p className="crew-build__miles data-value">
          {formatMilesBuilt(model.milesBuilt)}
          <span className="machine-label">miles built</span>
        </p>
        <p className="crew-build__totals machine-label">
          {model.blockCount} {model.blockCount === 1 ? "block" : "blocks"} ·{" "}
          {runnerCount} {runnerCount === 1 ? "runner" : "runners"}
        </p>
      </div>

      {!available ? (
        <p className="crew-build__unavailable">Crew Build unavailable.</p>
      ) : model.blocks.length === 0 ? (
        <div className="crew-build__stage crew-build__stage--empty">
          <div className="crew-build__field" aria-hidden="true" />
          <div className="crew-build__ground" aria-hidden="true" />
          <p className="crew-build__empty">The first shared run starts the build.</p>
        </div>
      ) : (
        <div className="crew-build__stage">
          {/*
            Tall towers scroll inside their own viewport rather than shrinking
            until a brick stops being readable. `margin-top: auto` on the tower
            keeps a short tower standing on the ground line while still letting
            a tall one scroll from its newest, topmost courses.
          */}
          <div className="crew-build__viewport">
            <ul
              className="crew-build__tower"
              aria-label="Crew Build blocks"
              style={{ "--crew-build-courses": courses } as CSSProperties}
            >
              {model.blocks.map((block) => (
                <li
                  key={block.id}
                  data-type={block.activityType}
                  data-row={block.row}
                  data-column-start={block.columnStart}
                  data-member-color={crewMemberAccent(block.userId)}
                  style={{
                    gridColumn: `${block.columnStart} / span ${block.width}`,
                    gridRow: `${courses - block.row - block.height + 1} / span ${block.height}`,
                  }}
                >
                  <button type="button" onClick={() => onSelectRun(block.id)}>
                    <span className="visually-hidden">{blockLabel(block)}</span>
                    {/*
                      One semantic target per block: the cap and the face are
                      decoration on it, never separate things to land on.
                    */}
                    <span className="crew-build__cap" aria-hidden="true" />
                    <span className="crew-build__face" aria-hidden="true">
                      {faceText(block)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div className="crew-build__ground" aria-hidden="true" />
          <p className="crew-build__caption">
            Tap a block to see the run behind it.
            {courses > TALL_COURSES && " Scroll the field for the earliest courses."}
          </p>
        </div>
      )}

      {available && model.truncated && (
        <p className="crew-build__notice" role="status">
          Showing the most recent {model.blockCount} shared runs.
        </p>
      )}

      {runnerCount > 0 && (
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
