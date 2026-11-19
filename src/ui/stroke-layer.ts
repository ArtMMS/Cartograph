import type { Layer } from '../core/layer';
import { getStrokePath, type Stroke } from '../core/stroke';
import { createSvg } from '../core/svg';

export interface StrokeLayer {
  /** Makes the drawing match the layers and strokes (adds, removes, updates, reorders). */
  sync(strokes: readonly Stroke[], layers: readonly Layer[]): void;
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

/** Draws strokes as filled SVG paths, one SVG group per layer. */
export function createStrokeLayer(group: SVGGElement): StrokeLayer {
  const layersGroup = createSvg('g', { class: 'layers' });
  const preview = createSvg('path', { class: 'stroke stroke--preview' });
  group.append(layersGroup, preview);

  const groups = new Map<string, SVGGElement>();
  const cache = new Map<string, CachedPath>();
  let selectedId: string | null = null;

  function sync(strokes: readonly Stroke[], layers: readonly Layer[]): void {
    // ---------- Layer groups (bottom to top) ----------
    const layerIds = new Set<string>();

    layers.forEach((layer, index) => {
      layerIds.add(layer.id);
      let g = groups.get(layer.id);
      if (!g) {
        g = createSvg('g', { class: 'stroke-group', 'data-layer-id': layer.id });
        groups.set(layer.id, g);
      }
      g.style.display = layer.visible ? '' : 'none';
      placeAt(layersGroup, g, index);
    });

    for (const [id, g] of groups) {
      if (!layerIds.has(id)) {
        g.remove();
        groups.delete(id);
      }
    }

    // ---------- Strokes (in drawing order, inside their layer) ----------
    const seen = new Set<string>();
    const counters = new Map<string, number>();

    for (const stroke of strokes) {
      const g = groups.get(stroke.layerId);
      if (!g) continue;
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

      const index = counters.get(stroke.layerId) ?? 0;
      placeAt(g, cached.path, index);
      counters.set(stroke.layerId, index + 1);
    }

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

/** Puts `child` at position `index` inside `parent` (only moves it if needed). */
function placeAt(parent: Element, child: Element, index: number): void {
  const current = parent.children[index];
  if (current !== child) parent.insertBefore(child, current ?? null);
}
