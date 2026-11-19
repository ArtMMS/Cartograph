import { getStrokePath, type Stroke } from '../core/stroke';
import { createSvg } from '../core/svg';

export interface StrokeLayer {
  /** Makes the drawing match the list of strokes (adds, removes, updates, reorders). */
  sync(strokes: readonly Stroke[]): void;
  /** Shows the stroke being drawn (null hides it). */
  setPreview(stroke: Stroke | null): void;
  /** Highlights the selected stroke (null clears it). */
  setSelected(id: string | null): void;
}

interface CachedPath {
  path: SVGPathElement;
  points: Stroke['points'];
  size: number;
  color: string;
}

/** Draws freehand strokes as filled SVG paths. */
export function createStrokeLayer(group: SVGGElement): StrokeLayer {
  const committed = createSvg('g', { class: 'strokes' });
  const preview = createSvg('path', { class: 'stroke stroke--preview' });
  group.append(committed, preview);

  const cache = new Map<string, CachedPath>();
  let selectedId: string | null = null;

  function sync(strokes: readonly Stroke[]): void {
    const seen = new Set<string>();

    strokes.forEach((stroke, index) => {
      seen.add(stroke.id);
      let cached = cache.get(stroke.id);

      if (!cached) {
        const path = createSvg('path', { class: 'stroke', 'data-stroke-id': stroke.id });
        cached = { path, points: [], size: -1, color: '' };
        cache.set(stroke.id, cached);
      }

      // Only recompute the outline when the shape or size changed.
      if (cached.points !== stroke.points || cached.size !== stroke.size) {
        cached.path.setAttribute('d', getStrokePath(stroke));
        cached.points = stroke.points;
        cached.size = stroke.size;
      }
      if (cached.color !== stroke.color) {
        cached.path.setAttribute('fill', stroke.color);
        cached.color = stroke.color;
      }

      // Keep the DOM order equal to the drawing order.
      const current = committed.children[index];
      if (current !== cached.path) committed.insertBefore(cached.path, current ?? null);
    });

    for (const [id, cached] of cache) {
      if (!seen.has(id)) {
        cached.path.remove();
        cache.delete(id);
      }
    }

    applySelection();
  }

  function setPreview(stroke: Stroke | null): void {
    if (!stroke) {
      preview.setAttribute('d', '');
      return;
    }
    preview.setAttribute('d', getStrokePath(stroke, false));
    preview.setAttribute('fill', stroke.color);
  }

  function setSelected(id: string | null): void {
    selectedId = id;
    applySelection();
  }

  function applySelection(): void {
    for (const [id, cached] of cache) {
      cached.path.classList.toggle('is-selected', id === selectedId);
    }
  }

  return { sync, setPreview, setSelected };
}
