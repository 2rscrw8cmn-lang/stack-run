import type { CSSProperties } from "react";

export interface BrickFaceLabel {
  text: string;
  unit: boolean;
}

interface BrickProps {
  /** CSS custom property reference, e.g. `"var(--easy)"` or `"var(--member-accent)"`. */
  pieceColor: string;
  label: BrickFaceLabel | null;
  /** One flag per column the block spans: true where nothing rests above it. */
  topFace: readonly boolean[];
  /** One flag per course the block stands: true where nothing abuts it. */
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
 */
export function Brick({ pieceColor, label, topFace, rightFace }: BrickProps) {
  return (
    <span
      className="placed-block__brick"
      aria-hidden="true"
      style={{ "--piece-color": pieceColor } as CSSProperties}
    >
      <span className="placed-block__face placed-block__face--front">
        {label && (
          <span className="placed-block__label">
            {label.text}
            {label.unit && <span className="placed-block__unit">MI</span>}
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
