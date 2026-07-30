import { Plus } from "lucide-react";
import type { CSSProperties } from "react";
import type { BlockSpan } from "../../domain/build";
import type { PlacementOption } from "../../domain/placement";
import { WEEK_COLUMNS } from "../../domain/placement";

export interface ExistingBlock {
  workoutId: string;
  label: string;
  colorKey: string;
  columnStart: number;
  span: number;
}

interface PlacementGridProps {
  weekNumber: number;
  span: BlockSpan;
  blockLabel: string;
  blockColorKey: string;
  existing: ExistingBlock[];
  options: PlacementOption[];
  previewColumn: number | null;
  onPreviewChange: (columnStart: number | null) => void;
  onSelect: (columnStart: number) => void;
}

function columnPhrase(option: PlacementOption): string {
  return option.columnStart === option.columnEnd
    ? `column ${option.columnStart}`
    : `columns ${option.columnStart} through ${option.columnEnd}`;
}

/**
 * One training week as eight columns. Blocks already built into the week are
 * drawn in place; each column the earned block could start at is a button, so
 * only valid choices are in the tab order. Focusing or hovering a choice
 * previews the full width of the block, because the button itself is one
 * column wide while the block may be up to four.
 */
export function PlacementGrid({
  weekNumber,
  span,
  blockLabel,
  blockColorKey,
  existing,
  options,
  previewColumn,
  onPreviewChange,
  onSelect,
}: PlacementGridProps) {
  const columns = Array.from({ length: WEEK_COLUMNS }, (_, index) => index + 1);

  return (
    <div
      className="placement-grid"
      role="group"
      aria-label={`Week ${weekNumber} course`}
    >
      {columns.map((column) => (
        <span
          key={`cell-${column}`}
          className="placement-grid__cell"
          style={{ gridColumn: column }}
          aria-hidden="true"
        />
      ))}

      {existing.map((block) => (
        <span
          key={block.workoutId}
          className="placement-grid__placed"
          style={
            {
              gridColumn: `${block.columnStart} / span ${block.span}`,
              "--piece-color": `var(--${block.colorKey})`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      ))}

      {previewColumn !== null && (
        <span
          className="placement-grid__preview"
          style={
            {
              gridColumn: `${previewColumn} / span ${span}`,
              "--piece-color": `var(--${blockColorKey})`,
            } as CSSProperties
          }
          aria-hidden="true"
        />
      )}

      {options.map((option) => (
        <button
          key={option.columnStart}
          type="button"
          className="placement-grid__option"
          style={{ gridColumn: option.columnStart }}
          onClick={() => onSelect(option.columnStart)}
          onFocus={() => onPreviewChange(option.columnStart)}
          onBlur={() => onPreviewChange(null)}
          onMouseEnter={() => onPreviewChange(option.columnStart)}
          onMouseLeave={() => onPreviewChange(null)}
        >
          <span className="visually-hidden">
            {`Place ${blockLabel} block in Week ${weekNumber}, ${columnPhrase(option)}`}
          </span>
          <Plus size={16} strokeWidth={2} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
