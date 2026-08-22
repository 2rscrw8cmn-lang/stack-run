import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles, formatMilesBuilt } from "../../domain/distance";
import { formatTotalHoursMinutes } from "../../domain/duration";
import { formatWeekRange } from "../../domain/plan";
import { CREW_AWARD_LABEL, formatCrewAwardResult } from "../../crew/awards";
import { crewMemberAccent } from "../../crew/memberAccent";
import type {
  CrewWeekRecap,
  CrewWeekRecapAward,
  CrewWeekRecapBeat,
  CrewWeekRecapRunner,
} from "../../crew/weekRecap";
import type { CrewEmblem as CrewEmblemModel } from "../../crew/emblem";
import { AwardBrick } from "./AwardBrick";
import { CrewEmblem } from "./CrewEmblem";
import { RecapBuildCrop } from "./RecapBuildCrop";
import { RunnerIcon } from "./RunnerIcon";
import "./awardBlock.css";
import "./crewWeekRecap.css";

/**
 * The Crew Week Recap.
 *
 * Six compositions sharing one system, rather than one composition repeated six
 * times. The sheet itself is the canvas: there is no inner stage card, no card
 * inside a card, and no frame that is a bordered rectangle containing a number.
 * Each beat gets the shape its own fact deserves — a hero with the week's real
 * blocks under it, a scoreboard, a portrait, a piece of tower, two award
 * blocks, a comparison — and hierarchy comes from type, space and actual Crew
 * objects.
 *
 * Everything visible here is drawn by the app from the Crew's own data. The
 * blocks are the real `Brick`/`AwardBrick` construction under the real member
 * colours; the identity marks are the real `CrewEmblem` and `RunnerIcon`. No
 * artwork, no illustration, no second tower renderer.
 *
 * Nothing advances on its own. An auto-playing story is a Reduced Motion
 * problem, a screen-reader problem and a reading-speed problem at once, and the
 * arcade language STACK speaks is a machine you operate rather than a video you
 * watch.
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

type ChangeBeat = Extract<CrewWeekRecapBeat, { kind: "change" }>;
type BuildBeat = Extract<CrewWeekRecapBeat, { kind: "build" }>;

type Frame =
  | { kind: "totals" }
  | { kind: "beat"; beat: Exclude<CrewWeekRecapBeat, ChangeBeat> }
  | { kind: "closing"; change: ChangeBeat | null };

/** The runner's own mark and name, in their own colour. Never a rank. */
function Runner({
  runner,
  size = 30,
  className,
}: {
  runner: CrewWeekRecapRunner;
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={["crew-recap__runner", className].filter(Boolean).join(" ")}
      data-member-color={crewMemberAccent(runner.userId, runner.accentColor)}
    >
      <RunnerIcon icon={runner.runnerIcon} size={size} />
      <span className="crew-recap__runner-name">{runner.displayName}</span>
    </span>
  );
}

/** The label above a frame's fact. One per frame, always in the machine voice. */
function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="crew-recap__eyebrow machine-label">{children}</p>;
}

/**
 * A figure and its unit. Mono, because it is a fact; the unit rides at the
 * baseline in the muted tone so the number keeps the whole of the attention.
 */
function Figure({
  value,
  unit,
  size = "hero",
}: {
  value: string;
  unit?: string;
  size?: "hero" | "mid";
}) {
  return (
    <p className="crew-recap__figure data-value" data-size={size}>
      {value}
      {unit && <span className="crew-recap__unit machine-label">{unit}</span>}
    </p>
  );
}

/* Frame 1 — the week, and what it built. */
function TotalsFrame({
  recap,
  emblem,
  build,
}: {
  recap: CrewWeekRecap;
  emblem: CrewEmblemModel;
  build: BuildBeat | null;
}) {
  const { totals } = recap;
  return (
    <div className="crew-recap__frame crew-recap__frame--opening">
      <div className="crew-recap__group">
        <div className="crew-recap__crest">
          <CrewEmblem emblem={emblem} size={38} />
          <p className="machine-label">
            {formatWeekRange(recap.weekStart, recap.weekEnd)}
          </p>
        </div>

        <Figure value={formatMilesBuilt(totals.miles)} unit="MI" />
        <p className="crew-recap__together">TOGETHER</p>

        <p className="crew-recap__caption machine-label">
          {totals.runs} {totals.runs === 1 ? "RUN" : "RUNS"} ·{" "}
          {totals.activeRunners}{" "}
          {totals.activeRunners === 1 ? "RUNNER" : "RUNNERS"} ·{" "}
          {formatTotalHoursMinutes(totals.durationSeconds)}
        </p>
      </div>

      {/*
        The week's own blocks, standing under the number. They are the payoff
        rather than decoration: what makes this frame fun is that the shape is
        the crew's real Build, not that a graphic was added to it.
      */}
      {build && <RecapBuildCrop beat={build} className="crew-recap__opening-crop" />}
    </div>
  );
}

/* Frame 2 — who showed up. A scoreboard, not three cards. */
function ParticipationFrame({
  beat,
  totals,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "participation" }>;
  totals: CrewWeekRecap["totals"];
}) {
  return (
    <div className="crew-recap__frame">
      <Eyebrow>{beat.everyoneRan ? "The Whole Crew" : "Who Ran"}</Eyebrow>

      {beat.everyoneRan ? (
        <p className="crew-recap__headline">EVERYONE RAN</p>
      ) : (
        <Figure
          value={String(beat.activeRunners)}
          unit={`OF ${beat.rosterSize}`}
          size="mid"
        />
      )}

      <ul className="crew-recap__runners" aria-label="Runners this week">
        {beat.runners.map((runner) => (
          <li key={runner.userId}>
            <Runner runner={runner} size={34} />
          </li>
        ))}
      </ul>

      {/* Three readings, one composition, divided by hairlines rather than boxed. */}
      <dl className="crew-recap__scoreboard">
        <div>
          <dd className="data-value">{totals.runs}</dd>
          <dt className="machine-label">Runs</dt>
        </div>
        <div>
          <dd className="data-value">{totals.activeRunners}</dd>
          <dt className="machine-label">Runners</dt>
        </div>
        <div>
          <dd className="data-value">
            {formatTotalHoursMinutes(totals.durationSeconds)}
          </dd>
          <dt className="machine-label">On Your Feet</dt>
        </div>
      </dl>
    </div>
  );
}

/* Frame 3 — the week's longest run, as a portrait. */
function LongestRunFrame({
  beat,
  award,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "longestRun" }>;
  award: CrewWeekRecapAward | null;
}) {
  return (
    <div className="crew-recap__frame">
      <Eyebrow>Longest Run</Eyebrow>
      <Figure value={formatMiles(beat.distanceMiles)} unit="MI" />

      <Runner runner={beat.runner} size={44} className="crew-recap__runner--lead" />

      <p className="crew-recap__caption machine-label">
        {WORKOUT_TYPE_LABEL[beat.activityType]} ·{" "}
        {formatDateLabel(beat.localDate, { weekday: "long" })}
      </p>

      {/*
        Only when the Crew's own award data actually ties a standing Special
        Block to this run's runner. The block is the existing hollow award
        object at portrait size — no invented trophy, no second badge.
      */}
      {award && (
        <div className="crew-recap__award-tie" data-award={award.awardType}>
          <span
            className="crew-recap__award-hero"
            style={{
              ["--piece-color" as string]: `var(--member-${crewMemberAccent(
                beat.runner.userId,
                beat.runner.accentColor,
              )})`,
            }}
          >
            <AwardBrick
              awardType={award.awardType}
              pieceColor={`var(--member-${crewMemberAccent(
                beat.runner.userId,
                beat.runner.accentColor,
              )})`}
              topFace={[true]}
              rightFace={[true]}
            />
          </span>
          <p className="machine-label">
            {CREW_AWARD_LABEL[award.awardType]} Special Block
          </p>
        </div>
      )}
    </div>
  );
}

/* Frame 4 — the most STACK-specific frame: a real piece of the Crew Build. */
function BuildFrame({ beat }: { beat: BuildBeat }) {
  return (
    <div className="crew-recap__frame crew-recap__frame--build">
      <div className="crew-recap__group">
        <Eyebrow>Added To The Build</Eyebrow>
        <Figure
          value={`+${beat.blocksPlaced}`}
          unit={beat.blocksPlaced === 1 ? "BLOCK" : "BLOCKS"}
        />
        <p className="crew-recap__caption machine-label">
          {formatMilesBuilt(beat.milesPlaced)} MI STANDING IN THE TOWER
        </p>
      </div>
      <RecapBuildCrop beat={beat} className="crew-recap__build-crop" />
    </div>
  );
}

/* Frame 5 — the awards, carried by the award blocks themselves. */
function SpecialBlocksFrame({
  beat,
}: {
  beat: Extract<CrewWeekRecapBeat, { kind: "specialBlocks" }>;
}) {
  return (
    <div className="crew-recap__frame">
      <Eyebrow>
        {beat.awards.length === 1 ? "Special Block" : "Special Blocks"}
      </Eyebrow>

      <ul className="crew-recap__awards">
        {beat.awards.map((award) => {
          const pieceColor = award.winner
            ? `var(--member-${crewMemberAccent(
              award.winner.userId,
              award.winner.accentColor,
            )})`
            : "var(--border-strong)";
          return (
            <li key={award.id} data-award={award.awardType}>
              <span className="crew-recap__award-hero">
                <AwardBrick
                  awardType={award.awardType}
                  pieceColor={pieceColor}
                  topFace={[true]}
                  rightFace={[true]}
                />
              </span>
              <p className="crew-recap__award-name">
                {CREW_AWARD_LABEL[award.awardType]}
              </p>
              <p className="crew-recap__award-winner">
                {award.winner?.displayName ?? "Crew member"}
              </p>
              <p className="crew-recap__award-result data-value">
                {formatCrewAwardResult(award.awardType, award.resultValue)}
              </p>
            </li>
          );
        })}
      </ul>

      <p className="crew-recap__note">
        Standing in the Crew Build, where the whole crew can see them.
      </p>
    </div>
  );
}

/* Frame 6 — the comparison, then the close. */
function ClosingFrame({
  change,
  recap,
  emblem,
}: {
  change: ChangeBeat | null;
  recap: CrewWeekRecap;
  emblem: CrewEmblemModel;
}) {
  const thisWeek = recap.totals.miles;
  const peak = change ? Math.max(change.previousMiles, thisWeek, 0.01) : 0;
  return (
    <div className="crew-recap__frame crew-recap__frame--closing">
      {change && (
        <>
          <Eyebrow>Against Last Week</Eyebrow>
          <Figure
            value={`${change.deltaMiles > 0 ? "+" : ""}${formatMilesBuilt(change.deltaMiles)}`}
            unit="MI"
            size="mid"
          />
          {/*
            Two columns, plain CSS. Height is the reading; the label beside each
            bar carries the same fact in text, so the bars are never the only
            channel.
          */}
          <div className="crew-recap__compare">
            <div className="crew-recap__compare-bars" aria-hidden="true">
              <span
                data-week="previous"
                style={{ ["--bar" as string]: `${(change.previousMiles / peak) * 100}%` }}
              />
              <span
                data-week="current"
                style={{ ["--bar" as string]: `${(thisWeek / peak) * 100}%` }}
              />
            </div>
            <dl className="crew-recap__compare-key">
              <div>
                <dd className="data-value">{formatMilesBuilt(change.previousMiles)} MI</dd>
                <dt>last week</dt>
              </div>
              <div data-current="true">
                <dd className="data-value">{formatMilesBuilt(thisWeek)} MI</dd>
                <dt>this week</dt>
              </div>
            </dl>
          </div>
        </>
      )}

      <div className="crew-recap__sign-off">
        <CrewEmblem emblem={emblem} size={44} />
        <p className="crew-recap__headline">WEEK COMPLETE</p>
        <p className="crew-recap__note">Nice work, {recap.crewName}.</p>
      </div>
    </div>
  );
}

export function CrewWeekRecapSheet({
  recap,
  emblem,
  isOpen,
  onClose,
}: CrewWeekRecapSheetProps) {
  /**
   * The story, with week-over-week folded into the close rather than standing
   * as its own frame: a comparison is how the week ended, not a separate beat,
   * and the recap should not end on a chart.
   */
  const frames = useMemo<Frame[]>(() => {
    const change =
      (recap.beats.find((beat) => beat.kind === "change") as ChangeBeat | undefined) ??
      null;
    return [
      { kind: "totals" },
      ...recap.beats
        .filter((beat): beat is Exclude<CrewWeekRecapBeat, ChangeBeat> => beat.kind !== "change")
        .map((beat) => ({ kind: "beat", beat }) as Frame),
      { kind: "closing", change },
    ];
  }, [recap]);

  const build =
    (recap.beats.find((beat) => beat.kind === "build") as BuildBeat | undefined) ?? null;

  /**
   * The Special Block the longest run earned, when the Crew's data actually
   * says so: a placed Long Haul block whose winner is the runner of that run.
   * Anything less is a coincidence, and the frame shows nothing.
   */
  const longestRunAward = useMemo<CrewWeekRecapAward | null>(() => {
    const longest = recap.beats.find((beat) => beat.kind === "longestRun");
    const special = recap.beats.find((beat) => beat.kind === "specialBlocks");
    if (!longest || !special) return null;
    return (
      special.awards.find(
        (award) =>
          award.awardType === "longHaul" &&
          award.winner?.userId === longest.runner.userId,
      ) ?? null
    );
  }, [recap]);

  /**
   * Which frame the runner is on. Held here rather than synchronized to
   * `isOpen`, because the recap is mounted for the visit: closing it unmounts
   * the component, so the next visit already starts on the first frame with no
   * effect reaching in to reset anything.
   */
  const [index, setIndex] = useState(0);

  const position = Math.min(index, frames.length - 1);
  const current = frames[position];
  const isLast = position >= frames.length - 1;

  return (
    <Sheet
      title={`${recap.crewName} · Week Recap`}
      isOpen={isOpen}
      onClose={onClose}
      className="sheet--crew-recap"
    >
      <div className="crew-recap">
        {/*
          Position, quietly. Small blocks rather than dots, because that is the
          shape this product is made of. Decorative: the live region below
          announces the same thing in words.
        */}
        <ol className="crew-recap__progress" aria-hidden="true">
          {frames.map((frame, step) => (
            <li
              key={`${frame.kind}-${step}`}
              data-state={step === position ? "current" : step < position ? "done" : "ahead"}
            />
          ))}
        </ol>

        {/*
          One live region for the whole story. Each frame replaces the last, so
          a screen reader hears the beat it moved to rather than the whole
          recap again. `key` restarts the frame's entrance.
        */}
        {/*
          Which composition this is. The two frames built around a tower stand
          their crop on the floor of the stage; an ordinary beat sits centred
          in it, so a short frame is not left clinging to the progress rail.
        */}
        <div
          className="crew-recap__stage"
          data-frame={
            current.kind === "beat"
              ? current.beat.kind
              : // A week with nothing standing in the tower has no crop to put
              // on the floor, so its opening centres like an ordinary beat
              // rather than leaving two thirds of the sheet empty under it.
              current.kind === "totals" && build
                ? "totals"
                : current.kind === "totals"
                  ? "totals-bare"
                  : current.kind
          }
          aria-live="polite"
        >
          <p className="visually-hidden">
            Frame {position + 1} of {frames.length}
          </p>
          <div className="crew-recap__pane" key={position}>
            {current.kind === "totals" && (
              <TotalsFrame recap={recap} emblem={emblem} build={build} />
            )}
            {current.kind === "beat" && current.beat.kind === "participation" && (
              <ParticipationFrame beat={current.beat} totals={recap.totals} />
            )}
            {current.kind === "beat" && current.beat.kind === "longestRun" && (
              <LongestRunFrame beat={current.beat} award={longestRunAward} />
            )}
            {current.kind === "beat" && current.beat.kind === "build" && (
              <BuildFrame beat={current.beat} />
            )}
            {current.kind === "beat" && current.beat.kind === "specialBlocks" && (
              <SpecialBlocksFrame beat={current.beat} />
            )}
            {current.kind === "closing" && (
              <ClosingFrame change={current.change} recap={recap} emblem={emblem} />
            )}
          </div>
        </div>

        <div className="crew-recap__controls">
          <button
            type="button"
            className="crew-recap__step"
            disabled={position === 0}
            onClick={() => setIndex((step) => Math.max(0, step - 1))}
          >
            <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" />
            Back
          </button>

          {isLast ? (
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          ) : (
            <button
              type="button"
              className="crew-recap__step crew-recap__step--next"
              onClick={() =>
                setIndex((step) => Math.min(frames.length - 1, step + 1))
              }
            >
              Next
              <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
