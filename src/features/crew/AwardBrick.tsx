import type { CSSProperties, ReactNode } from "react";
import type { CrewAwardType } from "../../crew/awards.js";
import "./awardBlock.css";

/**
 * Monoline award icon set (OUC Half v1): 24x24 viewBox, stroke = currentColor
 * so each type's `--award-mark` (set in awardBlock.css) colors it. The Steady
 * triangle keeps a miter join on its own path — round would blunt its point.
 */
const AWARD_ICON_CONTENT: Record<CrewAwardType, ReactNode> = {
  miles: (
    <>
      <path d="M3 8 h18 M3 16 h18" />
      <path d="M3 12 h2.5 M8 12 h2.5 M13 12 h2.5 M18 12 h3" />
    </>
  ),
  zone2: (
    <>
      <path d="M12 20 C 4 13 4.5 6.5 9 7.6 C 10.8 8 12 9.6 12 9.6 C 12 9.6 13.2 8 15 7.6 C 19.5 6.5 20 13 12 20 Z" />
      <path d="M6.5 13 h3.3 l1.1 -3 l2.2 6 l1.1 -3 h3.3" />
    </>
  ),
  pace: (
    <>
      <circle cx="12" cy="14" r="7" />
      <path d="M9.5 3.5 h5 M12 3.5 v3" />
      <path d="M18.6 8.4 l1.5 -1.5" />
      <path d="M12 14 L12 9.5 M12 14 L15.5 15" />
    </>
  ),
  runs: (
    <>
      <rect x="2.6" y="7.5" width="18.8" height="9" rx="4.5" />
      <rect x="6.2" y="10.7" width="11.6" height="2.6" rx="1.3" />
    </>
  ),
  longHaul: (
    <>
      <path d="M3 12 h18" />
      <path d="M3 8 v8 M21 8 v8" />
      <path d="M6.2 9.6 L3.6 12 L6.2 14.4 M17.8 9.6 L20.4 12 L17.8 14.4" />
    </>
  ),
  steady: (
    <>
      <path d="M12 3 L18.5 20 L5.5 20 Z" strokeLinejoin="miter" strokeMiterlimit={10} />
      <path d="M5.5 20 h13" />
      <path d="M12 20 v-10" />
      <rect x="10.3" y="10" width="3.4" height="2.6" rx="0.6" fill="currentColor" stroke="none" />
    </>
  ),
  onTarget: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  levelUp: (
    <>
      <rect x="3.5" y="14" width="4" height="6" rx="1" />
      <rect x="10" y="10.5" width="4" height="9.5" rx="1" />
      <rect x="16.5" y="7" width="4" height="13" rx="1" />
      <path d="M15.5 5.5 L18.5 2.5 L21.5 5.5 M18.5 2.5 v3.5" />
    </>
  ),
};

/** Exported so the award detail sheet can show the same glyph at hero size. */
export function AwardGlyph({ type }: { type: CrewAwardType }) {
  return (
    <svg
      className="award-brick__glyph"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {AWARD_ICON_CONTENT[type]}
    </svg>
  );
}

interface AwardBrickProps {
  awardType: CrewAwardType;
  /**
   * CSS custom property reference for the runner who earned it, e.g.
   * `"var(--member-sky)"` — the same value a run block of theirs would use.
   */
  pieceColor: string;
  topFace: readonly boolean[];
  rightFace: readonly boolean[];
}

/**
 * A zero-mile Crew award: the same 3D face-set as a run brick, hollowed out.
 *
 * The frame is the runner's colour, exactly as a run block of theirs would be,
 * so ownership is read the same way everywhere in the tower and needs no
 * second runner mark on the face. The opening is a recess, and the award's own
 * glyph is suspended in it in the award's own colour — so the block answers
 * "whose" and "which award" on two independent channels (D-080).
 */
export function AwardBrick({
  awardType,
  pieceColor,
  topFace,
  rightFace,
}: AwardBrickProps) {
  return (
    <span
      className="placed-block__brick award-brick"
      data-award={awardType}
      aria-hidden="true"
      style={{ "--piece-color": pieceColor } as CSSProperties}
    >
      <span className="placed-block__face placed-block__face--front award-brick__front">
        <span className="award-brick__window">
          <AwardGlyph type={awardType} />
        </span>
      </span>
      {topFace.map((visible, column) =>
        visible ? (
          <span
            key={`top-${column}`}
            className="placed-block__face placed-block__face--top"
            style={{
              "--face-offset": column,
              "--face-cells": topFace.length,
            } as CSSProperties}
          />
        ) : null,
      )}
      {rightFace.map((visible, row) =>
        visible ? (
          <span
            key={`right-${row}`}
            className="placed-block__face placed-block__face--right"
            style={{
              "--face-offset": row,
              "--face-cells": rightFace.length,
            } as CSSProperties}
          />
        ) : null,
      )}
    </span>
  );
}
