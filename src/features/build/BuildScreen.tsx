import { useState } from "react";
import {
  earnedBlocks,
  findPlacementForWorkout,
  selectBuildViewModel,
} from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import {
  autoPlaceOption,
  placementOptions,
  type PlacementOption,
} from "../../domain/placement";
import type { BlockPlacement, RunLog, TrainingPlan } from "../../domain/types";
import { WorkoutDetailSheet } from "../workout-detail/WorkoutDetailSheet";
import { BuildLegend } from "./BuildLegend";
import { BuildMetrics } from "./BuildMetrics";
import { BuiltStructure } from "./BuiltStructure";
import { PendingBlocksTray } from "./PendingBlocksTray";
import { describeCandidate } from "./describeCandidate";
import { PlacementBar } from "./PlacementBar";

export interface PlacementRequest {
  workoutId: string;
  weekNumber: number;
  row: number;
  columnStart: number;
  span: 1 | 2 | 3 | 4;
}

interface BuildScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  onPlaceBlock: (request: PlacementRequest) => void;
  /** The block the user came here to place, if any. */
  placingWorkoutId?: string | null;
  onPlacingChange?: (workoutId: string | null) => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
}

export function BuildScreen({
  plan,
  runLogs,
  blockPlacements,
  onPlaceBlock,
  placingWorkoutId = null,
  onPlacingChange = () => undefined,
  today = todayLocalDate(),
}: BuildScreenProps) {
  const [candidateColumn, setCandidateColumn] = useState<string | null>(null);
  const [detailWorkoutId, setDetailWorkoutId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");

  const viewModel = selectBuildViewModel(plan, runLogs, blockPlacements, today);
  const allEarned = earnedBlocks(plan, runLogs);

  const placingBlock =
    allEarned.find((block) => block.workout.id === placingWorkoutId) ?? null;

  // A block being moved does not block its own new position.
  const others = placingBlock
    ? blockPlacements.filter(
        (placement) => placement.workoutId !== placingBlock.workout.id,
      )
    : blockPlacements;
  const options = placingBlock
    ? placementOptions(placingBlock.span, placingBlock.workout.weekNumber, others)
    : [];

  // The chosen position is held as a key, so it survives the list of options
  // being recomputed on every render.
  const candidate =
    options.find(
      (option) => `${option.row}:${option.columnStart}` === candidateColumn,
    ) ??
    autoPlaceOption(options) ??
    null;
  const candidateIndex = candidate
    ? options.findIndex(
        (option) =>
          option.row === candidate.row &&
          option.columnStart === candidate.columnStart,
      )
    : -1;

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

  function choose(option: PlacementOption) {
    setCandidateColumn(`${option.row}:${option.columnStart}`);
  }

  function step(direction: -1 | 1) {
    const next = options[candidateIndex + direction];
    if (next) {
      choose(next);
    }
  }

  function drop() {
    if (!placingBlock || !candidate) {
      return;
    }
    onPlaceBlock({
      workoutId: placingBlock.workout.id,
      weekNumber: candidate.weekNumber,
      row: candidate.row,
      columnStart: candidate.columnStart,
      span: placingBlock.span,
    });
    setAnnouncement(
      `Block dropped into week ${candidate.weekNumber}, course ${candidate.row + 1}, column ${candidate.columnStart}.`,
    );
    stopPlacing();
  }

  function startPlacing(workoutId: string) {
    setCandidateColumn(null);
    setDetailWorkoutId(null);
    onPlacingChange(workoutId);
  }

  function stopPlacing() {
    setCandidateColumn(null);
    onPlacingChange(null);
  }

  return (
    <div className="build-screen" data-placing={placingBlock ? "true" : undefined}>
      <h1 className="screen-title">Build</h1>
      <BuildMetrics metrics={viewModel.metrics} />
      {!placingBlock && (
        <PendingBlocksTray
          blocks={viewModel.pendingBlocks}
          onPlaceBlock={startPlacing}
        />
      )}
      <BuiltStructure
        courses={viewModel.courses}
        nextCourseWeekNumber={viewModel.nextCourseWeekNumber}
        projectedCourses={viewModel.projectedCourses}
        phaseBands={viewModel.phaseBands}
        onSelectWorkout={setDetailWorkoutId}
        placing={
          placingBlock
            ? { block: placingBlock, options, candidate, onChoose: choose }
            : undefined
        }
      />
      <BuildLegend />

      <p className="visually-hidden" aria-live="polite">
        {placingBlock ? describeCandidate(placingBlock, candidate) : announcement}
      </p>

      {placingBlock && (
        <PlacementBar
          block={placingBlock}
          isMove={
            findPlacementForWorkout(blockPlacements, placingBlock.workout.id) !==
            undefined
          }
          candidate={candidate}
          canStepBack={candidateIndex > 0}
          canStepForward={
            candidateIndex >= 0 && candidateIndex < options.length - 1
          }
          onStep={step}
          onAutoPlace={() => {
            const automatic = autoPlaceOption(options);
            if (automatic) {
              choose(automatic);
            }
          }}
          onDrop={drop}
          onCancel={stopPlacing}
        />
      )}

      {detailBlock && (
        <WorkoutDetailSheet
          workout={detailBlock.workout}
          state="completed"
          runLog={detailRunLog}
          placement={detailBlock.placement}
          onMoveBlock={
            canMoveDetailBlock
              ? () => startPlacing(detailBlock.workout.id)
              : undefined
          }
          isOpen
          onClose={() => setDetailWorkoutId(null)}
        />
      )}
    </div>
  );
}
