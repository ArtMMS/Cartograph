import { pathLength, type Point } from '../core/geometry';
import { createSvg } from '../core/svg';
import type { Viewport } from '../core/viewport';

export interface MeasureOptions {
  svg: SVGSVGElement;
  viewport: Viewport;
  /** Group on top of the map where the path is drawn. */
  overlay: SVGGElement;
  isActive: () => boolean;
  /** Called with the measured length in world units (live while drawing). */
  onChange: (length: number, finished: boolean, points: number) => void;
}

export interface Measure {
  clear(): void;
  /** Keeps dots the same size on screen. */
  setZoom(scale: number): void;
}

/**
 * Distance tool:
 * - left-click adds points along a route (the line follows the mouse)
 * - right-click (or double-click / Enter) stops the ruler where it is
 * - the stopped ruler stays on the map, showing the distance, until Esc
 */
export function attachMeasure(options: MeasureOptions): Measure {
  const { svg, viewport } = options;

  const group = createSvg('g', { class: 'measure' });
  const line = createSvg('polyline', { class: 'measure__line' });
  const dots = createSvg('g', { class: 'measure__dots' });
  group.append(line, dots);
  options.overlay.append(group);

  let points: Point[] = [];
  let cursor: Point | null = null;
  let finished = false;
  let zoom = viewport.getScale();

  function allPoints(): Point[] {
    return !finished && cursor && points.length > 0 ? [...points, cursor] : points;
  }

  function render(): void {
    const list = allPoints();
    line.setAttribute('points', list.map((p) => `${p[0]},${p[1]}`).join(' '));
    dots.replaceChildren(
      ...points.map((p) =>
        createSvg('circle', { class: 'measure__dot', cx: p[0], cy: p[1], r: 4 / zoom }),
      ),
    );
    group.classList.toggle('is-finished', finished);
    options.onChange(pathLength(list), finished, points.length);
  }

  function clear(): void {
    points = [];
    cursor = null;
    finished = false;
    render();
  }

  /** Stops the ruler. `keepCursor` adds the current mouse position as the last point. */
  function finish(keepCursor: boolean): void {
    if (finished || points.length === 0) return;
    if (keepCursor && cursor) points.push(cursor);
    if (points.length < 2) return;
    finished = true;
    cursor = null;
    render();
  }

  svg.addEventListener('pointerdown', (e) => {
    if (!options.isActive() || e.defaultPrevented) return;

    // Right-click: stop the ruler where it is.
    if (e.button === 2) {
      e.preventDefault();
      finish(true);
      return;
    }
    if (e.button !== 0) return;
    e.preventDefault();

    // A stopped ruler stays until Esc.
    if (finished) return;
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    points.push([p.x, p.y]);
    render();
  });

  // No browser menu on right-click while measuring.
  svg.addEventListener('contextmenu', (e) => {
    if (options.isActive()) e.preventDefault();
  });

  svg.addEventListener('pointermove', (e) => {
    if (!options.isActive() || finished || points.length === 0) return;
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    cursor = [p.x, p.y];
    render();
  });

  svg.addEventListener('dblclick', (e) => {
    if (!options.isActive() || finished) return;
    e.preventDefault();
    // The double-click's second click added a duplicate point — drop it.
    if (points.length >= 2) {
      const a = points[points.length - 1];
      const b = points[points.length - 2];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) * zoom < 6) points.pop();
    }
    finish(false);
  });

  window.addEventListener('keydown', (e) => {
    if (!options.isActive()) return;
    if (e.key === 'Enter') finish(false);
  });

  function setZoom(scale: number): void {
    zoom = scale;
    for (const dot of dots.children) dot.setAttribute('r', String(4 / zoom));
  }

  return { clear, setZoom };
}
