import { Blocks, ChevronRight } from "lucide-react";
import type { CSSProperties } from "react";
import { Section } from "../../components/ui/Section";
import type { EarnedBlock, PlacedBlock } from "../../domain/build";

interface BuildPreviewProps {
  blocks: PlacedBlock[];
  pendingBlocks: EarnedBlock[];
  onViewBuild: () => void;
}

/** How many of the newest blocks the crop shows. */
const CROP_SIZE = 6;

/**
 * A crop of the tower, not a second Build screen.
 *
 * The last few blocks in the colours and widths they were placed at, so Today
 * ends on what the running built. It says one thing — *my work is
 * accumulating* — and everything else belongs behind `View Build`.
 *
 * NEXT-4 tightened it rather than changing it: the count, the crop, the pending
 * blocks and the way in are all still here, but what was three stacked rows is
 * now two, with the blocks waiting to be placed stated on the same line as the
 * way to go and place them. No Build domain logic is touched — placement,
 * ownership, determinism and which runs earn blocks at all remain NEXT-6's.
 */
export function BuildPreview({
  blocks,
  pendingBlocks,
  onViewBuild,
}: BuildPreviewProps) {
  const crop = blocks.slice(-CROP_SIZE);

  return (
    <Section
      className="build-preview"
      icon={<Blocks size={15} strokeWidth={2} />}
      title="Your Build"
      meta={
        <p className="build-preview__count machine-label">
          {blocks.length} {blocks.length === 1 ? "block" : "blocks"} built
        </p>
      }
    >
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

      <div className="build-preview__footer">
        <p className="build-preview__pending">
          {pendingBlocks.length > 0
            ? `${pendingBlocks.length} ready to place`
            : blocks.length === 0
              ? "Log a run to earn your first block"
              : "Nothing waiting to be placed"}
        </p>

        <button type="button" className="section__link" onClick={onViewBuild}>
          View Build
          <ChevronRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>
      </div>
    </Section>
  );
}
