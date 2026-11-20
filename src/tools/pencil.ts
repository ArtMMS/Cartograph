import { createStroke, type Brush, type Stroke, type StrokePoint } from '../core/stroke';
import type { Viewport } from '../core/viewport';

/** Minimum distance (world units) between two recorded points. */
const MIN_POINT_DISTANCE = 0.2;

export interface PencilOptions {
  svg: SVGSVGElement;
  viewport: Viewport;
  /** True when the Pencil tool is selected. */
  isActive: () => boolean;
  /**
   * Brush and layer to draw on, or a message explaining why drawing
   * isn't possible right now (e.g. the active layer is locked).
   */
  getTarget: () => { brush: Brush; layerId: string } | string;
  /** Called when drawing is blocked, with the reason. */
  onBlocked: (reason: string) => void;
  /** Called while drawing with the stroke in progress (null when it ends). */
  onPreview: (stroke: Stroke | null) => void;
  /** Called when a stroke is finished. */
  onCommit: (stroke: Stroke) => void;
  /**
   * Snapping: the line end near (x, y) to snap to, or null.
   * `extra` = additional candidate points (e.g. the start of the stroke being drawn).
   */
  findSnap: (x: number, y: number, extra: [number, number][]) => [number, number] | null;
  /** Shows/hides the snap indicator. */
  onSnapHint: (point: [number, number] | null) => void;
}

/**
 * Freehand drawing with the left mouse button (or pen/touch).
 * Starts and ends snap to nearby line ends (hold Alt to draw freely).
 */
export function attachPencil(options: PencilOptions): void {
  const { svg, viewport } = options;
  let current: { pointerId: number; stroke: Stroke } | null = null;

  function toPoint(e: PointerEvent): StrokePoint {
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    // Mice report 0.5 (or 0 when no button); perfect-freehand simulates it anyway.
    return [p.x, p.y, e.pressure > 0 ? e.pressure : 0.5];
  }

  function addPoint(stroke: Stroke, point: StrokePoint): void {
    const last = stroke.points[stroke.points.length - 1];
    if (last && Math.hypot(point[0] - last[0], point[1] - last[1]) < MIN_POINT_DISTANCE) return;
    stroke.points.push(point);
  }

  /** Snap target for the current position (the stroke's own start counts, to close shapes). */
  function snapFor(e: PointerEvent, stroke: Stroke | null): [number, number] | null {
    if (e.altKey) return null;
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    const extra: [number, number][] =
      stroke && stroke.points.length > 8 ? [[stroke.points[0][0], stroke.points[0][1]]] : [];
    return options.findSnap(p.x, p.y, extra);
  }

  svg.addEventListener('pointerdown', (e) => {
    // The viewport / transform call preventDefault() when they take the event.
    if (e.button !== 0 || e.defaultPrevented || !options.isActive()) return;

    e.preventDefault();

    const target = options.getTarget();
    if (typeof target === 'string') {
      options.onBlocked(target);
      return;
    }

    svg.setPointerCapture(e.pointerId);
    const stroke = createStroke(target.brush, target.layerId, e.pointerType !== 'pen');

    // Start exactly on a nearby line end.
    const point = toPoint(e);
    const snap = snapFor(e, null);
    if (snap) {
      point[0] = snap[0];
      point[1] = snap[1];
    }
    addPoint(stroke, point);

    current = { pointerId: e.pointerId, stroke };
    options.onPreview(stroke);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!options.isActive()) return;

    if (!current) {
      // Hovering: show where a new line would start.
      options.onSnapHint(snapFor(e, null));
      return;
    }
    if (e.pointerId !== current.pointerId) return;

    // Coalesced events give smoother lines on fast movements.
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e]) addPoint(current.stroke, toPoint(ev));
    options.onPreview(current.stroke);
    options.onSnapHint(snapFor(e, current.stroke));
  });

  svg.addEventListener('pointerup', (e) => {
    if (!current || e.pointerId !== current.pointerId) return;

    const stroke = current.stroke;
    addPoint(stroke, toPoint(e));

    // End exactly on a nearby line end (or on its own start, closing the shape).
    const snap = snapFor(e, stroke);
    if (snap) stroke.points.push([snap[0], snap[1], stroke.points[stroke.points.length - 1][2]]);

    finish(e);
    options.onPreview(null);
    options.onSnapHint(null);
    options.onCommit(stroke);
  });

  svg.addEventListener('pointercancel', (e) => {
    if (!current || e.pointerId !== current.pointerId) return;
    finish(e);
    options.onPreview(null);
    options.onSnapHint(null);
  });

  svg.addEventListener('pointerleave', () => {
    if (!current) options.onSnapHint(null);
  });

  function finish(e: PointerEvent): void {
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    current = null;
  }
}
