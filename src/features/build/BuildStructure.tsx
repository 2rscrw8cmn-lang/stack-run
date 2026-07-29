import type { BuildWeek } from "../../domain/build";
import { BuildWeekRow } from "./BuildWeekRow";

interface BuildStructureProps {
  weeks: BuildWeek[];
  onSelectWorkout: (workoutId: string) => void;
}

/** One centered row per training week, week 1 first. */
export function BuildStructure({
  weeks,
  onSelectWorkout,
}: BuildStructureProps) {
  return (
    <ol className="build-structure" aria-label="Training weeks">
      {weeks.map((week) => (
        <BuildWeekRow
          key={week.weekNumber}
          week={week}
          onSelectWorkout={onSelectWorkout}
        />
      ))}
    </ol>
  );
}
