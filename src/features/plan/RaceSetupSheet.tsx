import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { applyCrossTrainingDays } from "../../domain/crossTrainingDays";
import { formatDateLabel } from "../../domain/dates";
import {
  countQualitySessions,
  DISTANCE_PROFILES,
  generateTrainingPlan,
  inferRunnerLevel,
  longRunLadder,
  mondayOf,
  plannedWeeks,
  planStartDate,
  weeklyMileageLadder,
  RACE_DISTANCE_ORDER,
  RUNNER_LEVEL_BLURB,
  RUNNER_LEVEL_LABEL,
  RUNNER_LEVEL_ORDER,
  weeksAvailable,
  type RaceDistance,
  type RacePlanSetup,
  type RunnerLevel,
} from "../../domain/racePlan";
import type { Weekday } from "../../domain/runDays";
import type { RunLog, TrainingPlan } from "../../domain/types";

interface RaceSetupSheetProps {
  /** The current plan, for what regenerating would cost. */
  plan: TrainingPlan;
  setup: RacePlanSetup | null;
  runDays: Weekday[] | null;
  crossTrainingDays: Weekday[] | null;
  runLogs: RunLog[];
  today: string;
  isOpen: boolean;
  onClose: () => void;
  onGenerate: (setup: RacePlanSetup, plan: TrainingPlan) => void;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The race, and the plan built for it.
 *
 * One race at a time, because a plan is for the thing you are training for and
 * two of those is two plans. Changing any of these four answers rebuilds the
 * schedule from today to race day; the runs already recorded survive it, which
 * is the only reason regenerating is a reasonable thing to offer at all.
 */
export function RaceSetupSheet({
  plan,
  setup,
  runDays,
  crossTrainingDays,
  runLogs,
  today,
  isOpen,
  onClose,
  onGenerate,
}: RaceSetupSheetProps) {
  const [name, setName] = useState(setup?.name ?? plan.race.name);
  const [date, setDate] = useState(setup?.date ?? plan.race.date);
  const [distance, setDistance] = useState<RaceDistance>(
    setup?.distance ?? "half",
  );
  // Not "novice" when nothing is saved: the plan on screen already says what
  // level it is written at, and defaulting to the lowest one silently strips
  // the speed work out of a plan that has some.
  const [level, setLevel] = useState<RunnerLevel>(
    setup?.level ?? inferRunnerLevel(plan, setup?.distance ?? "half"),
  );
  /**
   * Null while the runner has not said, so the suggested start keeps following
   * the distance and the race date. The moment they pick one it stops moving
   * under them, which is the whole point of being able to pick one.
   */
  const [chosenStart, setChosenStart] = useState<string | null>(
    setup?.startDate ?? null,
  );

  const profile = DISTANCE_PROFILES[distance];
  const validDate = ISO_DATE.test(date);
  const available = validDate ? weeksAvailable(today, date) : 0;
  const isPast = validDate && available < 1;

  const suggestedStart = validDate ? planStartDate(distance, today, date) : "";
  const validStart = chosenStart === null || ISO_DATE.test(chosenStart);
  const startField = chosenStart ?? suggestedStart;
  // Training weeks run Monday to Sunday, so a chosen Wednesday means the
  // Monday of that week. Say the date the plan will actually begin on.
  const startsAfterRace =
    validDate && validStart && !!chosenStart && mondayOf(chosenStart) > mondayOf(date);
  const startDate =
    validDate && validStart && !startsAfterRace
      ? planStartDate(distance, today, date, chosenStart ?? undefined)
      : "";
  const weeks = startDate
    ? plannedWeeks(distance, today, date, chosenStart ?? undefined)
    : 0;

  // A race further out than the template stretches starts later than today.
  const startsLater = Boolean(startDate) && startDate > today;
  const startsInThePast = Boolean(startDate) && startDate < mondayOf(today);
  const isTight = !isPast && Boolean(startDate) && weeks < profile.minWeeks;
  const canGenerate =
    validDate &&
    !isPast &&
    validStart &&
    !startsAfterRace &&
    name.trim().length > 0;

  // Every recorded run survives a rebuild, scheduled or extra, so the count
  // that matters here is all of them.
  const recorded = runLogs.length;

  /**
   * The hard sessions the plan on screen has, and how many of them the level
   * being chosen would keep. Rebuilding a plan with speed work in it at a
   * level that has none is a real loss and it used to happen silently.
   */
  const existing = countQualitySessions(plan);
  const existingQuality = existing.intervals + existing.simulation;
  const keeps = profile.levels[level].quality;
  const losesIntervals = existing.intervals > 0 && keeps < 1;
  const losesRacePace = existing.simulation > 0 && keeps < 2;
  const dropsQuality = losesIntervals || losesRacePace;

  // What the plan can actually build to in the weeks it has. A squeezed plan
  // no longer jumps to the template's peak; it climbs as far as it safely can.
  const reachableLong = startDate
    ? Math.max(...longRunLadder(distance, level, weeks))
    : profile.levels[level].peakLongMiles;
  const shortOfPeak = reachableLong < profile.levels[level].peakLongMiles;
  // Stated because the level is really a choice about how much running this
  // is, and the long run alone does not say that.
  const biggestWeek = startDate
    ? Math.max(...weeklyMileageLadder(distance, level, weeks))
    : profile.levels[level].peakWeeklyMiles;

  function generate() {
    const chosen: RacePlanSetup = {
      name: name.trim(),
      date,
      distance,
      level,
      ...(chosenStart ? { startDate: mondayOf(chosenStart) } : {}),
    };
    const generated = generateTrainingPlan(chosen, {
      today,
      runDays: runDays ?? undefined,
    });
    onGenerate(
      chosen,
      crossTrainingDays?.length
        ? applyCrossTrainingDays(generated, crossTrainingDays, { today })
        : generated,
    );
  }

  return (
    <Sheet title="Race" isOpen={isOpen} onClose={onClose}>
      <div className="race-setup">
        <FormField label="Race name">
          <input
            className="run-input"
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>

        <FormField
          label="Race date"
          error={isPast ? "That date has already passed." : undefined}
        >
          <input
            className="run-input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </FormField>

        <FormField
          label="Start training"
          hint={
            startDate && startDate !== startField
              ? `Training weeks run Monday to Sunday, so this plan begins ${formatDateLabel(startDate)}.`
              : chosenStart
                ? undefined
                : "Suggested from the race. Change it to start on a different week."
          }
          error={
            startsAfterRace
              ? "Training has to start before race day."
              : undefined
          }
        >
          <input
            className="run-input"
            type="date"
            value={startField}
            max={date}
            onChange={(event) => setChosenStart(event.target.value)}
          />
        </FormField>

        {chosenStart !== null && chosenStart !== suggestedStart && (
          <button
            type="button"
            className="race-setup__reset-start"
            onClick={() => setChosenStart(null)}
          >
            Use the suggested start
          </button>
        )}

        <fieldset className="race-setup__group">
          <legend className="race-setup__legend">Distance</legend>
          <div className="race-setup__options">
            {RACE_DISTANCE_ORDER.map((option) => (
              <button
                key={option}
                type="button"
                className="race-setup__option"
                aria-pressed={distance === option}
                onClick={() => setDistance(option)}
              >
                {DISTANCE_PROFILES[option].label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="race-setup__group">
          <legend className="race-setup__legend">Where you are</legend>
          <ul className="race-setup__levels">
            {RUNNER_LEVEL_ORDER.map((option) => (
              <li key={option}>
                <button
                  type="button"
                  className="race-setup__level"
                  aria-pressed={level === option}
                  onClick={() => setLevel(option)}
                >
                  <span className="race-setup__level-name">
                    {RUNNER_LEVEL_LABEL[option]}
                  </span>
                  <span className="race-setup__level-blurb">
                    {RUNNER_LEVEL_BLURB[option]}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>

        {validDate && !isPast && startDate && (
          <div className="race-setup__preview">
            <p className="race-setup__summary">
              {`${weeks} ${weeks === 1 ? "week" : "weeks"}, ${formatDateLabel(startDate)} to ${formatDateLabel(date)}: `}
              {`${profile.levels[level].runsPerWeek} runs a week, building to a `}
              {`${reachableLong}-mile long run and ${biggestWeek} miles in the `}
              {`biggest week, then a ${profile.taperWeeks}-week taper.`}
            </p>

            {startsLater && !chosenStart && (
              <p className="race-setup__kept">
                {`The race is further out than a ${profile.label.toLowerCase()} plan needs, so training starts ${formatDateLabel(startDate)} rather than now.`}
              </p>
            )}

            {startsInThePast && (
              <p className="race-setup__kept">
                {`This plan begins before today, so its first weeks are already behind you.`}
              </p>
            )}

            {isTight && (
              <p className="race-setup__warning">
                <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  {`A ${profile.label.toLowerCase()} usually wants at least ${profile.minWeeks} weeks. This plan will be built anyway — it is your race — but ${
                    shortOfPeak
                      ? `in ${weeks} it can only climb to a ${reachableLong}-mile long run, not the ${profile.levels[level].peakLongMiles} the distance asks for. It will not build the mileage that race needs.`
                      : "there is no room in it for anything to go wrong."
                  }`}
                </span>
              </p>
            )}

            {/*
              Rebuilding at a level with less speed work than the plan already
              has is a real loss, and it used to happen without a word.
            */}
            {dropsQuality && (
              <p className="race-setup__warning">
                <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  {`Your plan has ${existingQuality} hard ${existingQuality === 1 ? "session" : "sessions"} in it — `}
                  {[
                    existing.intervals > 0
                      ? `${existing.intervals} interval`
                      : null,
                    existing.simulation > 0
                      ? `${existing.simulation} race pace`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" and ")}
                  {`. A ${RUNNER_LEVEL_LABEL[level].toLowerCase()} plan has ${keeps === 0 ? "none" : "no race-pace runs"}, so rebuilding replaces ${keeps === 0 ? "them" : "those"} with easy running.`}
                </span>
              </p>
            )}

            {recorded > 0 && (
              <p className="race-setup__kept">
                {`Your ${recorded} recorded ${recorded === 1 ? "run keeps its miles and its block" : "runs keep their miles and their blocks"}. Any that no longer match a scheduled workout become extra runs.`}
              </p>
            )}
          </div>
        )}

        <div className="race-setup__actions">
          <Button disabled={!canGenerate} onClick={generate}>
            {setup ? "Rebuild Plan" : "Build Plan"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
