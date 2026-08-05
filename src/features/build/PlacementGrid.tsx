import { Plus } from "lucide-react";
import type { CSSProperties } from "react";
import type { BlockSpan } from "../../domain/build";
import type { PlacementOption } from "../../domain/placement";
import { WEEK_COLUMNS } from "../../domain/placement";
export interface ExistingBlock {
  workoutId: string;
  colorKey: string;
  row: number;
  columnStart: number;
  span: number;
}

export interface PreviewPosition {
  row: number;
  columnStart: number;
}

interface PlacementGridProps {
  weekNumber: number;
  span: BlockSpan;
  blockLabel: string;
  blockColorKey: string;
  existing: ExistingBlock[];
  options: PlacementOption[];
  preview: PreviewPosition | null;
  onPreviewChange: (preview: PreviewPosition | null) => void;
  onSelect: (option: PlacementOption) => void;
}

function columnPhrase(option: PlacementOption): string {
  return option.columnStart === option.columnEnd
    ? `column ${option.columnStart}`
    : `columns ${option.columnStart} through ${option.columnEnd}`;
}

/**
 * One training week's band of courses, five columns wide, ground course at the
 * bottom. Blocks already built into the week are drawn in place; every column
 * the earned block could start at is a button, so only valid choices are in the
 * tab order. Focusing or hovering a choice previews the full width of the
 * block, because the button is one column wide while the block may be four.
 */
export function PlacementGrid({
  weekNumber,
  span,
  blockLabel,
  blockColorKey,
  existing,
  options,
  preview,
  onPreviewChange,
  onSelect,
}: PlacementGridProps) {
  const columns = Array.from({ length: WEEK_COLUMNS }, (_, index) => index + 1);
  const rowCount = Math.max(
    1,
    ...existing.map((block) => block.row + 1),
    ...options.map((option) => option.row + 1),
  );
  // Courses read bottom-up on screen, so the highest row renders first.
  const rows = Array.from({ length: rowCount }, (_, index) => index).reverse();

  return (
    <div
      className="placement-grid"
      role="group"
      aria-label={`Week ${weekNumber} courses`}
    >
      {rows.map((row) => (
        <div key={row} className="placement-grid__course">
          {columns.map((column) => (
            <span
              key={`cell-${column}`}
              className="placement-grid__cell"
              style={{ gridColumn: column }}
              aria-hidden="true"
            />
          ))}

          {existing
            .filter((block) => block.row === row)
            .map((block) => (
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

          {preview?.row === row && (
            <span
              className="placement-grid__preview"
              style={
                {
                  gridColumn: `${preview.columnStart} / span ${span}`,
                  "--piece-color": `var(--${blockColorKey})`,
                } as CSSProperties
              }
              aria-hidden="true"
            />
          )}

          {options
            .filter((option) => option.row === row)
            .map((option) => (
              <button
                key={option.columnStart}
                type="button"
                className="placement-grid__option"
                style={{ gridColumn: option.columnStart }}
                onClick={() => onSelect(option)}
                onFocus={() =>
                  onPreviewChange({ row, columnStart: option.columnStart })
                }
                onBlur={() => onPreviewChange(null)}
                onMouseEnter={() =>
                  onPreviewChange({ row, columnStart: option.columnStart })
                }
                onMouseLeave={() => onPreviewChange(null)}
              >
                <span className="visually-hidden">
                  {`Place ${blockLabel} block in Week ${weekNumber}, course ${row + 1}, ${columnPhrase(option)}`}
                </span>
                <Plus size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            ))}
        </div>
      ))}
    </div>
  );
}
