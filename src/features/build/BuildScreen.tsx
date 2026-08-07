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
import { BlockDetailSheet } from "./BlockDetailSheet";
import { BuildLegend } from "./BuildLegend";
import { BuildMetrics } from "./BuildMetrics";
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
  placingRunLogId = null,
  onPlacingChange = () => undefined,
  today = todayLocalDate(),
}: BuildScreenProps) {
  const [candidateColumn, setCandidateColumn] = useState<string | null>(null);
  const [detailRunLogId, setDetailRunLogId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
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
        blocks={viewModel.blocks}
        courses={viewModel.courses}
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
      <BuildLegend />

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
          isOpen={isDetailOpen}
          onClose={() => {
            setDetailOpen(false);
            setDetailRunLogId(null);
          }}
        />
      )}
    </div>
  );
}
