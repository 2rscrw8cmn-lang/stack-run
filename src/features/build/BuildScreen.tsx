import { useState } from "react";
import { selectBuildViewModel } from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import type { RunLog, TrainingPlan } from "../../domain/types";
import { WorkoutDetailSheet } from "../workout-detail/WorkoutDetailSheet";
import { BuildLegend } from "./BuildLegend";
import { BuildMetrics } from "./BuildMetrics";
import { BuildStructure } from "./BuildStructure";

interface BuildScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
}

export function BuildScreen({
  plan,
  runLogs,
  today = todayLocalDate(),
}: BuildScreenProps) {
  const [selectedWorkoutId, setSelectedWorkoutId] = useState<string | null>(
    null,
  );

  const viewModel = selectBuildViewModel(plan, runLogs, today);
  const selectedBlock =
    viewModel.weeks
      .flatMap((week) => week.blocks)
      .find((block) => block.workout.id === selectedWorkoutId) ?? null;

  return (
    <div className="build-screen">
      <h1 className="screen-title">Build</h1>
      <BuildMetrics metrics={viewModel.metrics} />
      <BuildStructure
        weeks={viewModel.weeks}
        onSelectWorkout={setSelectedWorkoutId}
      />
      <BuildLegend />
      {selectedBlock && (
        <WorkoutDetailSheet
          workout={selectedBlock.workout}
          state={selectedBlock.state}
          runLog={selectedBlock.runLog}
          isOpen
          onClose={() => setSelectedWorkoutId(null)}
        />
      )}
    </div>
  );
}
