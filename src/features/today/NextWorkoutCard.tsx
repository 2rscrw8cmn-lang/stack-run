import { CalendarClock } from "lucide-react";
import type { CSSProperties } from "react";
import { ActivityIcon } from "../../components/shared/ActivityIcon";
import { AssistantAdjustmentBadge } from "../../components/shared/AssistantAdjustmentBadge";
import { Section } from "../../components/ui/Section";
import { WORKOUT_TYPE_LABEL } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import type { WorkoutProvenanceSlot } from "../../domain/planProvenance";
import type { Workout } from "../../domain/types";

interface NextWorkoutCardProps {
  workout: Workout;
  /** #182: absent when there's nothing to show — no ledger, no match, or overridden since. */
  provenance?: WorkoutProvenanceSlot | null;
}

/**
 * What the runner intended to do next.
 *
 * This is where the plan belongs naturally on a decision surface: not as a
 * second workout card competing with today's, but as one compact line of
 * upcoming intent, subordinate to everything above it. It is omitted entirely
 * when the plan has nothing left to ask for, and it never invents a suggestion
 * of its own.
 */
export function NextWorkoutCard({ workout, provenance }: NextWorkoutCardProps) {
  return (
    <Section
      className="next-workout"
      icon={<CalendarClock size={15} strokeWidth={2} />}
      title="Up next"
    >
      <div className="next-workout__row">
        <span
          className="next-workout__color"
          style={
            { "--piece-color": `var(--${workout.build.colorKey})` } as CSSProperties
          }
          aria-hidden="true"
        />
        <div className="next-workout__detail">
          <p className="next-workout__title">
            <ActivityIcon type={workout.type} size={16} />
            {workout.title}
          </p>
          <p className="next-workout__meta">
            {formatDateLabel(workout.date, {
              weekday: "long",
              month: "short",
              day: "numeric",
            })}{" "}
            · {WORKOUT_TYPE_LABEL[workout.type]}
            {workout.targetDistanceMiles
              ? ` · ${workout.targetDistanceMiles} mi`
              : ""}
          </p>
        </div>
        {provenance && (
          <AssistantAdjustmentBadge
            className="next-workout__provenance"
            workout={workout}
            provenance={provenance.value}
            canUndo={provenance.canUndo}
            onUndo={provenance.onUndo}
          />
        )}
      </div>
    </Section>
  );
}
