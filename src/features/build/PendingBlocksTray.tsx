import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { WORKOUT_TYPE_LABEL, type EarnedBlock } from "../../domain/build";
import { formatDateLabel } from "../../domain/dates";

interface PendingBlocksTrayProps {
  blocks: EarnedBlock[];
  onPlaceBlock: (runLogId: string) => void;
  /** Opens the run behind a waiting block, so a mistake can be fixed. */
  onEditRun?: (runLogId: string) => void;
}

/**
 * Blocks that have been earned but not built in yet, oldest first, so placing
 * them from the top of the list builds the structure from the ground up.
 */
export function PendingBlocksTray({
  blocks,
  onPlaceBlock,
  onEditRun,
}: PendingBlocksTrayProps) {
  if (blocks.length === 0) {
    return null;
  }

  return (
    <Card className="pending-tray">
      <p className="pending-tray__title">
        Blocks Ready <span className="pending-tray__count">{blocks.length}</span>
      </p>
      <ul className="pending-tray__list" aria-label="Blocks ready to place">
        {blocks.map((block) => (
          <li key={block.runLog.id} className="pending-tray__item">
            <span
              className="pending-tray__chip"
              style={
                {
                  "--piece-color": `var(--${block.runLog.activityType})`,
                  "--piece-span": block.footprint.width,
                  "--piece-height": block.footprint.height,
                } as CSSProperties
              }
              aria-hidden="true"
            />
            <button
              type="button"
              className="pending-tray__detail"
              aria-label={`Edit ${WORKOUT_TYPE_LABEL[block.runLog.activityType]} run from ${formatDateLabel(block.runLog.completedDate)}`}
              onClick={() => onEditRun?.(block.runLog.id)}
            >
              <p className="pending-tray__type">
                {WORKOUT_TYPE_LABEL[block.runLog.activityType]}
                {!block.workout && (
                  <span className="pending-tray__extra">Extra</span>
                )}
              </p>
              <p className="pending-tray__meta">
                {formatDateLabel(block.runLog.completedDate)} ·{" "}
                {block.runLog.distanceMiles} mi
              </p>
            </button>
            <Button
              variant="secondary"
              aria-label={`Place ${WORKOUT_TYPE_LABEL[block.runLog.activityType]} block from ${formatDateLabel(block.runLog.completedDate)}`}
              onClick={() => onPlaceBlock(block.runLog.id)}
            >
              Place
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  );
}
