import { findStrokeAt } from '../core/geometry';
import type { Stroke } from '../core/stroke';
import type { Viewport } from '../core/viewport';

/** How close (in screen pixels) a click must be to select a stroke. */
const HIT_TOLERANCE_PX = 6;
/** Mouse movement (screen pixels) before a click becomes a drag. */
const DRAG_THRESHOLD_PX = 3;

export interface SelectOptions {
  svg: SVGSVGElement;
  viewport: Viewport;
  isActive: () => boolean;
  getStrokes: () => readonly Stroke[];
  /** Called with the clicked stroke id, or null when clicking empty space. */
  onSelect: (id: string | null) => void;
  /** Called while dragging a stroke, with the total movement in world units. */
  onDrag: (id: string, dx: number, dy: number) => void;
  /** Called when a drag ends (only if the stroke actually moved). */
  onDragEnd: (id: string, dx: number, dy: number) => void;
}

/** Click a stroke to select it (drag to move it); click empty space to clear the selection. */
export function attachSelect(options: SelectOptions): void {
  const { svg, viewport } = options;
  let drag: {
    pointerId: number;
    id: string;
    startX: number;
    startY: number;
    screenX: number;
    screenY: number;
    moving: boolean;
  } | null = null;

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.defaultPrevented || !options.isActive()) return;

    const p = viewport.screenToWorld(e.clientX, e.clientY);
    const tolerance = HIT_TOLERANCE_PX / viewport.getScale();
    const hit = findStrokeAt(options.getStrokes(), p.x, p.y, tolerance);
    options.onSelect(hit?.id ?? null);
    if (!hit) return;

    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    drag = {
      pointerId: e.pointerId,
      id: hit.id,
      startX: p.x,
      startY: p.y,
      screenX: e.clientX,
      screenY: e.clientY,
      moving: false,
    };
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moving) {
      const moved = Math.hypot(e.clientX - drag.screenX, e.clientY - drag.screenY);
      if (moved < DRAG_THRESHOLD_PX) return;
      drag.moving = true;
    }
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    options.onDrag(drag.id, p.x - drag.startX, p.y - drag.startY);
  });

  const end = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    if (drag.moving) {
      const p = viewport.screenToWorld(e.clientX, e.clientY);
      options.onDragEnd(drag.id, p.x - drag.startX, p.y - drag.startY);
    }
    drag = null;
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}
