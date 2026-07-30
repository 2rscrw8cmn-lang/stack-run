import type { CSSProperties } from "react";
import { useState } from "react";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";
import {
  autoPlaceOption,
  placementOptions,
  placementsForWeek,
} from "../../domain/placement";
import type { BlockPlacement, TrainingPlan } from "../../domain/types";
import { PlacementGrid, type ExistingBlock } from "./PlacementGrid";

export interface PlacementRequest {
  workoutId: string;
  weekNumber: number;
  columnStart: number;
  span: 1 | 2 | 3 | 4;
}

interface PlaceBlockSheetProps {
  block: EarnedBlock;
  plan: TrainingPlan;
  placements: BlockPlacement[];
  /** True when repositioning a block that is already in the course. */
  isMove?: boolean;
  isOpen: boolean;
  onClose: () => void;
  onPlace: (request: PlacementRequest) => void;
}

export function PlaceBlockSheet({
  block,
  plan,
  placements,
  isMove = false,
  isOpen,
  onClose,
  onPlace,
}: PlaceBlockSheetProps) {
  const [previewColumn, setPreviewColumn] = useState<number | null>(null);

  const weekNumber = block.workout.weekNumber;
  const workoutsById = new Map(
    plan.weeks.flatMap((week) => week.workouts).map((workout) => [workout.id, workout]),
  );

  // The block being moved does not block its own new position.
  const weekPlacements = placementsForWeek(placements, weekNumber).filter(
    (placement) => placement.workoutId !== block.workout.id,
  );
  const belowPlacements = placementsForWeek(placements, weekNumber - 1);
  const options = placementOptions(
    block.span,
    weekPlacements,
    belowPlacements,
    weekNumber === plan.weeks[0].weekNumber,
  );
  const automatic = autoPlaceOption(options);

  const existing: ExistingBlock[] = weekPlacements.flatMap((placement) => {
    const workout = workoutsById.get(placement.workoutId);
    return workout
      ? [
          {
            workoutId: placement.workoutId,
            label: WORKOUT_TYPE_LABEL[workout.type],
            colorKey: workout.build.colorKey,
            columnStart: placement.columnStart,
            span: placement.span,
          },
        ]
      : [];
  });

  function place(columnStart: number) {
    setPreviewColumn(null);
    onPlace({
      workoutId: block.workout.id,
      weekNumber,
      columnStart,
      span: block.span,
    });
  }

  return (
    <Sheet title={isMove ? "Move Block" : "Place Block"} isOpen={isOpen} onClose={onClose}>
      <div className="place-block">
        <p className="place-block__lede">Choose where to place your block.</p>

        <div className="place-block__week">
          <p className="place-block__week-label">Week {weekNumber}</p>
          <PlacementGrid
            weekNumber={weekNumber}
            span={block.span}
            blockLabel={WORKOUT_TYPE_LABEL[block.workout.type]}
            blockColorKey={block.workout.build.colorKey}
            existing={existing}
            options={options}
            previewColumn={previewColumn}
            onPreviewChange={setPreviewColumn}
            onSelect={place}
          />
          {options.length === 0 && (
            <p className="place-block__empty" role="alert">
              Week {weekNumber} has no room left for this block.
            </p>
          )}
        </div>

        <div className="place-block__staging">
          <p className="place-block__staging-label">Your block</p>
          <div className="place-block__staging-row">
            <span
              className="place-block__chip"
              style={
                {
                  "--piece-color": `var(--${block.workout.build.colorKey})`,
                  "--piece-span": block.span,
                } as CSSProperties
              }
              aria-hidden="true"
            />
            <div>
              <p className="place-block__chip-type">
                {WORKOUT_TYPE_LABEL[block.workout.type]}
              </p>
              <p className="place-block__chip-detail">
                {formatDateLabel(block.workout.date)} ·{" "}
                {block.runLog.distanceMiles} mi
              </p>
            </div>
          </div>
        </div>

        <div className="place-block__actions">
          <Button
            onClick={() => automatic && place(automatic.columnStart)}
            disabled={automatic === null}
          >
            Auto Place
          </Button>
          <p className="place-block__hint">Let STACK place it for you.</p>
        </div>
      </div>
    </Sheet>
  );
}
