import type { CSSProperties } from "react";

interface MiniBarsProps {
  values: readonly (number | null)[];
  tone?: "accent" | "long" | "intervals";
}

/** Compact factual columns for a Training Signal card. Card copy is authoritative. */
export function MiniBars({ values, tone = "accent" }: MiniBarsProps) {
  const visibleValues = values.filter((value): value is number => value !== null && value > 0);
  if (visibleValues.length === 0) return null;
  const peak = Math.max(...visibleValues, 1);

  return (
    <span
      className={`mini-bars mini-chart mini-chart--${tone}`}
      data-points={Math.min(visibleValues.length, 4)}
      aria-hidden="true"
    >
      {visibleValues.map((value, index) => (
        <i
          key={index}
          style={{ "--mini-value": `${Math.max((value / peak) * 100, 8)}%` } as CSSProperties}
        />
      ))}
    </span>
  );
}

interface MiniSparklineProps {
  values: readonly number[];
  invert?: boolean;
}

/** A crisp, unsmoothed recent-value line. Lower pace values can be plotted higher. */
export function MiniSparkline({ values, invert = false }: MiniSparklineProps) {
  if (values.length === 0) return null;
  const width = 148;
  const height = 42;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high - low || 1;
  const points = values.map((value, index) => {
    const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
    const ratio = (value - low) / span;
    const y = 5 + (invert ? ratio : 1 - ratio) * (height - 10);
    return `${x},${y}`;
  });

  return (
    <span className="mini-sparkline mini-chart" aria-hidden="true">
      <svg viewBox={`0 0 ${width} ${height}`} focusable="false">
        <line x1="0" x2={width} y1={height - 1} y2={height - 1} />
        {values.length > 1 ? (
          <polyline points={points.join(" ")} />
        ) : (
          <rect className="mini-sparkline__single" x={width * 0.39} y={height / 2 - 5} width={width * 0.22} height="10" />
        )}
      </svg>
    </span>
  );
}

interface MiniDonutProps {
  segments: Array<{ value: number; color: string }>;
}

const MINI_RADIUS = 17;
const MINI_CIRCUMFERENCE = 2 * Math.PI * MINI_RADIUS;

/** Small composition ring used only where the card text states the result. */
export function MiniDonut({ segments }: MiniDonutProps) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) return null;
  const arcs = segments.reduce<Array<{ color: string; length: number; offset: number; index: number }>>(
    (result, segment, index) => {
      if (segment.value <= 0) return result;
      const length = (segment.value / total) * MINI_CIRCUMFERENCE;
      const offset = result.reduce((sum, arc) => sum + arc.length, 0);
      return [...result, { color: segment.color, length, offset, index }];
    },
    [],
  );

  return (
    <span className="mini-donut mini-chart" aria-hidden="true">
      <svg viewBox="0 0 44 44" focusable="false">
        <circle className="mini-donut__track" cx="22" cy="22" r={MINI_RADIUS} />
        {arcs.map((arc) => (
          <circle
            key={arc.index}
            className="mini-donut__arc"
            cx="22"
            cy="22"
            r={MINI_RADIUS}
            pathLength={MINI_CIRCUMFERENCE}
            style={{
              "--mini-color": arc.color,
              "--mini-dash": `${arc.length} ${MINI_CIRCUMFERENCE - arc.length}`,
              "--mini-offset": `${-arc.offset}`,
            } as CSSProperties}
          />
        ))}
      </svg>
    </span>
  );
}

export function MiniMatrix({ completed, due }: { completed: number; due: number }) {
  const count = Math.min(Math.max(due, 1), 16);
  const scaledCompleted = due > count ? Math.round((completed / due) * count) : completed;
  return (
    <span className="mini-matrix mini-chart" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <i key={index} data-complete={index < scaledCompleted ? "true" : "false"} />
      ))}
    </span>
  );
}
