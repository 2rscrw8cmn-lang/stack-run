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

type Page =
  | { kind: "together" }
  | { kind: "performances"; beat: PerformancesBeat }
  | { kind: "build"; beat: BuildBeat }
  | { kind: "awards"; beat: AwardsBeat }
  | { kind: "change"; beat: ChangeBeat }
  | { kind: "nextWeek" };

const RUNNER_ROW_LIMIT = 6;

const PERFORMANCE_LABEL: Record<CrewWeekPerformance["kind"], string> = {
  best5k: "Fastest 5K",
  bestPace: "Fastest Avg Pace",
  longestRun: "Longest Run",
  mostMiles: "Most Miles",
  mostRuns: "Most Runs",
  mostTimeRunning: "Most Time Running",
  biggestMileageIncrease: "Biggest Mileage Increase",
  biggestCrewDay: "Biggest Crew Day",
  mostRunnersDay: "Most Runners In One Day",
};

const METERS_PER_MILE = 1609.344;
const MILES_IN_5K = 5000 / METERS_PER_MILE;

function performanceReading(
  performance: CrewWeekPerformance,
): { value: string; unit: string | null } {
  switch (performance.kind) {
    case "best5k":
      return { value: formatDurationSeconds(Math.round(performance.value)), unit: null };
    case "bestPace":
      return { value: formatPaceSeconds(performance.value), unit: null };
    case "longestRun":
      return { value: formatMiles(performance.value), unit: "MI" };
    case "mostMiles":
    case "biggestCrewDay":
      return { value: formatMilesBuilt(performance.value), unit: "MI" };
    case "biggestMileageIncrease":
      return { value: `+${formatMilesBuilt(performance.value)}`, unit: "MI" };
    case "mostRuns":
      return {
        value: String(performance.value),
        unit: performance.value === 1 ? "RUN" : "RUNS",
      };
    case "mostTimeRunning":
      return { value: formatTotalHoursMinutes(performance.value), unit: null };
    case "mostRunnersDay":
      return {
        value: String(performance.value),
        unit: performance.value === 1 ? "RUNNER" : "RUNNERS",
      };
  }
}

function performanceDetail(performance: CrewWeekPerformance): string {
  const day = performance.localDate
    ? formatDateLabel(performance.localDate, { weekday: "long" })
    : null;
  switch (performance.kind) {
    case "best5k":
      return `${day ?? ""} · ${formatPaceSeconds(performance.value / MILES_IN_5K)}`;
    case "longestRun":
      return day ?? "";
    case "bestPace":
      return "2+ MI RUN";
    case "mostMiles":
    case "mostRuns":
    case "mostTimeRunning":
      return "THIS WEEK";
    case "biggestMileageIncrease":
      return "VS LAST WEEK";
    case "biggestCrewDay":
      return `${day ?? ""} · ${performance.runCount} ${performance.runCount === 1 ? "RUN" : "RUNS"}`;
    case "mostRunnersDay":
      return day ?? "";
  }
}

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
          <p className="machine-label">{formatWeekRange(recap.weekStart, recap.weekEnd)}</p>
        </div>
        <Figure value={formatMilesBuilt(totals.miles)} unit="MI" />
        <p className="crew-recap__together">TOGETHER</p>
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
            <dd className="data-value">{formatTotalHoursMinutes(totals.durationSeconds)}</dd>
            <dt className="machine-label">Hours</dt>
          </div>
        </dl>
      </div>

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
            {overflow > 0 && <li className="crew-recap__runner-more machine-label">+{overflow}</li>}
          </ul>
        </div>
      )}

      {build && <RecapBuildCrop beat={build} className="crew-recap__opening-crop" />}
    </div>
  );
}

function PerformancesPage({ beat }: { beat: PerformancesBeat }) {
  const [hero, ...rest] = beat.items;
  const heroReading = performanceReading(hero);

  return (
    <div className="crew-recap__page crew-recap__page--performances">
      <Eyebrow>Best Performances</Eyebrow>
      <div className="crew-recap__hero-effort">
        <p className="crew-recap__effort-label machine-label">{PERFORMANCE_LABEL[hero.kind]}</p>
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
                  {reading.unit && <span className="crew-recap__unit machine-label">{reading.unit}</span>}
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

function BuildPage({ beat }: { beat: BuildBeat }) {
  return (
    <div className="crew-recap__page crew-recap__page--build">
      <div className="crew-recap__lead">
        <Eyebrow>Added To The Build</Eyebrow>
        <Figure value={`+${beat.blocksPlaced}`} unit={beat.blocksPlaced === 1 ? "BLOCK" : "BLOCKS"} />
        <p className="crew-recap__caption machine-label">{formatMilesBuilt(beat.milesPlaced)} MI BUILT</p>
      </div>
      <RecapBuildCrop beat={beat} className="crew-recap__build-crop" />
    </div>
  );
}

function AwardsPage({ beat }: { beat: AwardsBeat }) {
  return (
    <div className="crew-recap__page crew-recap__page--awards">
      <Eyebrow>Awards</Eyebrow>
      <ul className="crew-recap__awards" data-count={Math.min(beat.awards.length, 5)}>
        {beat.awards.map((award: CrewWeekRecapAward) => {
          const pieceColor = award.winner
            ? `var(--member-${crewMemberAccent(award.winner.userId, award.winner.accentColor)})`
            : "var(--border-strong)";
          return (
            <li key={award.id} data-award={award.awardType}>
              <span className="crew-recap__award-hero">
                <AwardBrick awardType={award.awardType} pieceColor={pieceColor} topFace={[true]} rightFace={[true]} />
              </span>
              <p className="crew-recap__award-name">{CREW_AWARD_LABEL[award.awardType]}</p>
              <p className="crew-recap__award-result data-value">{formatCrewAwardResult(award.awardType, award.resultValue)}</p>
              {award.winner && <Runner runner={award.winner} size={22} />}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ChangePage({ beat, miles }: { beat: ChangeBeat; miles: number }) {
  const peak = Math.max(beat.previousMiles, miles, 0.01);
  return (
    <div className="crew-recap__page crew-recap__page--change">
      <div className="crew-recap__lead">
        <Eyebrow>Against Last Week</Eyebrow>
        <Figure value={`${beat.deltaMiles > 0 ? "+" : ""}${formatMilesBuilt(beat.deltaMiles)}`} unit="MI" size="mid" />
      </div>
      <div className="crew-recap__compare">
        <div className="crew-recap__compare-bars" aria-hidden="true">
          <span data-week="previous" style={{ ["--bar" as string]: `${(beat.previousMiles / peak) * 100}%` }} />
          <span data-week="current" style={{ ["--bar" as string]: `${(miles / peak) * 100}%` }} />
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

function NextWeekPage({ recap, emblem }: { recap: CrewWeekRecap; emblem: CrewEmblemModel }) {
  const next = nextCrewWeekAfter({ weekStart: recap.weekStart, weekEnd: recap.weekEnd });
  return (
    <div className="crew-recap__page crew-recap__page--next-week">
      <div className="crew-recap__finale">
        <CrewEmblem emblem={emblem} size={54} />
        <p className="crew-recap__headline">NEW WEEK LIVE</p>
        <p className="crew-recap__finale-facts machine-label">{formatWeekRange(next.weekStart, next.weekEnd)}</p>
      </div>
    </div>
  );
}

export function CrewWeekRecapSheet({ recap, emblem, isOpen, onClose }: CrewWeekRecapSheetProps) {
  const beat = <K extends CrewWeekRecapBeat["kind"]>(kind: K) =>
    (recap.beats.find((item) => item.kind === kind) ?? null) as
    | Extract<CrewWeekRecapBeat, { kind: K }>
    | null;

  const participation = beat("participation");
  const build = beat("build");

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

  const [index, setIndex] = useState(0);
  const position = Math.min(index, pages.length - 1);
  const current = pages[position];
  const isLast = position >= pages.length - 1;

  return (
    <Sheet title={`${recap.crewName} · Week Recap`} isOpen={isOpen} onClose={onClose} className={`sheet--crew-recap sheet--crew-recap--${current.kind}`}>
      <div className="crew-recap">
        <ol className="crew-recap__progress" aria-hidden="true">
          {pages.map((page, step) => (
            <li key={`${page.kind}-${step}`} data-state={step === position ? "current" : step < position ? "done" : "ahead"} />
          ))}
        </ol>

        <div className="crew-recap__stage" aria-live="polite">
          <p className="visually-hidden">Page {position + 1} of {pages.length}</p>
          <div className="crew-recap__pane" key={position}>
            {current.kind === "together" && <TogetherPage recap={recap} emblem={emblem} participation={participation} build={build} />}
            {current.kind === "performances" && <PerformancesPage beat={current.beat} />}
            {current.kind === "build" && <BuildPage beat={current.beat} />}
            {current.kind === "awards" && <AwardsPage beat={current.beat} />}
            {current.kind === "change" && <ChangePage beat={current.beat} miles={recap.totals.miles} />}
            {current.kind === "nextWeek" && <NextWeekPage recap={recap} emblem={emblem} />}
          </div>
        </div>

        <div className="crew-recap__controls">
          <button type="button" className="crew-recap__step" disabled={position === 0} onClick={() => setIndex((step) => Math.max(0, step - 1))}>
            <ChevronLeft size={16} strokeWidth={2.2} aria-hidden="true" /> Back
          </button>
          {isLast ? (
            <Button variant="primary" onClick={onClose}>Done</Button>
          ) : (
            <button type="button" className="crew-recap__step crew-recap__step--next" onClick={() => setIndex((step) => Math.min(pages.length - 1, step + 1))}>
              Next <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </Sheet>
  );
}
