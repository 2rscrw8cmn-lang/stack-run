import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import "./Brick.css";

export type BrickFaceLabel =
  | {
      text: string;
      unit: boolean;
      /**
       * Issue #129: a run the runner typed in by hand rather than one a source
       * synced. Manual entry is the exception, so it is marked with a single
       * asterisk after the mileage and nothing else — no icon, no badge, no
       * corner treatment. A synced brick is unchanged.
       */
      manual?: boolean;
    }
  | { icon: LucideIcon };

interface BrickProps {
  /** CSS custom property reference, e.g. `"var(--easy)"` or `"var(--member-accent)"`. */
  pieceColor: string;
  label: BrickFaceLabel | null;
  /** One flag per placement unit the block spans horizontally. */
  topFace: readonly boolean[];
  /** One flag per placement unit the block stands vertically. */
  rightFace: readonly boolean[];
}

/**
 * One 3D brick face-set: the front (with its mileage label), the top and the
 * right, each drawn only where the geometry says something isn't already
 * covering it. This is the reusable half of Personal Build's `PlacedBlock` —
 * the visual markup and CSS extracted so Crew Build's blocks render with the
 * identical construction language, just under a different colour. Crew
 * ownership is the colour and nothing else — no initial, no badge, no mark on
 * the face — so a Crew brick is as clean as a Personal one. The outer element
 * (button vs. static span,
 * data-capstone, data-just-placed, grid position) stays with each caller,
 * since that is where Personal and Crew genuinely differ.
 *
 * The face arrays already carry the placed footprint. When a text-bearing run
 * block is exactly one square unit wide and taller than one unit, #208 turns
 * the entire existing label 90° as one object instead of shrinking or stacking
 * its characters. The string itself never changes — `3.2` remains `3.2`.
 */
export function Brick({ pieceColor, label, topFace, rightFace }: BrickProps) {
  const verticalTextLabel = Boolean(
    label && "text" in label && topFace.length === 1 && rightFace.length > 1,
  );

  return (
    <span
      className="placed-block__brick"
      aria-hidden="true"
      style={{ "--piece-color": pieceColor } as CSSProperties}
    >
      <span className="placed-block__face placed-block__face--front">
        {label && (
          <span
            className={
              verticalTextLabel
                ? "placed-block__label placed-block__label--vertical"
                : "placed-block__label"
            }
          >
            {"icon" in label ? (
              <label.icon className="placed-block__icon" size={14} strokeWidth={2.5} />
            ) : (
              <>
                {label.text}
                {label.manual && <span className="placed-block__manual">*</span>}
                {label.unit && <span className="placed-block__unit">MI</span>}
              </>
            )}
          </span>
        )}
      </span>
      {/*
        One segment per grid cell along each edge, so a face stops exactly
        where a neighbour begins instead of sliding out from under it.
      */}
      {topFace.map(
        (visible, column) =>
          visible && (
            <span
              key={`top-${column}`}
              className="placed-block__face placed-block__face--top"
              style={
                {
                  "--face-offset": column,
                  "--face-cells": topFace.length,
                } as CSSProperties
              }
            />
          ),
      )}
      {rightFace.map(
        (visible, row) =>
          visible && (
            <span
              key={`right-${row}`}
              className="placed-block__face placed-block__face--right"
              style={
                {
                  "--face-offset": row,
                  "--face-cells": rightFace.length,
                } as CSSProperties
              }
            />
          ),
      )}
    </span>
  );
}
