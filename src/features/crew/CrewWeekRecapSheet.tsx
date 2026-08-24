import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { formatDateLabel } from "../../domain/dates";
import { formatMiles, formatMilesBuilt } from "../../domain/distance";
import { formatDurationSeconds, formatTotalHoursMinutes } from "../../domain/duration";
import { formatWeekRange } from "../../domain/plan";
import { formatPaceSeconds } from "../../domain/runs";
import { CREW_AWARD_LABEL, formatCrewAwardResult } from "../../crew/awards";
import { crewMemberAccent } from "../../crew/memberAccent";
import {
  nextCrewWeekAfter,
  type CrewWeekPerformance,
  type CrewWeekRecap,
  type CrewWeekRecapAward,
  type CrewWeekRecapBeat,
  type CrewWeekRecapRunner,
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
 * Up to six pages sharing one system, each with its own job, rhythm and
 * backdrop — not one composition repeated six times. Each page earns its place
 * by carrying something the pages before it did not, which is what Evolution
 * 2.1 asked of the last one: a week that has already been counted, built and
 * compared has nothing left to say about itself, so the finish hands over to
 * the week now being run. The sheet itself is the canvas:
 * there is no inner stage card and no page that is a bordered rectangle
 * containing a number. Hierarchy comes from type, space and actual Crew
 * objects.
 *
 * Everything visible here is drawn by the app from the Crew's own data. The
 * blocks are the real `Brick`/`AwardBrick` construction under the real member
 * colours; the identity marks are the real `CrewEmblem` and `RunnerIcon`; the
 * backdrops are CSS gradients keyed off the page. No artwork, no illustration,
 * no second tower renderer, nothing that would need an asset exported to ship.
 *
 * The recap is allowed more personality than an ordinary STACK screen, and it
 * spends that budget on page identity rather than on decoration: each backdrop
 * says something about the page it is behind, and every one of them sits far
 * enough back that the data stays the loudest thing on the screen.
 *
 * Nothing advances on its own. An auto-playing story is a Reduced Motion
 * problem, a screen-reader problem and a reading-speed problem at once.
 *
 * The pages come from `crewWeekRecap`, so this component decides only how a
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
type ParticipationBeat = Extract<CrewWeekRecapBeat, { kind: "participation" }>;
type PerformancesBeat = Extract<CrewWeekRecapBeat, { kind: "performances" }>;
type AwardsBeat = Extract<CrewWeekRecapBeat, { kind: "specialBlocks" }>;

/** Page identity. Drives the title, the backdrop, and the layout variant. */
type Page =
  | { kind: "together" }
  | { kind: "performances"; beat: PerformancesBeat }
  | { kind: "build"; beat: BuildBeat }
  | { kind: "awards"; beat: AwardsBeat }
  | { kind: "change"; beat: ChangeBeat }
  | { kind: "nextWeek" };

/** How many runner marks the participation row shows before it counts the rest. */
const RUNNER_ROW_LIMIT = 6;

const PERFORMANCE_LABEL: Record<CrewWeekPerformance["kind"], string> = {
  best5k: "Fastest 5K",
  bestPace: "Fastest Avg Pace",
  longestRun: "Longest Run",
  biggestCrewDay: "Biggest Crew Day",
  mostActiveDay: "Most Active Day",
};

/**
 * Metres in a mile, for restating a verified 5K as a pace.
 *
 * This is the one arithmetic the 5K allows, and it runs in the safe direction:
 * the source's own 5,000 m time expressed per mile is the same measurement in
 * another unit. The forbidden direction — a run's average pace scaled into a
 * 5K — invents a measurement, and nothing here does it.
 */
const METERS_PER_MILE = 1609.344;
const MILES_IN_5K = 5000 / METERS_PER_MILE;

/** The reading and its unit, kept apart so the unit can sit back at baseline. */
function performanceReading(
  performance: CrewWeekPerformance,
): { value: string; unit: string | null } {
  switch (performance.kind) {
    case "best5k":
      // An elapsed time, so it carries no unit: `21:30` is a 5K result the way
      // a stopwatch reads it, and `21:30 MIN` would be reading it aloud.
      return { value: formatDurationSeconds(Math.round(performance.value)), unit: null };
    case "longestRun":
      return { value: formatMiles(performance.value), unit: "MI" };
    case "bestPace":
      // `formatPaceSeconds` already carries its own `/MI`.
      return { value: formatPaceSeconds(performance.value), unit: null };
    case "biggestCrewDay":
      return { value: formatMilesBuilt(performance.value), unit: "MI" };
    case "mostActiveDay":
      return {
        value: String(performance.value),
        unit: performance.value === 1 ? "RUN" : "RUNS",
      };
  }
}

/**
 * The one line under a reading.
 *
 * Deliberately short. The figure is the fact; this says only what the figure
 * cannot — which day, or what had to be true for the number to qualify.
 */
function performanceDetail(performance: CrewWeekPerformance): string {
  const day = formatDateLabel(performance.localDate, { weekday: "long" });
  switch (performance.kind) {
    case "best5k":
      // The pace is the same verified result said per mile, never a second
      // measurement — see `MILES_IN_5K`. The day is what the figure cannot say.
      return `${day} · ${formatPaceSeconds(performance.value / MILES_IN_5K)}`;
    case "longestRun":
      return day;
    case "bestPace":
      // The same qualifier the Fastest Avg. Pace award uses, stated rather
      // than assumed: a pace over two miles is not a pace over any distance.
      return "2+ MI RUN";
    case "biggestCrewDay":
      return `${day} · ${performance.runCount} ${performance.runCount === 1 ? "RUN" : "RUNS"}`;
    case "mostActiveDay":
      return day;
  }
}

/** The runner's own mark and name, in their own colour. Never a rank. */
function Runner({
  runner,
  size = 26,
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
  unit?: string | null;
  size?: "hero" | "mid" | "small";
}) {
  return (
    <p className="crew-recap__figure data-value" data-size={size}>
      {value}
      {unit && <span className="crew-recap__unit machine-label">{unit}</span>}
    </p>
  );
}

/* Page 1 — Together. The crew, the week, and what it built. */
function TogetherPage({
  recap,
  emblem,
  participation,
  build,
}: {
  recap: CrewWeekRecap;
  emblem: CrewEmblemModel;
  participation: ParticipationBeat | null;
  build: BuildBeat | null;
}) {
  const { totals } = recap;
  const shown = participation?.runners.slice(0, RUNNER_ROW_LIMIT) ?? [];
  const overflow = (participation?.runners.length ?? 0) - shown.length;

  return (
    <div className="crew-recap__page crew-recap__page--together">
      <div className="crew-recap__lead">
        <div className="crew-recap__crest">
          <CrewEmblem emblem={emblem} size={36} />
          <p className="machine-label">
            {formatWeekRange(recap.weekStart, recap.weekEnd)}
          </p>
        </div>

        <Figure value={formatMilesBuilt(totals.miles)} unit="MI" />
        <p className="crew-recap__together">TOGETHER</p>

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
            <dt className="machine-label">Hours</dt>
          </div>
        </dl>
      </div>

      {/*
        Participation, folded in rather than given a page of its own — and
        built to scale: a count in the machine voice, then a wrapping row of
        marks that counts the rest, so an eleven-person Crew reads as easily
        as a four-person one.
      */}
      {participation && (
        <div className="crew-recap__participation">
          <p className="crew-recap__participation-line machine-label">
            {participation.everyoneRan
              ? `FULL CREW · ${participation.rosterSize} / ${participation.rosterSize}`
              : `${participation.activeRunners} / ${participation.rosterSize} RAN`}
          </p>
          <ul
            className="crew-recap__runner-row"
            aria-label={
              participation.everyoneRan
                ? "Everyone in the crew ran this week"
                : `${participation.activeRunners} of ${participation.rosterSize} crew members ran this week`
            }
          >
            {shown.map((runner) => (
              <li
                key={runner.userId}
                data-member-color={crewMemberAccent(runner.userId, runner.accentColor)}
              >
                <RunnerIcon icon={runner.runnerIcon} size={26} />
                <span className="visually-hidden">{runner.displayName}</span>
              </li>
            ))}
            {overflow > 0 && (
              <li className="crew-recap__runner-more machine-label">+{overflow}</li>
            )}
          </ul>
        </div>
      )}

      {/*
        The week's own blocks, standing on the floor of the page. What makes
        this fun is that the shape is the crew's real Build, not that a graphic
        was added to it.
      */}
      {build && <RecapBuildCrop beat={build} className="crew-recap__opening-crop" />}
    </div>
  );
}

/* Page 2 — Best Performances. One hero, then the rest. */
function PerformancesPage({ beat }: { beat: PerformancesBeat }) {
  const [hero, ...rest] = beat.items;
  const heroReading = performanceReading(hero);

  return (
    <div className="crew-recap__page crew-recap__page--performances">
      <Eyebrow>Best Performances</Eyebrow>

      <div className="crew-recap__hero-effort">
        <p className="crew-recap__effort-label machine-label">
          {PERFORMANCE_LABEL[hero.kind]}
        </p>
        <Figure value={heroReading.value} unit={heroReading.unit} size="mid" />
        <p className="crew-recap__effort-detail">
          {hero.runner && <Runner runner={hero.runner} size={26} />}
          <span className="machine-label">{performanceDetail(hero)}</span>
        </p>
      </div>

      {rest.length > 0 && (
        <ul className="crew-recap__efforts">
          {rest.map((performance) => {
            const reading = performanceReading(performance);
            return (
              <li key={performance.kind}>
                <span className="crew-recap__effort-label machine-label">
                  {PERFORMANCE_LABEL[performance.kind]}
                </span>
                <span className="crew-recap__effort-value data-value">
                  {reading.value}
                  {reading.unit && (
                    <span className="crew-recap__unit machine-label">{reading.unit}</span>
                  )}
                </span>
                <span className="crew-recap__effort-detail">
                  {performance.runner && <Runner runner={performance.runner} size={22} />}
                  <span className="machine-label">{performanceDetail(performance)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* Page 3 — the most STACK-specific page: a real piece of the Crew Build. */
function BuildPage({ beat }: { beat: BuildBeat }) {
  return (
    <div className="crew-recap__page crew-recap__page--build">
      <div className="crew-recap__lead">
        <Eyebrow>Added To The Build</Eyebrow>
        <Figure
          value={`+${beat.blocksPlaced}`}
          unit={beat.blocksPlaced === 1 ? "BLOCK" : "BLOCKS"}
        />
        {/* The tower below says where the miles are; the line only says how many. */}
        <p className="crew-recap__caption machine-label">
          {formatMilesBuilt(beat.milesPlaced)} MI BUILT
        </p>
      </div>
      <RecapBuildCrop beat={beat} className="crew-recap__build-crop" />
    </div>
  );
}

/* Page 4 — Awards, carried by the award blocks themselves. */
function AwardsPage({ beat }: { beat: AwardsBeat }) {
  return (
    <div className="crew-recap__page crew-recap__page--awards">
      <Eyebrow>Awards</Eyebrow>

      {/*
        The count decides the arrangement rather than `auto-fit` deciding it
        from whatever width is going: one award is a centred hero, two are a
        pair, three or four are a 2x2, and more than that tightens rather than
        sprawling.
      */}
      <ul
        className="crew-recap__awards"
        data-count={Math.min(beat.awards.length, 5)}
      >
        {beat.awards.map((award: CrewWeekRecapAward) => {
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
              <p className="crew-recap__award-result data-value">
                {formatCrewAwardResult(award.awardType, award.resultValue)}
              </p>
              {award.winner && <Runner runner={award.winner} size={22} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* Page 5 — against last week. The bars are the object on this page. */
function ChangePage({
  beat,
  miles,
}: {
  beat: ChangeBeat;
  miles: number;
}) {
  const peak = Math.max(beat.previousMiles, miles, 0.01);
  return (
    <div className="crew-recap__page crew-recap__page--change">
      <div className="crew-recap__lead">
        <Eyebrow>Against Last Week</Eyebrow>
        <Figure
          value={`${beat.deltaMiles > 0 ? "+" : ""}${formatMilesBuilt(beat.deltaMiles)}`}
          unit="MI"
          size="mid"
        />
      </div>

      {/*
        Two columns, plain CSS, at a size worth looking at. Height is the
        reading; each column's own figure sits under it in text, so height is
        never the only channel — and nothing here interprets the delta for the
        runner, because the two numbers already do.
      */}
      <div className="crew-recap__compare">
        <div className="crew-recap__compare-bars" aria-hidden="true">
          <span
            data-week="previous"
            style={{ ["--bar" as string]: `${(beat.previousMiles / peak) * 100}%` }}
          />
          <span
            data-week="current"
            style={{ ["--bar" as string]: `${(miles / peak) * 100}%` }}
          />
        </div>
        <dl className="crew-recap__compare-key">
          <div>
            <dd className="data-value">{formatMilesBuilt(beat.previousMiles)}</dd>
            <dt className="machine-label">Last Week</dt>
          </div>
          <div data-current="true">
            <dd className="data-value">{formatMilesBuilt(miles)}</dd>
            <dt className="machine-label">This Week</dt>
          </div>
        </dl>
      </div>
    </div>
  );
}

/* The last page — a handoff, not a summary. */
function NextWeekPage({ recap, emblem }: { recap: CrewWeekRecap; emblem: CrewEmblemModel }) {
  const next = nextCrewWeekAfter({ weekStart: recap.weekStart, weekEnd: recap.weekEnd });
  return (
    <div className="crew-recap__page crew-recap__page--next-week">
      {/*
        Evolution 2.1 replaced the old finish, which repeated the emblem, the
        same mileage and runners the opening page had already given at display
        size, and the same Build crop page three had just animated. Three jobs
        the recap had already done, at the moment it should have been ending.

        What is left is the one fact none of the earlier pages could carry: the
        week that is already running. It is the same seven days for every
        member, so the handoff stays a shared Crew fact — no personal workout,
        no plan, nothing one runner sees and another does not. The footer's
        `Done` is the action; a second button here would be the same tap twice.
      */}
      <div className="crew-recap__finale">
        <CrewEmblem emblem={emblem} size={54} />
        <p className="crew-recap__headline">NEW WEEK LIVE</p>
        <p className="crew-recap__finale-facts machine-label">
          {formatWeekRange(next.weekStart, next.weekEnd)}
        </p>
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
  const beat = <K extends CrewWeekRecapBeat["kind"]>(kind: K) =>
    (recap.beats.find((item) => item.kind === kind) ?? null) as
    | Extract<CrewWeekRecapBeat, { kind: K }>
    | null;

  const participation = beat("participation");
  const build = beat("build");

  /**
   * The story. Participation and the totals share the opening page rather than
   * each taking one — a page whose only fact is "everyone ran" is a weak page,
   * and it does not scale to a Crew of eleven. Every other page exists only if
   * its beat does, so a quiet week is a shorter recap rather than a padded one.
   */
  const pages = useMemo<Page[]>(() => {
    const performances = recap.beats.find((item) => item.kind === "performances");
    const awards = recap.beats.find((item) => item.kind === "specialBlocks");
    const change = recap.beats.find((item) => item.kind === "change");
    return [
      { kind: "together" } as Page,
      ...(performances ? [{ kind: "performances", beat: performances } as Page] : []),
      ...(build ? [{ kind: "build", beat: build } as Page] : []),
      ...(awards ? [{ kind: "awards", beat: awards } as Page] : []),
      ...(change ? [{ kind: "change", beat: change } as Page] : []),
      { kind: "nextWeek" } as Page,
    ];
  }, [recap, build]);

  /**
   * Which page the runner is on. Held here rather than synchronized to
   * `isOpen`, because the recap is mounted for the visit: closing it unmounts
   * the component, so the next visit already starts on the first page with no
   * effect reaching in to reset anything.
   */
  const [index, setIndex] = useState(0);

  const position = Math.min(index, pages.length - 1);
  const current = pages[position];
  const isLast = position >= pages.length - 1;

  return (
    <Sheet
      title={`${recap.crewName} · Week Recap`}
      isOpen={isOpen}
      onClose={onClose}
      /*
       * The page's identity rides on the sheet itself, not on a box inside it.
       * The backdrop is drawn by `.sheet__panel::before`, so a page's mood runs
       * behind the title, the progress rail, the content and the footer at
       * once — one designed object rather than content laid over a decorative
       * patch in the middle of the body.
       */
      className={`sheet--crew-recap sheet--crew-recap--${current.kind}`}
    >
      <div className="crew-recap">
        {/*
          Position, quietly. Small blocks rather than dots, because that is the
          shape this product is made of. Decorative: the live region below
          announces the same thing in words.
        */}
        <ol className="crew-recap__progress" aria-hidden="true">
          {pages.map((page, step) => (
            <li
              key={`${page.kind}-${step}`}
              data-state={step === position ? "current" : step < position ? "done" : "ahead"}
            />
          ))}
        </ol>

        {/*
          One live region for the whole story. Each page replaces the last, so
          a screen reader hears the page it moved to rather than the whole
          recap again. `key` restarts the page's entrance.
        */}
        <div className="crew-recap__stage" aria-live="polite">
          <p className="visually-hidden">
            Page {position + 1} of {pages.length}
          </p>
          <div className="crew-recap__pane" key={position}>
            {current.kind === "together" && (
              <TogetherPage
                recap={recap}
                emblem={emblem}
                participation={participation}
                build={build}
              />
            )}
            {current.kind === "performances" && <PerformancesPage beat={current.beat} />}
            {current.kind === "build" && <BuildPage beat={current.beat} />}
            {current.kind === "awards" && <AwardsPage beat={current.beat} />}
            {current.kind === "change" && (
              <ChangePage beat={current.beat} miles={recap.totals.miles} />
            )}
            {current.kind === "nextWeek" && (
              <NextWeekPage recap={recap} emblem={emblem} />
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
              onClick={() => setIndex((step) => Math.min(pages.length - 1, step + 1))}
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
