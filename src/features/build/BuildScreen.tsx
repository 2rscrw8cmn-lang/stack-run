import { useState } from "react";
import {
  earnedBlocks,
  findPlacementForWorkout,
  selectBuildViewModel,
} from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import type { BlockPlacement, RunLog, TrainingPlan } from "../../domain/types";
import { WorkoutDetailSheet } from "../workout-detail/WorkoutDetailSheet";
import { BuildLegend } from "./BuildLegend";
import { BuildMetrics } from "./BuildMetrics";
import { BuiltStructure } from "./BuiltStructure";
import { PendingBlocksTray } from "./PendingBlocksTray";
import { PlaceBlockSheet, type PlacementRequest } from "./PlaceBlockSheet";

interface BuildScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  onPlaceBlock: (request: PlacementRequest) => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
}

export function BuildScreen({
  plan,
  runLogs,
  blockPlacements,
  onPlaceBlock,
  today = todayLocalDate(),
}: BuildScreenProps) {
  const [placingWorkoutId, setPlacingWorkoutId] = useState<string | null>(null);
  const [detailWorkoutId, setDetailWorkoutId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const viewModel = selectBuildViewModel(plan, runLogs, blockPlacements, today);
  const allEarned = earnedBlocks(plan, runLogs);

  const placingBlock =
    allEarned.find((block) => block.workout.id === placingWorkoutId) ?? null;
  const detailBlock =
    viewModel.courses
      .flatMap((course) => course.blocks)
      .find((block) => block.workout.id === detailWorkoutId) ?? null;
  const detailRunLog = detailBlock
    ? (runLogs.find((runLog) => runLog.workoutId === detailBlock.workout.id) ??
      null)
    : null;
  // Repositioning is only offered while the block's own week is still running.
  const canMoveDetailBlock =
    detailBlock !== null &&
    detailBlock.workout.weekNumber === viewModel.activeWeekNumber;

  function handlePlace(request: PlacementRequest) {
    onPlaceBlock(request);
    setPlacingWorkoutId(null);
    setDetailWorkoutId(null);
    setAnnouncement(
      `Block placed in week ${request.weekNumber}, course ${request.row + 1}, column ${request.columnStart}.`,
    );
  }

  return (
    <div className="build-screen">
      <h1 className="screen-title">Build</h1>
      <BuildMetrics metrics={viewModel.metrics} />
      <PendingBlocksTray
        blocks={viewModel.pendingBlocks}
        onPlaceBlock={setPlacingWorkoutId}
      />
      <BuiltStructure
        courses={viewModel.courses}
        nextCourseWeekNumber={viewModel.nextCourseWeekNumber}
        onSelectWorkout={setDetailWorkoutId}
      />
      <BuildLegend />

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      {detailBlock && (
        <WorkoutDetailSheet
          workout={detailBlock.workout}
          state="completed"
          runLog={detailRunLog}
          placement={detailBlock.placement}
          onMoveBlock={
            canMoveDetailBlock
              ? () => {
                  setDetailWorkoutId(null);
                  setPlacingWorkoutId(detailBlock.workout.id);
                }
              : undefined
          }
          isOpen
          onClose={() => setDetailWorkoutId(null)}
        />
      )}

      {placingBlock && (
        <PlaceBlockSheet
          block={placingBlock}
          plan={plan}
          placements={blockPlacements}
          isMove={
            findPlacementForWorkout(blockPlacements, placingBlock.workout.id) !==
            undefined
          }
          isOpen
          onClose={() => setPlacingWorkoutId(null)}
          onPlace={handlePlace}
        />
      )}
    </div>
  );
}
