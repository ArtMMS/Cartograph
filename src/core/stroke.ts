import { getStroke } from 'perfect-freehand';

/** A point of a stroke: [x, y, pressure] in world units. */
export type StrokePoint = [number, number, number];

export interface Stroke {
  id: string;
  points: StrokePoint[];
  color: string;
  /** Thickness in world units (1 unit = 2 km). */
  size: number;
  /** True for mouse/touch (no real pressure); false for pens. */
  simulatePressure: boolean;
}

export interface Brush {
  color: string;
  /** Thickness in world units. */
  size: number;
}

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 40;

export function createDefaultBrush(dark: boolean): Brush {
  return { color: dark ? '#e8e4da' : '#2a2a2a', size: 6 };
}

export function createStroke(brush: Brush, simulatePressure: boolean): Stroke {
  return {
    id: crypto.randomUUID(),
    points: [],
    color: brush.color,
    size: brush.size,
    simulatePressure,
  };
}

/** SVG path ("d") of the stroke outline, smoothed by perfect-freehand. */
export function getStrokePath(stroke: Stroke, finished = true): string {
  const outline = getStroke(stroke.points, {
    size: stroke.size,
    thinning: 0.4,
    smoothing: 0.5,
    streamline: 0.5,
    simulatePressure: stroke.simulatePressure,
    last: finished,
  });
  return getSvgPathFromStroke(outline);
}

/** Turns the outline points into a smooth closed SVG path (from the perfect-freehand docs). */
function getSvgPathFromStroke(points: number[][]): string {
  const len = points.length;
  if (len < 4) return '';

  const avg = (a: number, b: number): string => ((a + b) / 2).toFixed(2);

  let a = points[0];
  let b = points[1];
  const c = points[2];

  let d =
    `M${a[0].toFixed(2)},${a[1].toFixed(2)} ` +
    `Q${b[0].toFixed(2)},${b[1].toFixed(2)} ${avg(b[0], c[0])},${avg(b[1], c[1])} T`;

  for (let i = 2; i < len - 1; i++) {
    a = points[i];
    b = points[i + 1];
    d += `${avg(a[0], b[0])},${avg(a[1], b[1])} `;
  }

  return d + 'Z';
}
