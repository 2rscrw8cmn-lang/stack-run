import { Button } from "../../components/ui/Button.js";
import { Sheet } from "../../components/ui/Sheet.js";
import { WORKOUT_TYPE_LABEL } from "../../domain/build.js";
import { formatDateLabel } from "../../domain/dates.js";
import type { AvailabilityConflict } from "../../domain/availability.js";

interface ConflictReviewSheetProps {
  conflicts: AvailabilityConflict[];
  isOpen: boolean;
  onClose: () => void;
  /** Applies one proposed move. The user accepts them one at a time. */
  onMove: (workoutId: string, toDate: string) => void;
}

/**
 * The runs that land on days the user cannot run, each with somewhere to go.
 *
 * Every move is proposed and accepted, never applied. Sliding an easy run a
 * day is nothing; moving a long run reshapes a week, and only the runner knows
 * which they meant. The app does the noticing and the arithmetic; the decision
 * stays where it belongs.
 */
export function ConflictReviewSheet({
  conflicts,
  isOpen,
  onClose,
  onMove,
}: ConflictReviewSheetProps) {
  return (
    <Sheet title="Blocked Days" isOpen={isOpen} onClose={onClose}>
      <div className="conflicts">
        {conflicts.length === 0 ? (
          <p className="conflicts__empty">
            Nothing on the plan lands on a blocked day.
          </p>
        ) : (
          <>
            <p className="conflicts__lede">
              {`${conflicts.length} ${conflicts.length === 1 ? "run lands" : "runs land"} on a day you cannot run. Move the ones you want moved.`}
            </p>

            <ul className="conflicts__list">
              {conflicts.map((conflict) => (
                <li key={conflict.workout.id} className="conflicts__item">
                  <p className="conflicts__title">{conflict.workout.title}</p>
                  <p className="conflicts__meta">
                    {formatDateLabel(conflict.workout.date, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {WORKOUT_TYPE_LABEL[conflict.workout.type]} ·{" "}
                    {conflict.labels.join(", ")}
                  </p>

                  {conflict.proposedDate ? (
                    <Button
                      variant="secondary"
                      onClick={() =>
                        onMove(conflict.workout.id, conflict.proposedDate!)
                      }
                    >
                      {`Move to ${formatDateLabel(conflict.proposedDate, {
                        weekday: "long",
                        month: "short",
                        day: "numeric",
                      })}`}
                    </Button>
                  ) : (
                    <p className="conflicts__stuck">
                      No free day left in this week. Move it yourself from the
                      workout, or leave it where it is.
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  );
}
