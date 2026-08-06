import type { CSSProperties } from "react";
import { Card } from "../../components/ui/Card";
import { LEGEND_TYPES, WORKOUT_TYPE_LABEL } from "../../domain/build";

/**
 * Colour key for the five block types. Rest earns no block, so it has no
 * entry. There are no state entries either: every block in the structure has
 * been earned and placed.
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
    </Card>
  );
}
