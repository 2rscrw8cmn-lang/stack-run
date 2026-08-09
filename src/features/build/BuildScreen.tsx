import { useState } from "react";
import {
  earnedBlocks,
  findPlacementForRunLog,
  selectBuildViewModel,
} from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import {
  autoPlaceOption,
  placementOptions,
  type PlacementOption,
} from "../../domain/placement";
import type { BlockPlacement, RunLog, TrainingPlan } from "../../domain/types";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet";
import type { ValidRunEntry } from "../run-entry/runValidation";
import { BlockDetailSheet } from "./BlockDetailSheet";
import { BuildHeading } from "./BuildHeading";
import { BuiltStructure } from "./BuiltStructure";
import { PendingBlocksTray } from "./PendingBlocksTray";
import { describeCandidate } from "./describeCandidate";
import { PlacementBar } from "./PlacementBar";

export interface PlacementRequest {
  runLogId: string;
  row: number;
  columnStart: number;
  width: 1 | 2 | 3 | 4;
  height: 1 | 2 | 3;
}

interface BuildScreenProps {
  plan: TrainingPlan;
  runLogs: RunLog[];
  blockPlacements: BlockPlacement[];
  onPlaceBlock: (request: PlacementRequest) => void;
  /**
   * Build is the only screen that lists extra runs, so it is where one gets
   * corrected or removed. Plan lists scheduled days and cannot show them.
   */
  onSaveRun?: (
    workout: null,
    values: ValidRunEntry,
    runLogId?: string,
  ) => void;
  onDeleteRun?: (runLogId: string) => void;
  /** The block the user came here to place, if any. */
  placingRunLogId?: string | null;
  onPlacingChange?: (runLogId: string | null) => void;
  /** Defaults to the real local date; overridable so tests don't need fake timers. */
  today?: string;
}

export function BuildScreen({
  plan,
  runLogs,
  blockPlacements,
  onPlaceBlock,
  onSaveRun = () => undefined,
  onDeleteRun = () => undefined,
  placingRunLogId = null,
  onPlacingChange = () => undefined,
  today = todayLocalDate(),
}: BuildScreenProps) {
  const [candidateColumn, setCandidateColumn] = useState<string | null>(null);
  const [detailRunLogId, setDetailRunLogId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [editRunLogId, setEditRunLogId] = useState<string | null>(null);
  const [isEditOpen, setEditOpen] = useState(false);
  const [editVisit, setEditVisit] = useState(0);
  const [announcement, setAnnouncement] = useState("");

  const viewModel = selectBuildViewModel(plan, runLogs, blockPlacements, today);
  const allEarned = earnedBlocks(plan, runLogs);

  const placingBlock =
    allEarned.find((block) => block.runLog.id === placingRunLogId) ?? null;

  // A block being moved does not block its own new position.
  const others = placingBlock
    ? blockPlacements.filter(
        (placement) => placement.runLogId !== placingBlock.runLog.id,
      )
    : blockPlacements;
  const options = placingBlock
    ? placementOptions(
        placingBlock.footprint.width,
        placingBlock.footprint.height,
        others,
      )
    : [];

  // The chosen position is held as a key, so it survives the list of options
  // being recomputed on every render.
  const candidate =
    options.find(
      (option) => String(option.columnStart) === candidateColumn,
    ) ??
    autoPlaceOption(options) ??
    null;
  const candidateIndex = candidate
    ? options.findIndex(
        (option) => option.columnStart === candidate.columnStart,
      )
    : -1;

  const detailBlock =
    viewModel.blocks.find((block) => block.runLog.id === detailRunLogId) ?? null;
  const editing =
    allEarned.find((block) => block.runLog.id === editRunLogId) ?? null;

  function choose(option: PlacementOption) {
    setCandidateColumn(String(option.columnStart));
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
      runLogId: placingBlock.runLog.id,
      row: candidate.row,
      columnStart: candidate.columnStart,
      width: placingBlock.footprint.width,
      height: placingBlock.footprint.height,
    });
    setAnnouncement(
      `Block dropped down column ${candidate.columnStart}, landing on course ${candidate.row}.`,
    );
    stopPlacing();
  }

  function startPlacing(runLogId: string) {
    setCandidateColumn(null);
    setDetailOpen(false);
    setDetailRunLogId(null);
    onPlacingChange(runLogId);
  }

  function stopPlacing() {
    setCandidateColumn(null);
    onPlacingChange(null);
  }

  function startEditing(runLogId: string) {
    setDetailOpen(false);
    setEditRunLogId(runLogId);
    setEditVisit((visit) => visit + 1);
    setEditOpen(true);
  }

  return (
    <div className="build-screen" data-placing={placingBlock ? "true" : undefined}>
      <BuildHeading metrics={viewModel.metrics} />
      {!placingBlock && (
        <PendingBlocksTray
          blocks={viewModel.pendingBlocks}
          onPlaceBlock={startPlacing}
          onEditRun={startEditing}
        />
      )}
      <BuiltStructure
        blocks={viewModel.blocks}
        courses={viewModel.courses}
        voids={viewModel.voids}
        onSelectBlock={(runLogId) => {
          setDetailRunLogId(runLogId);
          setDetailOpen(true);
        }}
        placing={
          placingBlock
            ? { block: placingBlock, options, candidate, onChoose: choose }
            : undefined
        }
      />

      <p className="visually-hidden" aria-live="polite">
        {placingBlock ? describeCandidate(placingBlock, candidate) : announcement}
      </p>

      {placingBlock && (
        <PlacementBar
          block={placingBlock}
          isMove={
            findPlacementForRunLog(blockPlacements, placingBlock.runLog.id) !==
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
        <BlockDetailSheet
          block={detailBlock}
          onMoveBlock={
            detailBlock.canMove
              ? () => startPlacing(detailBlock.runLog.id)
              : undefined
          }
          onEditRun={() => startEditing(detailBlock.runLog.id)}
          isOpen={isDetailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailRunLogId(null);
          }}
        />
      )}

      {editing && (
        <CompleteRunSheet
          key={editVisit}
          isOpen={isEditOpen}
          // Editing here never changes which workout a run satisfied; it
          // corrects what was recorded, or removes the run altogether.
          workout={null}
          runLog={editing.runLog}
          today={today}
          onClose={() => {
            setEditOpen(false);
            setEditRunLogId(null);
          }}
          onDelete={() => {
            onDeleteRun(editing.runLog.id);
            setAnnouncement("Run deleted. Its block came out of the tower.");
            setEditOpen(false);
          }}
          onSave={(_workout, values) => {
            onSaveRun(null, values, editing.runLog.id);
            setAnnouncement("Run updated.");
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
