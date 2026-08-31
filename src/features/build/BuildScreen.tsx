import { useEffect, useState } from "react";
import {
  earnedBlocks,
  findPlacementForRunLog,
  selectBuildViewModel,
  WORKOUT_TYPE_LABEL,
} from "../../domain/build.js";
import { todayLocalDate } from "../../domain/dates.js";
import { formatMiles } from "../../domain/distance.js";
import {
  autoPlaceOption,
  placementOptions,
  type PlacementOption,
} from "../../domain/placement.js";
import { columnPhrase } from "../../domain/towerGeometry.js";
import {
  isRotated,
  type PlacedHeight,
  type PlacedWidth,
} from "../../domain/footprint.js";
import type {
  ArchivedTrainingPlan,
  BlockPlacement,
  RunLog,
  TrainingPlan,
} from "../../domain/types.js";
import type { IntervalsConnection } from "../../connected/intervals.js";
import { CompleteRunSheet } from "../run-entry/CompleteRunSheet.js";
import type { ValidRunEntry } from "../run-entry/runValidation.js";
import { BlockDetailSheet } from "./BlockDetailSheet.js";
import { BuildHeading } from "./BuildHeading.js";
import { BuiltStructure } from "./BuiltStructure.js";
import { PendingBlocksTray } from "./PendingBlocksTray.js";
import { describeCandidate } from "./describeCandidate.js";
import { rotationTick } from "./haptics.js";
import { PlacementBar } from "./PlacementBar.js";
import { PlacementContext } from "./PlacementContext.js";
import {
  blockIdentity,
  handCanRotate,
  handFootprint,
  placementHint,
  resolveHand,
} from "./placementHand.js";

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
  /**
   * The footprint as placed, which is the earned one or the earned one turned
   * (issue #204). Height reaches 4 only for a 4-wide block stood on end.
   */
  width: PlacedWidth;
  height: PlacedHeight;
}

interface BuildScreenProps {
  plan: TrainingPlan | null;
  planHistory?: readonly ArchivedTrainingPlan[];
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
  syncToken?: IntervalsConnection | string | null;
}

export function BuildScreen({
  plan,
  planHistory = [],
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
  /**
   * Whether the block in hand stands turned from the way it was earned. Held
   * here rather than derived, because it is a choice the runner is part-way
   * through making — it becomes storage only when the block is dropped, and
   * cancelling placement must leave nothing behind.
   */
  const [rotated, setRotated] = useState(false);
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

  const viewModel = selectBuildViewModel(
    plan,
    runLogs,
    blockPlacements,
    today,
    planHistory,
  );
  const allEarned = earnedBlocks(plan, runLogs, planHistory);

  const placingBlock =
    allEarned.find((block) => block.runLog.id === placingRunLogId) ?? null;

  // A block being moved does not block its own new position.
  const others = placingBlock
    ? blockPlacements.filter(
        (placement) => placement.runLogId !== placingBlock.runLog.id,
      )
    : blockPlacements;
  // The footprint as currently turned, which is what the tower is asked for
  // landings of — rotation changes the grid footprint, not just the artwork.
  const inHand = placingBlock
    ? handFootprint(placingBlock.footprint, rotated)
    : null;
  const options =
    placingBlock && inHand
      ? placementOptions(inHand.width, inHand.height, others)
      : [];

  // The chosen position is held as a key, so it survives the list of options
  // being recomputed on every render — and, after a rotation, so that a column
  // the turned block no longer fits reads as blocked rather than being
  // silently swapped for one that works.
  const hand = inHand
    ? resolveHand(options, candidateColumn, inHand)
    : null;
  const candidate = hand?.candidate ?? null;
  const candidateIndex = hand?.index ?? -1;

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
    const { runLog } = placingBlock;
    const footprint = inHand ?? placingBlock.footprint;
    const isMove =
      findPlacementForRunLog(blockPlacements, runLog.id) !== undefined;

    // The footprint as turned, not as earned: width and height *are* the
    // stored orientation, so this is the whole of persisting a rotation.
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
      message ||
        `Block moved to ${columnPhrase(
          candidate.columnStart,
          footprint.width,
        )}.`,
    );
    stopPlacing();
  }

  /**
   * Turns the block 90°, in place.
   *
   * The current column is pinned first. Without that, a block sitting where
   * the tower auto-placed it has no chosen column of its own, and turning it
   * would re-run Auto Place and land it somewhere else — which reads exactly
   * like STACK moving the block for you, the thing issue #204 rules out.
   */
  function rotate() {
    if (!placingBlock) {
      return;
    }
    if (candidate) {
      setCandidateColumn(String(candidate.columnStart));
    }
    setRotated((current) => !current);
    rotationTick();
  }

  function startPlacing(runLogId: string) {
    // A block already in the tower comes back up turned the way it was left.
    const existing = findPlacementForRunLog(blockPlacements, runLogId);
    const earned = allEarned.find((block) => block.runLog.id === runLogId);
    setRotated(
      existing !== undefined &&
        earned !== undefined &&
        isRotated(existing, earned.footprint),
    );
    setCandidateColumn(
      existing === undefined ? null : String(existing.columnStart),
    );
    setDetailOpen(false);
    setDetailRunLogId(null);
    onPlacingChange(runLogId);
  }

  function stopPlacing() {
    setCandidateColumn(null);
    setRotated(false);
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
        context={
          placingBlock && inHand ? (
            <PlacementContext
              label="Block in hand"
              identity={blockIdentity({
                activityType: placingBlock.runLog.activityType,
                distanceMiles: placingBlock.runLog.distanceMiles,
                date: placingBlock.runLog.completedDate,
              })}
              hint={placementHint(handCanRotate(placingBlock.footprint))}
            />
          ) : undefined
        }
        placing={
          placingBlock && inHand
            ? {
                block: placingBlock,
                footprint: inHand,
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
        {placingBlock && inHand
          ? describeCandidate(placingBlock, candidate, inHand)
          : announcement}
      </p>

      {!placingBlock && (
        <PendingBlocksTray
          blocks={viewModel.pendingBlocks}
          onPlaceBlock={startPlacing}
          onEditRun={startEditing}
        />
      )}

      {placingBlock && inHand && (
        <PlacementBar
          pieceColor={`var(--${placingBlock.runLog.activityType})`}
          title={`${
            findPlacementForRunLog(blockPlacements, placingBlock.runLog.id) !==
            undefined
              ? "Move"
              : "Place"
          } ${WORKOUT_TYPE_LABEL[placingBlock.runLog.activityType]}`}
          canDrop={candidate !== null}
          blockedReason={hand?.blockedReason ?? null}
          canStepBack={hand?.canStepBack ?? false}
          canStepForward={hand?.canStepForward ?? false}
          onStep={step}
          onRotate={
            handCanRotate(placingBlock.footprint) ? rotate : undefined
          }
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
