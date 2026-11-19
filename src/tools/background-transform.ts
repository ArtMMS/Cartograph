import { clampScale, type BackgroundImage } from '../core/background';
import { createSvg } from '../core/svg';
import type { Viewport } from '../core/viewport';

/** Handle size on screen, in pixels (stays the same at any zoom). */
const HANDLE_PX = 10;

type Corner = 'nw' | 'ne' | 'sw' | 'se';
const CORNERS: readonly Corner[] = ['nw', 'ne', 'sw', 'se'];

export interface BackgroundTransformOptions {
  svg: SVGSVGElement;
  viewport: Viewport;
  /** Group where the frame and handles are drawn (top-most layer). */
  overlay: SVGGElement;
  getBackground: () => BackgroundImage | null;
  /** True when Transform mode is on and the image can be edited. */
  isActive: () => boolean;
  /** Called after the image position/scale changes. */
  onChange: () => void;
}

export interface BackgroundTransform {
  /** Redraws the frame and handles (call after any change or zoom). */
  render(): void;
  /** True if the pointer event is over the frame or a handle. */
  hitTest(e: PointerEvent): boolean;
}

type DragState =
  | { kind: 'move'; pointerId: number; lastX: number; lastY: number }
  | { kind: 'scale'; pointerId: number; corner: Corner; anchorX: number; anchorY: number };

/**
 * Lets the user move (drag inside) and resize (drag a corner) the
 * background image directly on the map. Resizing keeps the aspect ratio
 * and anchors the opposite corner.
 */
export function createBackgroundTransform(options: BackgroundTransformOptions): BackgroundTransform {
  const { svg, viewport } = options;

  const group = createSvg('g', { class: 'bg-transform' });
  const body = createSvg('rect', { class: 'bg-transform__body' });
  group.append(body);

  const handles = new Map<Corner, SVGRectElement>();
  for (const corner of CORNERS) {
    const handle = createSvg('rect', {
      class: `bg-transform__handle bg-transform__handle--${corner}`,
      'data-corner': corner,
    });
    handles.set(corner, handle);
    group.append(handle);
  }

  options.overlay.append(group);

  let drag: DragState | null = null;

  // ---------- Render ----------

  function render(): void {
    const bg = options.getBackground();
    if (!bg || !options.isActive()) {
      group.style.display = 'none';
      return;
    }
    group.style.display = '';

    const w = bg.naturalWidth * bg.scale;
    const h = bg.naturalHeight * bg.scale;
    setRect(body, bg.x, bg.y, w, h);

    const size = HANDLE_PX / viewport.getScale();
    const points: Record<Corner, [number, number]> = {
      nw: [bg.x, bg.y],
      ne: [bg.x + w, bg.y],
      sw: [bg.x, bg.y + h],
      se: [bg.x + w, bg.y + h],
    };
    for (const [corner, handle] of handles) {
      const [cx, cy] = points[corner];
      setRect(handle, cx - size / 2, cy - size / 2, size, size);
    }
  }

  // ---------- Pointer ----------

  function getTarget(e: Event): { corner: Corner | null; isBody: boolean } {
    const target = e.target instanceof Element ? e.target : null;
    const corner = (target?.closest('[data-corner]')?.getAttribute('data-corner') ??
      null) as Corner | null;
    const isBody = target === body;
    return { corner, isBody };
  }

  function hitTest(e: PointerEvent): boolean {
    if (!options.isActive()) return false;
    const { corner, isBody } = getTarget(e);
    return corner !== null || isBody;
  }

  svg.addEventListener('pointerdown', (e) => {
    // The viewport calls preventDefault() when it starts panning.
    if (e.button !== 0 || e.defaultPrevented || !options.isActive()) return;

    const bg = options.getBackground();
    if (!bg) return;

    const { corner, isBody } = getTarget(e);
    if (!corner && !isBody) return;

    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const p = viewport.screenToWorld(e.clientX, e.clientY);

    if (corner) {
      const w = bg.naturalWidth * bg.scale;
      const h = bg.naturalHeight * bg.scale;
      // The anchor is the opposite corner, which stays fixed.
      const anchorX = corner === 'nw' || corner === 'sw' ? bg.x + w : bg.x;
      const anchorY = corner === 'nw' || corner === 'ne' ? bg.y + h : bg.y;
      drag = { kind: 'scale', pointerId: e.pointerId, corner, anchorX, anchorY };
      svg.classList.add(`is-resizing-${corner}`);
    } else {
      drag = { kind: 'move', pointerId: e.pointerId, lastX: p.x, lastY: p.y };
      svg.classList.add('is-moving');
    }
  });

  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;

    const bg = options.getBackground();
    if (!bg) return;

    const p = viewport.screenToWorld(e.clientX, e.clientY);

    if (drag.kind === 'move') {
      bg.x += p.x - drag.lastX;
      bg.y += p.y - drag.lastY;
      drag.lastX = p.x;
      drag.lastY = p.y;
    } else {
      // Keep the aspect ratio: use whichever axis grew the most.
      const sx = Math.abs(p.x - drag.anchorX) / bg.naturalWidth;
      const sy = Math.abs(p.y - drag.anchorY) / bg.naturalHeight;
      bg.scale = clampScale(bg, Math.max(sx, sy));

      const w = bg.naturalWidth * bg.scale;
      const h = bg.naturalHeight * bg.scale;
      const left = drag.corner === 'nw' || drag.corner === 'sw';
      const top = drag.corner === 'nw' || drag.corner === 'ne';
      bg.x = left ? drag.anchorX - w : drag.anchorX;
      bg.y = top ? drag.anchorY - h : drag.anchorY;
    }

    options.onChange();
  });

  const end = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    svg.classList.remove('is-moving', 'is-resizing-nw', 'is-resizing-ne', 'is-resizing-sw', 'is-resizing-se');
    drag = null;
  };

  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);

  return { render, hitTest };
}

function setRect(el: SVGRectElement, x: number, y: number, w: number, h: number): void {
  el.setAttribute('x', String(x));
  el.setAttribute('y', String(y));
  el.setAttribute('width', String(w));
  el.setAttribute('height', String(h));
}
