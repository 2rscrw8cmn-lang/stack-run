import type { BuildWeek } from "../../domain/build";
import { StackBlock } from "./StackBlock";

interface BuildWeekRowProps {
  week: BuildWeek;
  onSelectWorkout: (workoutId: string) => void;
}

export function BuildWeekRow({ week, onSelectWorkout }: BuildWeekRowProps) {
  return (
    <li
      className="build-week-row"
      // Alternating bond course; CSS shifts the two by a quarter unit each way.
      data-bond={week.weekNumber % 2 === 0 ? "b" : "a"}
      aria-label={`Week ${week.weekNumber}`}
    >
      <span className="build-week-row__number" aria-hidden="true">
        {week.weekNumber}
      </span>
      <div className="build-week-row__blocks">
        {week.blocks.map((block) => (
          <StackBlock
            key={block.workout.id}
            workout={block.workout}
            span={block.span}
            state={block.state}
            isNewest={block.isNewest}
            onSelect={onSelectWorkout}
          />
        ))}
      </div>
    </li>
  );
}
