import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { FormField } from "../../components/ui/FormField";
import { Sheet } from "../../components/ui/Sheet";
import { formatDateLabel } from "../../domain/dates";
import {
  DISTANCE_PROFILES,
  generateTrainingPlan,
  plannedWeeks,
  planStartDate,
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
  const [level, setLevel] = useState<RunnerLevel>(setup?.level ?? "novice");

  const profile = DISTANCE_PROFILES[distance];
  const validDate = ISO_DATE.test(date);
  const available = validDate ? weeksAvailable(today, date) : 0;
  const weeks = validDate ? plannedWeeks(distance, today, date) : 0;
  const startDate = validDate ? planStartDate(distance, today, date) : "";
  // A race further out than the template stretches starts later than today.
  const startsLater = validDate && startDate > today;
  const isPast = validDate && available < 1;
  const isTight = !isPast && weeks < profile.minWeeks;
  const canGenerate = validDate && !isPast && name.trim().length > 0;

  // Every recorded run survives a rebuild, scheduled or extra, so the count
  // that matters here is all of them.
  const recorded = runLogs.length;

  function generate() {
    const chosen: RacePlanSetup = {
      name: name.trim(),
      date,
      distance,
      level,
    };
    onGenerate(
      chosen,
      generateTrainingPlan(chosen, { today, runDays: runDays ?? undefined }),
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

        {validDate && !isPast && (
          <div className="race-setup__preview">
            <p className="race-setup__summary">
              {`${weeks} ${weeks === 1 ? "week" : "weeks"}, ${formatDateLabel(startDate)} to ${formatDateLabel(date)}: `}
              {`${profile.levels[level].runsPerWeek} runs a week, building to a `}
              {`${profile.levels[level].peakLongMiles}-mile long run, then a `}
              {`${profile.taperWeeks}-week taper.`}
            </p>

            {startsLater && (
              <p className="race-setup__kept">
                {`The race is further out than a ${profile.label.toLowerCase()} plan needs, so training starts ${formatDateLabel(startDate)} rather than now.`}
              </p>
            )}

            {isTight && (
              <p className="race-setup__warning">
                <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  {`A ${profile.label.toLowerCase()} usually wants at least ${profile.minWeeks} weeks. This plan will be built anyway — it is your race — but it starts closer to the peak than it should.`}
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
