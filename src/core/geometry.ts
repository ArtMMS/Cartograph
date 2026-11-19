import type { Stroke } from './stroke';

/** Distance from point (px, py) to the segment (ax, ay)–(bx, by). */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay);

  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Distance from a point to the edge of a stroke (0 or less = on top of it). */
export function distanceToStroke(stroke: Stroke, x: number, y: number): number {
  const points = stroke.points;
  if (points.length === 0) return Infinity;

  let min = Math.hypot(x - points[0][0], y - points[0][1]);
  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    min = Math.min(min, distanceToSegment(x, y, ax, ay, bx, by));
  }
  return min - stroke.size / 2;
}

/** Top-most stroke within `tolerance` (world units) of the point, or null. */
export function findStrokeAt(
  strokes: readonly Stroke[],
  x: number,
  y: number,
  tolerance: number,
): Stroke | null {
  for (let i = strokes.length - 1; i >= 0; i--) {
    if (distanceToStroke(strokes[i], x, y) <= tolerance) return strokes[i];
  }
  return null;
}
