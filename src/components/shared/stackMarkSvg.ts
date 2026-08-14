/** One course of the STACK mark, in its 24-unit box. */
export interface StackMarkBar {
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  color: string;
}

/**
 * The three-bar STACK mark: one geometry for the React mark, the server-
 * rendered SVG and the rasterised Crew invite share image.
 */
export const STACK_MARK_BARS: readonly StackMarkBar[] = [
  { x: 2, y: 15, width: 20, height: 5.5, radius: 2, color: "#7ddc3a" },
  { x: 4.5, y: 8.75, width: 15, height: 5.5, radius: 2, color: "#ba5cff" },
  { x: 7, y: 2.5, width: 10, height: 5.5, radius: 2, color: "#ffd34d" },
];

/** The mark's own bounds inside that box, so it can be placed exactly. */
export const STACK_MARK_BOUNDS = { x: 2, y: 2.5, width: 20, height: 18 };

export function stackMarkSvgMarkup(): string {
  return STACK_MARK_BARS.map(
    (bar) =>
      `<rect x="${bar.x}" y="${bar.y}" width="${bar.width}" height="${bar.height}" rx="${bar.radius}" fill="${bar.color}"/>`,
  ).join("");
}
