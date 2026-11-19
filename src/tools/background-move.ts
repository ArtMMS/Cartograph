import type { Viewport } from '../core/viewport';

export interface BackgroundMoveOptions {
  svg: SVGSVGElement;
  viewport: Viewport;
  /** True when "Move image" mode is on and there is an image. */
  isActive: () => boolean;
  /** Called while dragging, with the movement in world units. */
  onDrag: (dx: number, dy: number) => void;
}

/** Lets the user drag the background image with the left mouse button. */
export function attachBackgroundMove(options: BackgroundMoveOptions): void {
  const { svg, viewport } = options;
  let drag: { pointerId: number; lastX: number; lastY: number } | null = null;

  svg.addEventListener('pointerdown', (e) => {
    // The viewport calls preventDefault() when it starts panning (middle / Space).
    if (e.button !== 0 || e.defaultPrevented || !options.isActive()) return;

    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    drag = { pointerId: e.pointerId, lastX: p.x, lastY: p.y };
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;

    const p = viewport.screenToWorld(e.clientX, e.clientY);
    options.onDrag(p.x - drag.lastX, p.y - drag.lastY);
    drag.lastX = p.x;
    drag.lastY = p.y;
  });

  const end = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    drag = null;
  };

  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
}
