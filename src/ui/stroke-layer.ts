import type { BackgroundImage } from '../core/background';
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
  /** The SVG group of a layer (other renderers, like markers, draw inside it). */
  getGroup(layerId: string): SVGGElement | undefined;
}

interface CachedImage {
  element: SVGImageElement;
  src: string;
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
  const images = new Map<string, CachedImage>();
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
      if (layer.image) syncImage(layer.id, layer.image, g);
    });

    for (const [id, g] of groups) {
      if (!layerIds.has(id)) {
        g.remove();
        groups.delete(id);
      }
    }
    for (const [id, cached] of images) {
      if (!layerIds.has(id)) {
        cached.element.remove();
        images.delete(id);
      }
    }

    // ---------- Strokes (in drawing order, inside their layer) ----------
    const seen = new Set<string>();
    // Image layers keep their image as the first child.
    const counters = new Map<string, number>();
    for (const l of layers) if (l.image) counters.set(l.id, 1);

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

  function syncImage(layerId: string, image: BackgroundImage, g: SVGGElement): void {
    let cached = images.get(layerId);
    if (!cached) {
      const element = createSvg('image', { class: 'layer-image', preserveAspectRatio: 'none' });
      cached = { element, src: '' };
      images.set(layerId, cached);
    }

    const el = cached.element;
    if (cached.src !== image.src) {
      el.setAttribute('href', image.src);
      cached.src = image.src;
    }
    el.setAttribute('x', String(image.x));
    el.setAttribute('y', String(image.y));
    el.setAttribute('width', String(image.naturalWidth * image.scale));
    el.setAttribute('height', String(image.naturalHeight * image.scale));
    el.setAttribute('opacity', String(image.opacity));
    placeAt(g, el, 0);
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

  return { sync, setPreview, setSelected, getGroup: (id) => groups.get(id) };
}

/** Puts `child` at position `index` inside `parent` (only moves it if needed). */
function placeAt(parent: Element, child: Element, index: number): void {
  const current = parent.children[index];
  if (current !== child) parent.insertBefore(child, current ?? null);
}
