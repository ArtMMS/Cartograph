import { findStrokeAt } from '../core/geometry';
import type { Stroke } from '../core/stroke';
import type { Viewport } from '../core/viewport';

/** How close (in screen pixels) a click must be to select a stroke. */
const HIT_TOLERANCE_PX = 6;

export interface SelectOptions {
  svg: SVGSVGElement;
  viewport: Viewport;
  isActive: () => boolean;
  getStrokes: () => readonly Stroke[];
  /** Called with the clicked stroke id, or null when clicking empty space. */
  onSelect: (id: string | null) => void;
}

/** Click a stroke to select it; click empty space to clear the selection. */
export function attachSelect(options: SelectOptions): void {
  const { svg, viewport } = options;

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.defaultPrevented || !options.isActive()) return;

    const p = viewport.screenToWorld(e.clientX, e.clientY);
    const tolerance = HIT_TOLERANCE_PX / viewport.getScale();
    const hit = findStrokeAt(options.getStrokes(), p.x, p.y, tolerance);
    options.onSelect(hit?.id ?? null);
  });
}
