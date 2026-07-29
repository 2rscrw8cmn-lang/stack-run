import type { BuildWeek } from "../../domain/build";
import { BuildWeekRow } from "./BuildWeekRow";

interface BuildStructureProps {
  weeks: BuildWeek[];
  onSelectWorkout: (workoutId: string) => void;
}

/**
 * One centered row per training week, built upward off the ground line: week 1
 * sits at the bottom and race week at the top, so the structure grows toward
 * the race. The rows are reversed here rather than with `column-reverse` so
 * that DOM order, reading order, and focus order all match what is on screen.
 */
export function BuildStructure({
  weeks,
  onSelectWorkout,
}: BuildStructureProps) {
  return (
    <ol className="build-structure" aria-label="Training weeks">
      {[...weeks].reverse().map((week) => (
        <BuildWeekRow
          key={week.weekNumber}
          week={week}
          onSelectWorkout={onSelectWorkout}
        />
      ))}
    </ol>
  );
}
