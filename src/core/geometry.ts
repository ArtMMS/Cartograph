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

  // Filled areas: clicking anywhere inside counts.
  if (stroke.style === 'area' && points.length >= 3) {
    const outline = points.map((p) => [p[0], p[1]] as [number, number]);
    if (pointInPolygon(x, y, outline)) return 0;
  }

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

// ---------- Polygons (regions) ----------

export type Point = [number, number];

/** Polygon area (always positive). */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Center of mass of a polygon (falls back to the average point for tiny shapes). */
export function polygonCentroid(points: readonly Point[]): Point {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    const cross = x1 * y2 - x2 * y1;
    area += cross;
    cx += (x1 + x2) * cross;
    cy += (y1 + y2) * cross;
  }
  if (Math.abs(area) < 1e-9) {
    const n = points.length || 1;
    return [
      points.reduce((s, p) => s + p[0], 0) / n,
      points.reduce((s, p) => s + p[1], 0) / n,
    ];
  }
  return [cx / (3 * area), cy / (3 * area)];
}

/** True if the point is inside the polygon (ray casting). */
export function pointInPolygon(x: number, y: number, points: readonly Point[]): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Removes points that barely change the shape (Ramer–Douglas–Peucker). */
export function simplifyPath(points: readonly Point[], tolerance: number): Point[] {
  if (points.length <= 2) return [...points];

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length > 0) {
    const [start, end] = stack.pop()!;
    let maxDist = 0;
    let index = -1;
    for (let i = start + 1; i < end; i++) {
      const d = distanceToSegment(
        points[i][0],
        points[i][1],
        points[start][0],
        points[start][1],
        points[end][0],
        points[end][1],
      );
      if (d > maxDist) {
        maxDist = d;
        index = i;
      }
    }
    if (index !== -1 && maxDist > tolerance) {
      keep[index] = true;
      stack.push([start, index], [index, end]);
    }
  }

  return points.filter((_, i) => keep[i]);
}

/** Smooth closed SVG path through the points (quadratic curves between midpoints). */
export function smoothClosedPath(points: readonly Point[]): string {
  const n = points.length;
  if (n < 3) return '';
  const mid = (a: Point, b: Point): string =>
    `${((a[0] + b[0]) / 2).toFixed(2)},${((a[1] + b[1]) / 2).toFixed(2)}`;

  let d = `M${mid(points[n - 1], points[0])}`;
  for (let i = 0; i < n; i++) {
    const p = points[i];
    const next = points[(i + 1) % n];
    d += ` Q${p[0].toFixed(2)},${p[1].toFixed(2)} ${mid(p, next)}`;
  }
  return d + ' Z';
}

/** Length of a polyline. */
export function pathLength(points: readonly Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i][0] - points[i - 1][0], points[i][1] - points[i - 1][1]);
  }
  return total;
}
