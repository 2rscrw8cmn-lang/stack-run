import { Dumbbell, History, Trophy } from "lucide-react";
import { useState, type CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { Section } from "../../components/ui/Section";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatCompactMiles, formatMiles, formatMilesBuilt } from "../../domain/distance";
import { isManualRun } from "../../domain/runSource";
import { GRID_COLUMNS } from "../../domain/placement";
import {
  AVG_PACE_WINDOW_LABEL,
  formatComparisonReading,
  type ComparisonSummary,
} from "../../crew/comparisons";
import {
  CREW_AWARD_LABEL,
  formatCrewAwardResult,
  type CrewAwardBlockRecord,
} from "../../crew/awards";
import { crewMemberAccent } from "../../crew/memberAccent";
import {
  faceCulledMiniBuildTower,
  type CrewMiniBuildFacedBlock,
  type CrewMiniBuildModel,
} from "../../crew/miniBuild";
import type { CrewMember, CrewSharedRun } from "../../crew/types";
import { Brick, type BrickFaceLabel } from "../build/Brick";
import { AwardGlyph } from "./AwardBrick";
import { CrewRunRow } from "./CrewRunRow";
import { RunnerIcon } from "./RunnerIcon";
import "./awardBlock.css";

// Profiles are compared side by side, so their Build field keeps one stable
// frame. Taller towers remain readable through the viewport's own scroll.
const PROFILE_VISIBLE_COURSES = 10;
const DEFAULT_VISIBLE_RUNS = 5;

interface CrewMemberProfileSheetProps {
  member: CrewMember | null;
  /** The current viewer's own profile gets a subtle `YOU` marker, never a louder one. */
  isYou: boolean;
  model: CrewMiniBuildModel | null;
  summary: ComparisonSummary | null;
  /** This member's shared runs, newest first — the same `CrewSharedRun` contract as Recent Crew Runs. */
  runs: CrewSharedRun[];
  /** This member's Special Blocks, newest first. */
  awards: CrewAwardBlockRecord[];
  isOpen: boolean;
  onClose: () => void;
  onSelectRun: (runId: string) => void;
  onSelectAward: (awardId: string) => void;
  currentUserId: string;
  propsPendingRunIds: readonly string[];
  propsErrors: Readonly<Record<string, string>>;
  propsAvailable: boolean;
  onToggleProps: (runId: string) => void;
}

function blockLabel(memberName: string, block: Pick<CrewMiniBuildFacedBlock, "activityType" | "localDate" | "distanceMiles" | "source">) {
  // The face's asterisk is decoration a screen reader never reaches, so the
  // name says the same thing in words.
  const manual = isManualRun(block) ? ", manual entry" : "";
  return `Open ${memberName}'s ${WORKOUT_TYPE_LABEL[block.activityType]} on ${formatDateLabel(
    block.localDate,
    { weekday: "long", month: "long", day: "numeric" },
  )}, ${formatMiles(block.distanceMiles)} miles${manual}`;
}

/**
 * Same convention as Personal/Crew Build's brick face: compact mileage,
 * `RACE` on a race, a dumbbell on Cross Training (often distanceless).
 */
function faceLabel(block: Pick<CrewMiniBuildFacedBlock, "activityType" | "distanceMiles" | "width" | "source">): BrickFaceLabel {
  if (block.activityType === "race") return { text: "RACE", unit: false };
  if (block.activityType === "cross") return { icon: Dumbbell };
  return {
    text: formatCompactMiles(block.distanceMiles),
    unit: block.width >= 3,
    manual: isManualRun(block),
  };
}

/**
 * A runner-focused Crew Member Profile: identity, a compact shared stat
 * strip, a read-only reproduction of their real Personal Build, and their
 * recent shared runs — replacing the old flat `CrewMemberBuildSheet` grid
 * (issue #87).
 *
 * The Build hero reuses Personal/Crew Build's own `Brick` primitive and
 * `built-tower` grid rather than a third parallel renderer: same eight-column
 * geometry, same 3D face culling, same activity-color meaning, over the
 * exact frozen Personal placement `CrewMiniBuildModel` already provides. It
 * is display-only — no placement controls, no drag, no READY state — but
 * tapping a block still opens that block's shared Crew run detail.
 */
export function CrewMemberProfileSheet({
  member,
  isYou,
  model,
  summary,
  runs,
  awards,
  isOpen,
  onClose,
  onSelectRun,
  onSelectAward,
  currentUserId,
  propsPendingRunIds,
  propsErrors,
  propsAvailable,
  onToggleProps,
}: CrewMemberProfileSheetProps) {
  const [showAllRuns, setShowAllRuns] = useState(false);

  if (!member || !model) return null;

  const tower = faceCulledMiniBuildTower(model);
  const courses = Math.max(1, tower.courses);
  const stageStyle = {
    "--crew-build-visible-courses": PROFILE_VISIBLE_COURSES,
  } as CSSProperties;

  const weeklyMiles = formatComparisonReading("weekly-miles", summary);
  const longestRun = formatComparisonReading("longest-run", summary);
  const avgPace = formatComparisonReading("avg-pace", summary);

  const visibleRuns = showAllRuns ? runs : runs.slice(0, DEFAULT_VISIBLE_RUNS);
  const hiddenRunCount = runs.length - visibleRuns.length;

  return (
    <Sheet
      className="sheet--crew-member-profile"
      title="Crew Profile"
      isOpen={isOpen}
      onClose={onClose}
    >
      <div
        className="crew-member-profile"
        data-member-color={crewMemberAccent(member.userId, member.accentColor)}
      >
        <header className="crew-member-profile__header">
          <RunnerIcon icon={member.runnerIcon} size={40} />
          <div className="crew-member-profile__identity">
            <p className="crew-member-profile__name">
              <span>{member.displayName}</span>
              {isYou && <span className="crew-member-profile__you machine-label">You</span>}
            </p>
            {member.role === "owner" && (
              <p className="crew-member-profile__role machine-label">Owner</p>
            )}
          </div>
        </header>

        <dl className="crew-member-profile__stats">
          <div>
            <dd className="data-value">{weeklyMiles.value}</dd>
            <dt className="machine-label">This Week</dt>
          </div>
          <div>
            <dd className="data-value">{longestRun.value}</dd>
            <dt className="machine-label">Longest</dt>
          </div>
          {/*
            Consistency needed a training plan, so it read differently for a
            Race Crew and a Run Club and matched neither's comparison tab.
            Avg Pace is the same measurement for everybody (issue #120).
          */}
          <div>
            <dd className="data-value">{avgPace.value}</dd>
            <dt className="machine-label">Avg Pace · {AVG_PACE_WINDOW_LABEL}</dt>
          </div>
          <div>
            <dd className="data-value">{formatMilesBuilt(model.totalMiles)} MI</dd>
            <dt className="machine-label">Member Build</dt>
          </div>
        </dl>

        <Section
          className="crew-member-profile__awards"
          icon={<Trophy size={15} strokeWidth={2} />}
          title="Awards"
        >
          {awards.length === 0 ? (
            <p className="crew-recent__empty">No awards yet.</p>
          ) : (
            <ul className="crew-member-profile__award-list">
              {awards.map((award) => (
                <li key={award.id}>
                  <button
                    type="button"
                    className="crew-member-profile__award-row"
                    onClick={() => onSelectAward(award.id)}
                  >
                    <span
                      className="award-brick award-brick--portrait crew-member-profile__award-glyph"
                      data-award={award.awardType}
                      aria-hidden="true"
                      style={
                        {
                          "--piece-color": `var(--member-${crewMemberAccent(member.userId, member.accentColor)})`,
                        } as CSSProperties
                      }
                    >
                      <span className="award-brick__window">
                        <AwardGlyph type={award.awardType} />
                      </span>
                    </span>
                    <span className="crew-member-profile__award-text">
                      <span className="data-value">{CREW_AWARD_LABEL[award.awardType]}</span>
                      <span className="machine-label">
                        Week of {formatDateLabel(award.weekStart, { month: "short", day: "numeric" })}
                      </span>
                    </span>
                    <span className="machine-label crew-member-profile__award-result">
                      {formatCrewAwardResult(award.awardType, award.resultValue)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <section className="crew-build" aria-labelledby="crew-member-profile-build-title">
          <div className="crew-build__lead">
            <p id="crew-member-profile-build-title" className="machine-label">Build</p>
            <p className="crew-build__miles data-value">
              {formatMilesBuilt(model.totalMiles)}
              <span className="machine-label">miles built</span>
            </p>
          </div>

          {tower.blocks.length === 0 ? (
            <p className="crew-build__empty">No shared blocks yet.</p>
          ) : (
            <div className="crew-build__stage" style={stageStyle}>
              <div className="crew-build__viewport">
                <div className="crew-build__sky" aria-hidden="true" />
                <ul
                  className="built-tower crew-build__tower"
                  aria-label={`${member.displayName}'s shared Build blocks`}
                  style={
                    {
                      "--grid-columns": GRID_COLUMNS,
                      "--grid-courses": courses,
                    } as CSSProperties
                  }
                >
                  {tower.voids.map((cell) => (
                    <li
                      key={`void-${cell.column}:${cell.row}`}
                      className="built-tower__void"
                      aria-hidden="true"
                      style={
                        {
                          gridColumn: cell.column,
                          gridRow: courses - cell.row,
                        } as CSSProperties
                      }
                    />
                  ))}

                  {tower.blocks.map((block) => (
                    <li
                      key={block.id}
                      className="placed-block"
                      data-type={block.activityType}
                      data-row={block.row}
                      data-column-start={block.columnStart}
                      style={
                        {
                          gridColumn: `${block.columnStart} / span ${block.width}`,
                          gridRow: `${courses - block.row - block.height + 1} / span ${block.height}`,
                          zIndex: block.depth,
                        } as CSSProperties
                      }
                    >
                      <button
                        type="button"
                        className="placed-block__button"
                        onClick={() => onSelectRun(block.id)}
                      >
                        <span className="visually-hidden">{blockLabel(member.displayName, block)}</span>
                        <Brick
                          pieceColor={`var(--${block.activityType})`}
                          label={faceLabel(block)}
                          topFace={block.topFace}
                          rightFace={block.rightFace}
                        />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="crew-build__ground" aria-hidden="true" />
            </div>
          )}
        </section>

        <Section
          className="crew-recent crew-member-profile__recent"
          icon={<History size={15} strokeWidth={2} />}
          title="Recent Runs"
        >
          {runs.length === 0 ? (
            <p className="crew-recent__empty">No shared runs yet.</p>
          ) : (
            <ul className="crew-recent__list">
              {visibleRuns.map((run) => (
                <CrewRunRow
                  key={run.id}
                  run={run}
                  currentUserId={currentUserId}
                  propsPending={propsPendingRunIds.includes(run.id)}
                  propsError={propsErrors[run.id] ?? null}
                  propsAvailable={propsAvailable}
                  onOpen={() => onSelectRun(run.id)}
                  onToggleProps={() => onToggleProps(run.id)}
                />
              ))}
            </ul>
          )}
          {hiddenRunCount > 0 && (
            <Button variant="ghost" onClick={() => setShowAllRuns(true)}>
              Show {hiddenRunCount} more
            </Button>
          )}
        </Section>
      </div>
    </Sheet>
  );
}
