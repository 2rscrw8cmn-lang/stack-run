import type { CSSProperties } from "react";
import { Card } from "../../components/ui/Card";
import {
  BLOCK_STATE_LABEL,
  LEGEND_TYPES,
  WORKOUT_TYPE_LABEL,
  type BlockState,
} from "../../domain/build";

const LEGEND_STATES: BlockState[] = ["completed", "planned", "missed"];

/**
 * Colour key for the five block types, plus the fill treatments, so block
 * state never depends on colour alone. Rest days have no block and no entry.
 */
export function BuildLegend() {
  return (
    <Card className="build-legend">
      <h2 className="build-legend__title">Legend</h2>
      <ul className="build-legend__items" aria-label="Workout types">
        {LEGEND_TYPES.map((type) => (
          <li key={type} className="build-legend__item">
            <span
              className="build-legend__swatch"
              style={{ "--piece-color": `var(--${type})` } as CSSProperties}
              aria-hidden="true"
            />
            {WORKOUT_TYPE_LABEL[type]}
          </li>
        ))}
      </ul>
      <ul className="build-legend__items" aria-label="Block states">
        {LEGEND_STATES.map((state) => (
          <li key={state} className="build-legend__item">
            <span
              className="build-legend__swatch"
              data-state={state}
              aria-hidden="true"
            />
            {BLOCK_STATE_LABEL[state]}
          </li>
        ))}
      </ul>
    </Card>
  );
}
