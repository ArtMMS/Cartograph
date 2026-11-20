import { getStroke } from 'perfect-freehand';
import {
  buildAreaParts,
  buildSymbolParts,
  type DrawStyle,
  type ShapePart,
  type StrokeStyle,
} from './stroke-style';

/** A point of a stroke: [x, y, pressure] in world units. */
export type StrokePoint = [number, number, number];

export interface Stroke {
  id: string;
  /** Layer this stroke belongs to. */
  layerId: string;
  points: StrokePoint[];
  color: string;
  /** Thickness in world units (1 unit = 2 km). */
  size: number;
  /** True for mouse/touch (no real pressure); false for pens. */
  simulatePressure: boolean;
  /** Line or map symbols (mountains, forest…). Missing = "line" (older files). */
  style?: StrokeStyle;
  /**
   * Only for style "area" (filled shapes made by closing a line with the snap):
   * the element it is filled with (forest, mountains…). Its `points` are the outline.
   */
  element?: DrawStyle;
}

export interface Brush {
  color: string;
  /** Thickness (or symbol size) in world units. */
  size: number;
  style: DrawStyle;
}

export const MIN_BRUSH_SIZE = 1;
export const MAX_BRUSH_SIZE = 40;

/** The map paper is always white, so the default ink is always dark. */
export function createDefaultBrush(): Brush {
  return { color: '#2a2a2a', size: 6, style: 'line' };
}

export function createStroke(brush: Brush, layerId: string, simulatePressure: boolean): Stroke {
  return {
    id: crypto.randomUUID(),
    layerId,
    points: [],
    color: brush.color,
    size: brush.size,
    simulatePressure,
    style: brush.style,
  };
}

/** Copy of a stroke with a new id, moved by (dx, dy). */
export function cloneStroke(stroke: Stroke, dx: number, dy: number): Stroke {
  return {
    ...stroke,
    id: crypto.randomUUID(),
    points: stroke.points.map(([x, y, p]) => [x + dx, y + dy, p] as StrokePoint),
  };
}

/** SVG paths for any style: the freehand outline for lines, symbols otherwise. */
export function getStrokeParts(stroke: Stroke, finished = true): ShapePart[] {
  const style = stroke.style ?? 'line';
  if (style === 'line') return [{ cls: 'line', d: getStrokePath(stroke, finished) }];
  if (style === 'area') {
    const outline = stroke.points.map((p) => [p[0], p[1]] as [number, number]);
    return buildAreaParts(stroke.element ?? 'line', outline, stroke.size, stroke.color, stroke.id);
  }
  return buildSymbolParts(style, stroke.points, stroke.size, stroke.id);
}

/** Filled area made from a closed outline (same color/size/element as the line). */
export function createArea(
  layerId: string,
  outline: StrokePoint[],
  color: string,
  size: number,
  element: DrawStyle,
): Stroke {
  return {
    id: crypto.randomUUID(),
    layerId,
    points: outline,
    color,
    size,
    simulatePressure: true,
    style: 'area',
    element,
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
