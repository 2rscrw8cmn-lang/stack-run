import type { CSSProperties } from "react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import type { EarnedBlock, PlacedBlock } from "../../domain/build";

interface BuildPreviewProps {
  blocks: PlacedBlock[];
  pendingBlocks: EarnedBlock[];
  onViewBuild: () => void;
}

/** How many of the newest blocks the crop shows. */
const CROP_SIZE = 6;

/**
 * A crop of the tower, not a second Build screen: the last few blocks in the
 * colours and widths they were placed at, so Today ends on what the running
 * built. Anything more belongs behind `View Build`.
 */
export function BuildPreview({
  blocks,
  pendingBlocks,
  onViewBuild,
}: BuildPreviewProps) {
  const crop = blocks.slice(-CROP_SIZE);

  return (
    <Card className="build-preview">
      <div className="build-preview__detail">
        <p className="build-preview__count">
          {blocks.length} {blocks.length === 1 ? "block" : "blocks"} built
        </p>
        <p className="build-preview__pending">
          {pendingBlocks.length > 0
            ? `${pendingBlocks.length} ready to place`
            : blocks.length === 0
              ? "Log a run to earn your first block"
              : "Nothing waiting to be placed"}
        </p>
      </div>

      {crop.length > 0 && (
        <ul className="build-preview__crop" aria-hidden="true">
          {crop.map((block) => (
            <li
              key={block.placement.runLogId}
              className="build-preview__brick"
              style={
                {
                  "--piece-color": `var(--${block.runLog.activityType})`,
                  "--piece-span": block.placement.width,
                  "--piece-height": block.placement.height,
                } as CSSProperties
              }
            />
          ))}
        </ul>
      )}

      <Button variant="secondary" onClick={onViewBuild}>
        View Build
      </Button>
    </Card>
  );
}
