import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState, type CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles, formatMilesBuilt } from "../../domain/distance";
import { formatTotalHoursMinutes } from "../../domain/duration";
import { formatWeekRange } from "../../domain/plan";
import {
  CREW_AWARD_LABEL,
  formatCrewAwardResult,
} from "../../crew/awards";
import { crewMemberAccent } from "../../crew/memberAccent";
import type {
  CrewWeekRecap,
  CrewWeekRecapBeat,
  CrewWeekRecapRunner,
} from "../../crew/weekRecap";
import type { CrewEmblem as CrewEmblemModel } from "../../crew/emblem";
import { CrewEmblem } from "./CrewEmblem";
import { RunnerIcon } from "./RunnerIcon";
import "./awardBlock.css";
import "./crewWeekRecap.css";

/**
 * The fuller Crew Week Recap.
 *
 * One frame at a time, advanced by hand. This is the recap presentation
 * language: an eyebrow that says which beat this is, one fact at display size,
 * and the smallest amount of supporting text that makes the fact mean
 * something. No frame is a row of KPI cards, and no frame ranks the roster.
 *
 * Nothing advances on its own. An auto-playing story is a Reduced Motion
 * problem, a screen-reader problem and a reading-speed problem all at once,
 * and the arcade language STACK already speaks is a machine you operate rather
 * than a video you watch.
 *
 * The frames come from `crewWeekRecap`, so this component decides only how a
 * beat looks — never whether the Crew earned one.
 */

interface CrewWeekRecapSheetProps {
  recap: CrewWeekRecap;
  emblem: CrewEmblemModel;
  isOpen: boolean;
  onClose: () => void;
}

type Frame =
  | { kind: "totals" }
  | { kind: "beat"; beat: CrewWeekRecapBeat };

function RunnerChip({ runner }: { runner: CrewWeekRecapRunner }) {
  return (
    <li
      className="crew-recap__runner"
      data-member-color={crewMemberAccent(runner.userId, runner.accentColor)}
    >
      <RunnerIcon icon={runner.runnerIcon} size={30} />
      <span>{runner.displayName}</span>
    </li>
  );
}

function FrameShell({
  eyebrow,
  children,
}: {
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="crew-recap__frame">
      <p className="crew-recap__eyebrow machine-label">{eyebrow}</p>
      {children}
    </div>
  );
}

function TotalsFrame({ recap }: { recap: CrewWeekRecap }) {
  const { totals } = recap;
  return (
    <FrameShell eyebrow="Together">
      <p className="crew-recap__figure data-value">
        {formatMilesBuilt(totals.miles)}
        <span className="crew-recap__unit machine-label">MI</span>
      </p>
      <p className="crew-recap__line">
        {totals.runs} {totals.runs === 1 ? "run" : "runs"} ·{" "}
        {formatTotalHoursMinutes(totals.durationSeconds)} on your feet ·{" "}
        {totals.activeRunners}{" "}
        {totals.activeRunners === 1 ? "runner" : "runners"}
      </p>
    </FrameShell>
  );
}

function ParticipationFrame({
  beat,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "participation" }>;
}) {
  return (
    <FrameShell eyebrow={beat.everyoneRan ? "Everyone Ran" : "Who Ran"}>
      <p className="crew-recap__figure data-value">
        {beat.activeRunners}
        <span className="crew-recap__unit machine-label">
          {beat.everyoneRan ? "OF EVERYONE" : `OF ${beat.rosterSize}`}
        </span>
      </p>
      <p className="crew-recap__line">
        {beat.everyoneRan
          ? "Nobody sat this week out."
          : `${beat.activeRunners} of ${beat.rosterSize} put running on the board.`}
      </p>
      <ul className="crew-recap__runners" aria-label="Runners this week">
        {beat.runners.map((runner) => (
          <RunnerChip key={runner.userId} runner={runner} />
        ))}
      </ul>
    </FrameShell>
  );
}

function LongestRunFrame({
  beat,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "longestRun" }>;
}) {
  return (
    <FrameShell eyebrow="Longest Run">
      <p className="crew-recap__figure data-value">
        {formatMiles(beat.distanceMiles)}
        <span className="crew-recap__unit machine-label">MI</span>
      </p>
      <ul className="crew-recap__runners">
        <RunnerChip runner={beat.runner} />
      </ul>
      <p className="crew-recap__line">
        {WORKOUT_TYPE_LABEL[beat.activityType]} ·{" "}
        {formatDateLabel(beat.localDate, { weekday: "long" })}
      </p>
    </FrameShell>
  );
}

function BuildFrame({
  beat,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "build" }>;
}) {
  return (
    <FrameShell eyebrow="Added To The Build">
      <p className="crew-recap__figure data-value">
        {beat.blocksPlaced}
        <span className="crew-recap__unit machine-label">
          {beat.blocksPlaced === 1 ? "BLOCK" : "BLOCKS"}
        </span>
      </p>
      <p className="crew-recap__line">
        {formatMilesBuilt(beat.milesPlaced)} mi of this week is standing in the
        tower.
      </p>
      {/*
        The slice itself: this week's blocks in their real tower columns and
        courses, in each runner's own colour. Decorative — the figure and the
        line above state the same facts in text, and a masonry crop has no
        reading order worth announcing.
      */}
      <div
        className="crew-recap__slice"
        style={{ "--slice-courses": beat.courses } as CSSProperties}
        aria-hidden="true"
      >
        {beat.slice.map((block) => (
          <span
            key={block.id}
            className="crew-recap__brick"
            data-member-color={crewMemberAccent(block.userId, block.accentColor)}
            style={
              {
                "--brick-column": block.columnStart,
                "--brick-span": block.width,
                "--brick-row": beat.courses - block.row - block.height + 1,
                "--brick-courses": block.height,
              } as CSSProperties
            }
          />
        ))}
      </div>
    </FrameShell>
  );
}

function SpecialBlocksFrame({
  beat,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "specialBlocks" }>;
}) {
  return (
    <FrameShell
      eyebrow={beat.awards.length === 1 ? "Special Block" : "Special Blocks"}
    >
      <ul className="crew-recap__awards">
        {beat.awards.map((award) => (
          <li key={award.id} data-award={award.awardType}>
            <span className="crew-recap__award-mark" aria-hidden="true" />
            <span className="crew-recap__award-copy">
              <span className="crew-recap__award-name">
                {CREW_AWARD_LABEL[award.awardType]}
              </span>
              <span className="machine-label">
                {award.winner?.displayName ?? "Crew member"} ·{" "}
                {formatCrewAwardResult(award.awardType, award.resultValue)}
              </span>
            </span>
          </li>
        ))}
      </ul>
      <p className="crew-recap__line">
        Standing in the Crew Build, where the whole crew can see them.
      </p>
    </FrameShell>
  );
}

function ChangeFrame({
  beat,
  miles,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "change" }>;
  miles: number;
}) {
  const direction = beat.deltaMiles > 0 ? "up" : beat.deltaMiles < 0 ? "down" : "level";
  return (
    <FrameShell eyebrow="Against Last Week">
      <p className="crew-recap__figure data-value" data-direction={direction}>
        {beat.deltaMiles > 0 ? "+" : ""}
        {formatMilesBuilt(beat.deltaMiles)}
        <span className="crew-recap__unit machine-label">MI</span>
      </p>
      <p className="crew-recap__line">
        {formatMilesBuilt(beat.previousMiles)} mi last week ·{" "}
        {formatMilesBuilt(miles)} mi this week.
      </p>
    </FrameShell>
  );
}

export function CrewWeekRecapSheet({
  recap,
  emblem,
  isOpen,
  onClose,
}: CrewWeekRecapSheetProps) {
  const frames = useMemo<Frame[]>(
    () => [
      { kind: "totals" } as Frame,
      ...recap.beats.map((beat) => ({ kind: "beat", beat }) as Frame),
    ],
    [recap],
  );
  /**
   * Which frame the runner is on. Held here rather than synchronized to
   * `isOpen`, because the recap is mounted for the visit: closing it unmounts
   * the component, so the next visit already starts on the first frame with no
   * effect reaching in to reset anything.
   */
  const [index, setIndex] = useState(0);

  const current = frames[Math.min(index, frames.length - 1)];
  const isLast = index >= frames.length - 1;
  const range = formatWeekRange(recap.weekStart, recap.weekEnd);

  return (
    <Sheet
      title={`${recap.crewName} · Week Recap`}
      isOpen={isOpen}
      onClose={onClose}
      className="sheet--crew-recap"
    >
      <div className="crew-recap">
        <header className="crew-recap__identity">
          <CrewEmblem emblem={emblem} size={40} />
          <div>
            <p className="crew-recap__crew">{recap.crewName}</p>
            <p className="machine-label">{range}</p>
          </div>
        </header>

        {/*
          One live region for the whole story. Each frame replaces the last, so
          a screen reader hears the beat it moved to rather than the whole
          recap again.
        */}
        <div className="crew-recap__stage" aria-live="polite">
          {current.kind === "totals" && <TotalsFrame recap={recap} />}
          {current.kind === "beat" && current.beat.kind === "participation" && (
            <ParticipationFrame beat={current.beat} />
          )}
          {current.kind === "beat" && current.beat.kind === "longestRun" && (
            <LongestRunFrame beat={current.beat} />
          )}
          {current.kind === "beat" && current.beat.kind === "build" && (
            <BuildFrame beat={current.beat} />
          )}
          {current.kind === "beat" && current.beat.kind === "specialBlocks" && (
            <SpecialBlocksFrame beat={current.beat} />
          )}
          {current.kind === "beat" && current.beat.kind === "change" && (
            <ChangeFrame beat={current.beat} miles={recap.totals.miles} />
          )}
        </div>

        <div className="crew-recap__controls">
          <Button
            variant="ghost"
            icon={<ChevronLeft size={16} strokeWidth={2.2} />}
            disabled={index === 0}
            onClick={() => setIndex((step) => Math.max(0, step - 1))}
          >
            Back
          </Button>
          <p className="crew-recap__progress machine-label" aria-hidden="true">
            {index + 1} / {frames.length}
          </p>
          {isLast ? (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          ) : (
            <Button
              variant="secondary"
              onClick={() =>
                setIndex((step) => Math.min(frames.length - 1, step + 1))
              }
            >
              Next
              <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
