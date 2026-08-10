import { useEffect, useState } from "react";
import {
  earnedBlocks,
  findPlacementForRunLog,
  selectBuildViewModel,
} from "../../domain/build";
import { todayLocalDate } from "../../domain/dates";
import { formatMiles } from "../../domain/distance";
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

/**
 * How long the placement confirmation stays on screen before the tower is
 * quiet again. The settle and the glow are CSS and last well under half a
 * second; this is only the sentence beside them, which needs long enough to
 * be read and short enough that it never becomes part of the furniture.
 */
const PAYOFF_MS = 2600;

/** The block this session just committed, and what to say about it. */
interface Payoff {
  runLogId: string;
  /** Empty when a block was moved rather than newly built: nothing was added. */
  message: string;
}

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
  syncToken?: string | null;
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
  syncToken,
}: BuildScreenProps) {
  const [candidateColumn, setCandidateColumn] = useState<string | null>(null);
  const [detailRunLogId, setDetailRunLogId] = useState<string | null>(null);
  const [isDetailOpen, setDetailOpen] = useState(false);
  const [editRunLogId, setEditRunLogId] = useState<string | null>(null);
  const [isEditOpen, setEditOpen] = useState(false);
  const [editVisit, setEditVisit] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [payoff, setPayoff] = useState<Payoff | null>(null);

  // The payoff is presentation and nothing else: it is held here, never in
  // AppState, and it expires on its own whether or not the user is looking.
  useEffect(() => {
    if (!payoff) {
      return;
    }
    const timer = setTimeout(() => setPayoff(null), PAYOFF_MS);
    return () => clearTimeout(timer);
  }, [payoff]);

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

  /**
   * Commits the chosen candidate — from `Drop`, from the keyboard, or from
   * letting go after a deliberate drag. The request carries the exact option
   * the placement domain produced, so every path writes a position the packer
   * would have chosen itself.
   */
  function drop() {
    if (!placingBlock || !candidate) {
      return;
    }
    const { runLog, footprint } = placingBlock;
    const isMove =
      findPlacementForRunLog(blockPlacements, runLog.id) !== undefined;

    onPlaceBlock({
      runLogId: runLog.id,
      row: candidate.row,
      columnStart: candidate.columnStart,
      width: footprint.width,
      height: footprint.height,
    });

    // The run was logged before its block could be placed, so the total the
    // heading already shows is the total this block completes.
    const added = formatMiles(runLog.distanceMiles);
    const message = isMove
      ? ""
      : `${added} ${runLog.distanceMiles === 1 ? "mile" : "miles"} added · ${viewModel.metrics.totalActualMiles} miles built`;

    setPayoff({ runLogId: runLog.id, message });
    setAnnouncement(
      message || `Block moved to column ${candidate.columnStart}.`,
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

      {/*
        The tower comes before everything the screen says about it. Blocks
        waiting to be placed used to sit above it and, with a backlog, pushed
        the object itself off the fold — which is the dashboard-first order
        D-045 rejected.
      */}
      <BuiltStructure
        blocks={viewModel.blocks}
        courses={viewModel.courses}
        voids={viewModel.voids}
        justPlacedRunLogId={payoff?.runLogId ?? null}
        onSelectBlock={(runLogId) => {
          setDetailRunLogId(runLogId);
          setDetailOpen(true);
        }}
        placing={
          placingBlock
            ? {
                block: placingBlock,
                options,
                candidate,
                onChoose: choose,
                onCommit: drop,
              }
            : undefined
        }
      />

      {payoff?.message && (
        // The live region below carries the same sentence, so this is the
        // sighted half of one announcement rather than a second one.
        <p className="build-payoff" aria-hidden="true">
          {payoff.message}
        </p>
      )}

      <p className="visually-hidden" aria-live="polite">
        {placingBlock ? describeCandidate(placingBlock, candidate) : announcement}
      </p>

      {!placingBlock && (
        <PendingBlocksTray
          blocks={viewModel.pendingBlocks}
          onPlaceBlock={startPlacing}
          onEditRun={startEditing}
        />
      )}

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
          syncToken={syncToken}
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
