/**
 * The vector half of the invite-card renderer: SVG path data in, plain
 * polygons out.
 *
 * Everything the card draws — the crew's emblem, the STACK mark, every glyph —
 * arrives as SVG path data, because that is the form the app already stores it
 * in. Rasterising it means flattening curves to line segments and turning
 * strokes into fillable outlines, both of which are pure arithmetic and both of
 * which belong here rather than in the rasteriser.
 *
 * Only the path grammar this repository actually writes is supported:
 * `M/L/H/V/Q/C/Z` and their relative forms. An unknown command is ignored
 * rather than thrown, so an emblem shape added by a later library still draws
 * whatever of itself this renderer understands.
 */

export interface Point {
  x: number;
  y: number;
}

/** A closed ring of already-flattened points, in device pixels. */
export type Polygon = Point[];

/**
 * Axis-aligned placement of a drawing's own coordinates onto the canvas.
 *
 * Scale and translation are all the card needs — the emblem is placed by its
 * view box and glyphs by their em square, and nothing rotates — so this stays
 * a four-number transform instead of a full matrix.
 */
export interface Placement {
  scaleX: number;
  scaleY: number;
  x: number;
  y: number;
}

export const IDENTITY: Placement = { scaleX: 1, scaleY: 1, x: 0, y: 0 };

export function place(placement: Placement, x: number, y: number): Point {
  return { x: placement.x + x * placement.scaleX, y: placement.y + y * placement.scaleY };
}

/** Nests a drawing's own offset inside an outer placement. */
export function translated(placement: Placement, dx: number, dy: number): Placement {
  return {
    ...placement,
    x: placement.x + dx * placement.scaleX,
    y: placement.y + dy * placement.scaleY,
  };
}

interface PathCommand {
  type: string;
  values: number[];
}

const COMMAND_PATTERN = /([MmLlHhVvQqCcZz])([^MmLlHhVvQqCcZz]*)/g;
const NUMBER_PATTERN = /-?\d*\.?\d+(?:e[-+]?\d+)?/gi;

function readCommands(d: string): PathCommand[] {
  const commands: PathCommand[] = [];
  for (const match of d.matchAll(COMMAND_PATTERN)) {
    commands.push({
      type: match[1],
      values: (match[2].match(NUMBER_PATTERN) ?? []).map(Number),
    });
  }
  return commands;
}

/**
 * How finely a curve is broken up.
 *
 * The step count follows the control polygon's length in device pixels, so a
 * 40 px glyph curve costs a handful of segments and the same curve blown up to
 * a 300 px emblem gets enough of them to stay smooth.
 */
function curveSteps(points: Point[]): number {
  let length = 0;
  for (let index = 1; index < points.length; index += 1) {
    length += Math.hypot(points[index].x - points[index - 1].x, points[index].y - points[index - 1].y);
  }
  return Math.max(3, Math.min(64, Math.ceil(length / 2.5)));
}

function quadratic(from: Point, control: Point, to: Point, into: Point[]): void {
  const steps = curveSteps([from, control, to]);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const inverse = 1 - t;
    into.push({
      x: inverse * inverse * from.x + 2 * inverse * t * control.x + t * t * to.x,
      y: inverse * inverse * from.y + 2 * inverse * t * control.y + t * t * to.y,
    });
  }
}

function cubic(from: Point, first: Point, second: Point, to: Point, into: Point[]): void {
  const steps = curveSteps([from, first, second, to]);
  for (let step = 1; step <= steps; step += 1) {
    const t = step / steps;
    const inverse = 1 - t;
    into.push({
      x:
        inverse ** 3 * from.x +
        3 * inverse ** 2 * t * first.x +
        3 * inverse * t ** 2 * second.x +
        t ** 3 * to.x,
      y:
        inverse ** 3 * from.y +
        3 * inverse ** 2 * t * first.y +
        3 * inverse * t ** 2 * second.y +
        t ** 3 * to.y,
    });
  }
}

export interface Contour {
  points: Point[];
  closed: boolean;
}

/** Flattens path data into device-space contours under a placement. */
export function flattenPath(d: string, placement: Placement = IDENTITY): Contour[] {
  const contours: Contour[] = [];
  let current: Point[] = [];
  let closed = false;
  // Path arithmetic happens in the path's own units; only finished points are
  // placed, so curve flattening still measures itself in device pixels.
  let cursor: Point = { x: 0, y: 0 };
  let startedAt: Point = { x: 0, y: 0 };

  const flush = (): void => {
    if (current.length > 1) contours.push({ points: current, closed });
    current = [];
    closed = false;
  };
  const moveTo = (point: Point): void => {
    flush();
    cursor = point;
    startedAt = point;
    current = [place(placement, point.x, point.y)];
  };
  const lineTo = (point: Point): void => {
    cursor = point;
    current.push(place(placement, point.x, point.y));
  };

  for (const command of readCommands(d)) {
    const { values } = command;
    const relative = command.type === command.type.toLowerCase();
    const base = (): Point => (relative ? cursor : { x: 0, y: 0 });
    switch (command.type.toUpperCase()) {
      case "M": {
        for (let index = 0; index + 1 < values.length; index += 2) {
          const from = base();
          const point = { x: from.x + values[index], y: from.y + values[index + 1] };
          if (index === 0) moveTo(point);
          else lineTo(point);
        }
        break;
      }
      case "L": {
        for (let index = 0; index + 1 < values.length; index += 2) {
          const from = base();
          lineTo({ x: from.x + values[index], y: from.y + values[index + 1] });
        }
        break;
      }
      case "H": {
        for (const value of values) lineTo({ x: base().x + value, y: cursor.y });
        break;
      }
      case "V": {
        for (const value of values) lineTo({ x: cursor.x, y: base().y + value });
        break;
      }
      case "Q": {
        for (let index = 0; index + 3 < values.length; index += 4) {
          const from = base();
          const control = { x: from.x + values[index], y: from.y + values[index + 1] };
          const to = { x: from.x + values[index + 2], y: from.y + values[index + 3] };
          quadratic(
            place(placement, cursor.x, cursor.y),
            place(placement, control.x, control.y),
            place(placement, to.x, to.y),
            current,
          );
          cursor = to;
        }
        break;
      }
      case "C": {
        for (let index = 0; index + 5 < values.length; index += 6) {
          const from = base();
          const first = { x: from.x + values[index], y: from.y + values[index + 1] };
          const second = { x: from.x + values[index + 2], y: from.y + values[index + 3] };
          const to = { x: from.x + values[index + 4], y: from.y + values[index + 5] };
          cubic(
            place(placement, cursor.x, cursor.y),
            place(placement, first.x, first.y),
            place(placement, second.x, second.y),
            place(placement, to.x, to.y),
            current,
          );
          cursor = to;
        }
        break;
      }
      case "Z": {
        closed = true;
        flush();
        cursor = startedAt;
        current = [place(placement, cursor.x, cursor.y)];
        break;
      }
      default:
        break;
    }
  }
  flush();
  return contours;
}

/** Contours as fillable polygons; an open contour fills as if it were closed. */
export function pathPolygons(d: string, placement: Placement = IDENTITY): Polygon[] {
  return flattenPath(d, placement).map((contour) => contour.points);
}

function signedArea(polygon: Polygon): number {
  let total = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const from = polygon[index];
    const to = polygon[(index + 1) % polygon.length];
    total += from.x * to.y - to.x * from.y;
  }
  return total / 2;
}

/**
 * Stroke pieces are filled as one nonzero union, and a piece wound the other
 * way would punch a hole in its neighbour instead of joining it.
 */
function sameWinding(polygon: Polygon): Polygon {
  return signedArea(polygon) < 0 ? [...polygon].reverse() : polygon;
}

export interface StrokeOptions {
  width: number;
  join?: "miter" | "round";
  cap?: "butt" | "square";
  /** SVG's default; beyond it a miter collapses to a bevel. */
  miterLimit?: number;
}

function unit(from: Point, to: Point): Point | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  return length < 1e-9 ? null : { x: dx / length, y: dy / length };
}

function roundJoin(vertex: Point, from: Point, to: Point, radius: number): Polygon {
  const start = Math.atan2(from.y - vertex.y, from.x - vertex.x);
  const end = Math.atan2(to.y - vertex.y, to.x - vertex.x);
  let sweep = end - start;
  while (sweep > Math.PI) sweep -= 2 * Math.PI;
  while (sweep < -Math.PI) sweep += 2 * Math.PI;
  const steps = Math.max(2, Math.ceil(Math.abs(sweep) / 0.35));
  const fan: Polygon = [vertex];
  for (let step = 0; step <= steps; step += 1) {
    const angle = start + (sweep * step) / steps;
    fan.push({ x: vertex.x + Math.cos(angle) * radius, y: vertex.y + Math.sin(angle) * radius });
  }
  return fan;
}

/**
 * A stroked contour as polygons: one quad per segment plus one wedge per
 * corner, filled together with the nonzero rule.
 *
 * Building the union out of overlapping pieces avoids offsetting a whole
 * outline — which needs self-intersection cleanup — and gives the same result
 * for the shapes this card draws.
 */
export function strokePolygons(contour: Contour, options: StrokeOptions): Polygon[] {
  const half = options.width / 2;
  if (half <= 0) return [];
  const points: Point[] = [];
  for (const point of contour.points) {
    const last = points[points.length - 1];
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > 1e-9) points.push(point);
  }
  if (contour.closed && points.length > 1) {
    const first = points[0];
    const last = points[points.length - 1];
    if (Math.hypot(first.x - last.x, first.y - last.y) < 1e-9) points.pop();
  }
  if (points.length < 2) return [];

  const segments: { from: Point; to: Point; direction: Point }[] = [];
  const count = contour.closed ? points.length : points.length - 1;
  for (let index = 0; index < count; index += 1) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    const direction = unit(from, to);
    if (direction) segments.push({ from, to, direction });
  }
  if (!segments.length) return [];

  const polygons: Polygon[] = [];
  const extend = options.cap === "square" ? half : 0;
  segments.forEach((segment, index) => {
    const { direction } = segment;
    const normal = { x: -direction.y * half, y: direction.x * half };
    const startExtend = !contour.closed && index === 0 ? extend : 0;
    const endExtend = !contour.closed && index === segments.length - 1 ? extend : 0;
    const from = {
      x: segment.from.x - direction.x * startExtend,
      y: segment.from.y - direction.y * startExtend,
    };
    const to = { x: segment.to.x + direction.x * endExtend, y: segment.to.y + direction.y * endExtend };
    polygons.push(
      sameWinding([
        { x: from.x + normal.x, y: from.y + normal.y },
        { x: to.x + normal.x, y: to.y + normal.y },
        { x: to.x - normal.x, y: to.y - normal.y },
        { x: from.x - normal.x, y: from.y - normal.y },
      ]),
    );
  });

  const joins = contour.closed ? segments.length : segments.length - 1;
  const limit = options.miterLimit ?? 4;
  for (let index = 0; index < joins; index += 1) {
    const incoming = segments[index];
    const outgoing = segments[(index + 1) % segments.length];
    const vertex = incoming.to;
    const cross =
      incoming.direction.x * outgoing.direction.y - incoming.direction.y * outgoing.direction.x;
    if (Math.abs(cross) < 1e-9) continue;
    // The inner side of a corner is already covered by the two quads; only the
    // notch on the outer side needs filling.
    const side = cross > 0 ? -1 : 1;
    const corner = (direction: Point): Point => ({
      x: vertex.x - direction.y * half * side,
      y: vertex.y + direction.x * half * side,
    });
    const from = corner(incoming.direction);
    const to = corner(outgoing.direction);
    if (options.join === "round") {
      polygons.push(sameWinding(roundJoin(vertex, from, to, half)));
      continue;
    }
    // Miter point: where the two offset edges would meet if extended.
    const t =
      ((to.x - from.x) * outgoing.direction.y - (to.y - from.y) * outgoing.direction.x) / cross;
    const miter = {
      x: from.x + incoming.direction.x * t,
      y: from.y + incoming.direction.y * t,
    };
    const reach = Math.hypot(miter.x - vertex.x, miter.y - vertex.y);
    polygons.push(
      sameWinding(reach / half > limit ? [vertex, from, to] : [vertex, from, miter, to]),
    );
  }
  return polygons;
}

/** Convenience for the card's own panels and rules. */
export function rectPolygon(x: number, y: number, width: number, height: number): Polygon {
  return [
    { x, y },
    { x: x + width, y },
    { x: x + width, y: y + height },
    { x, y: y + height },
  ];
}

/** The STACK mark's bars, and any other soft-cornered panel. */
export function roundedRectPolygon(
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): Polygon {
  const corner = Math.max(0, Math.min(radius, width / 2, height / 2));
  if (!corner) return rectPolygon(x, y, width, height);
  const steps = Math.max(3, Math.ceil(corner / 1.5));
  const polygon: Polygon = [];
  const arc = (centerX: number, centerY: number, from: number): void => {
    for (let step = 0; step <= steps; step += 1) {
      const angle = from + (Math.PI / 2) * (step / steps);
      polygon.push({ x: centerX + Math.cos(angle) * corner, y: centerY + Math.sin(angle) * corner });
    }
  };
  arc(x + corner, y + corner, Math.PI);
  arc(x + width - corner, y + corner, -Math.PI / 2);
  arc(x + width - corner, y + height - corner, 0);
  arc(x + corner, y + height - corner, Math.PI / 2);
  return polygon;
}
