import { createStroke, type Brush, type Stroke } from '../core/stroke';
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
}

/** Freehand drawing with the left mouse button (or pen/touch). */
export function attachPencil(options: PencilOptions): void {
  const { svg, viewport } = options;
  let current: { pointerId: number; stroke: Stroke } | null = null;

  function addPoint(stroke: Stroke, e: PointerEvent): void {
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    const last = stroke.points[stroke.points.length - 1];
    if (last && Math.hypot(p.x - last[0], p.y - last[1]) < MIN_POINT_DISTANCE) return;

    // Mice report 0.5 (or 0 when no button); perfect-freehand simulates it anyway.
    const pressure = e.pressure > 0 ? e.pressure : 0.5;
    stroke.points.push([p.x, p.y, pressure]);
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
    addPoint(stroke, e);
    current = { pointerId: e.pointerId, stroke };
    options.onPreview(stroke);
  });

  svg.addEventListener('pointermove', (e) => {
    if (!current || e.pointerId !== current.pointerId) return;

    // Coalesced events give smoother lines on fast movements.
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e]) addPoint(current.stroke, ev);
    options.onPreview(current.stroke);
  });

  svg.addEventListener('pointerup', (e) => {
    if (!current || e.pointerId !== current.pointerId) return;

    addPoint(current.stroke, e);
    const stroke = current.stroke;
    finish(e);
    options.onPreview(null);
    options.onCommit(stroke);
  });

  svg.addEventListener('pointercancel', (e) => {
    if (!current || e.pointerId !== current.pointerId) return;
    finish(e);
    options.onPreview(null);
  });

  function finish(e: PointerEvent): void {
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    current = null;
  }
}
