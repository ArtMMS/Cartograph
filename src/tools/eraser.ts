import { findStrokeAt } from '../core/geometry';
import type { Stroke } from '../core/stroke';
import type { Viewport } from '../core/viewport';

/** Eraser radius in screen pixels. */
const ERASER_RADIUS_PX = 8;

export interface EraserOptions {
  svg: SVGSVGElement;
  viewport: Viewport;
  isActive: () => boolean;
  getStrokes: () => readonly Stroke[];
  /** Called when the eraser touches a stroke (it should be removed). */
  onErase: (id: string) => void;
  /** Called when the drag ends (to group the erased strokes into one undo step). */
  onEnd: () => void;
}

/** Drag over strokes to delete them (whole strokes). */
export function attachEraser(options: EraserOptions): void {
  const { svg, viewport } = options;
  let pointerId: number | null = null;

  function eraseAt(e: PointerEvent): void {
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    const tolerance = ERASER_RADIUS_PX / viewport.getScale();

    // Keep erasing until nothing else is under the cursor.
    let hit = findStrokeAt(options.getStrokes(), p.x, p.y, tolerance);
    while (hit) {
      options.onErase(hit.id);
      hit = findStrokeAt(options.getStrokes(), p.x, p.y, tolerance);
    }
  }

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.defaultPrevented || !options.isActive()) return;

    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    pointerId = e.pointerId;
    eraseAt(e);
  });

  svg.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e]) eraseAt(ev);
  });

  const end = (e: PointerEvent): void => {
    if (e.pointerId !== pointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    pointerId = null;
    options.onEnd();
  };

  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}
