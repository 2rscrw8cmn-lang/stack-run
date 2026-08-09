import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { formatDateLabel } from "../../domain/dates";
import {
  currentRunDays,
  EVERY_DAY,
  planRunDayChange,
  WEEKDAY_NAMES,
  WEEKDAY_ORDER,
  type Weekday,
} from "../../domain/runDays";
import type { RunLog, TrainingPlan } from "../../domain/types";

interface RunDaysSheetProps {
  plan: TrainingPlan;
  /** The saved preference, or null while the runner has not said. */
  runDays: Weekday[] | null;
  runLogs: RunLog[];
  today: string;
  /** Days an imported calendar rules out, so a move does not land on one. */
  blocked: ReadonlySet<string>;
  isOpen: boolean;
  onClose: () => void;
  onApply: (runDays: Weekday[]) => void;
}

/**
 * Which days of the week the runner runs, applied to the whole plan at once.
 *
 * The plan arrives with a shape, and that shape is a suggestion about spacing
 * rather than a fact about anybody's life. Somebody who never runs on Sundays
 * should not have to move eighteen Sundays by hand.
 *
 * What it will do is shown before it does it, including the weeks it cannot
 * help — a week with four runs and three permitted days has nowhere to put the
 * fourth, and saying so is more use than quietly leaving it where it was.
 */
export function RunDaysSheet({
  plan,
  runDays,
  runLogs,
  today,
  blocked,
  isOpen,
  onClose,
  onApply,
}: RunDaysSheetProps) {
  /**
   * Every day, until the runner says otherwise.
   *
   * Not the days the plan happens to use: those are two different facts, and
   * conflating them makes the obvious gesture useless. "I don't run Sundays"
   * starting from Tue/Thu/Sat/Sun leaves three days for four runs and answers
   * "17 runs have nowhere to go" — true, and no help at all. Starting from the
   * whole week, it answers "17 runs move", which is what was meant.
   */
  const [chosen, setChosen] = useState<Weekday[]>(runDays ?? EVERY_DAY);
  const shape = currentRunDays(plan);

  const change = planRunDayChange(plan, chosen, { today, blocked, runLogs });
  const nothingChosen = chosen.length === 0;

  function toggle(day: Weekday) {
    setChosen((current) =>
      current.includes(day)
        ? current.filter((item) => item !== day)
        : [...current, day],
    );
  }

  return (
    <Sheet title="Run Days" isOpen={isOpen} onClose={onClose}>
      <div className="run-days">
        <p className="run-days__lede">
          The days you are willing to run. STACK moves runs off the other days,
          keeping each one inside its own training week.
        </p>

        <p className="run-days__shape">
          Your plan currently runs{" "}
          {shape.map((day) => WEEKDAY_NAMES[day].slice(0, 3)).join(", ")}.
        </p>

        <fieldset className="run-days__picker">
          <legend className="visually-hidden">Days you can run</legend>
          {WEEKDAY_ORDER.map((day) => (
            <button
              key={day}
              type="button"
              className="run-days__day"
              aria-pressed={chosen.includes(day)}
              onClick={() => toggle(day)}
            >
              <span aria-hidden="true">{WEEKDAY_NAMES[day].slice(0, 3)}</span>
              <span className="visually-hidden">{WEEKDAY_NAMES[day]}</span>
            </button>
          ))}
        </fieldset>

        {nothingChosen ? (
          <p className="run-days__summary">
            Pick at least one day. A plan with no run days is not a plan.
          </p>
        ) : change.moves.length === 0 && change.stuck.length === 0 ? (
          <p className="run-days__summary">
            The plan already fits. Nothing to move.
          </p>
        ) : (
          <>
            <p className="run-days__summary">
              {change.moves.length === 0
                ? "No run can move."
                : `${change.moves.length} ${
                    change.moves.length === 1 ? "run moves" : "runs move"
                  }. Race day never moves, and neither does anything already run.`}
            </p>

            {change.moves.length > 0 && (
              <ol className="run-days__moves">
                {change.moves.slice(0, 4).map(({ workout, toDate }) => (
                  <li key={workout.id}>
                    {formatDateLabel(workout.date, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                    {" → "}
                    {formatDateLabel(toDate!, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </li>
                ))}
                {change.moves.length > 4 && (
                  <li className="run-days__more">
                    and {change.moves.length - 4} more
                  </li>
                )}
              </ol>
            )}

            {change.stuck.length > 0 && (
              <p className="run-days__stuck">
                <TriangleAlert size={16} strokeWidth={2} aria-hidden="true" />
                <span>
                  {`${change.stuck.length} ${
                    change.stuck.length === 1 ? "run has" : "runs have"
                  } nowhere to go and will stay where ${
                    change.stuck.length === 1 ? "it is" : "they are"
                  }: those weeks ask for more runs than the days you picked.`}
                </span>
              </p>
            )}
          </>
        )}

        <div className="run-days__actions">
          <Button
            disabled={nothingChosen || change.moves.length === 0}
            onClick={() => onApply(chosen)}
          >
            {change.moves.length > 0
              ? `Move ${change.moves.length} ${
                  change.moves.length === 1 ? "Run" : "Runs"
                }`
              : "Apply to Plan"}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
