import { smoothClosedPath, polygonCentroid } from '../core/geometry';
import type { Layer } from '../core/layer';
import { REGION_TYPES, type Region, type RegionType, type RegionView } from '../core/region';
import { createSvg } from '../core/svg';

export interface RegionLayer {
  sync(regions: readonly Region[], layers: readonly Layer[], view: RegionView): void;
  /** Keeps labels the same size on screen at any zoom. */
  setZoom(scale: number): void;
  setSelected(id: string | null): void;
  /** Outline preview while drawing a new region (null hides it). */
  setPreview(points: [number, number][] | null, color: string): void;
}

interface CachedRegion {
  shape: SVGPathElement;
  label: SVGTextElement;
  points: Region['points'] | null;
  type: RegionType | null;
  centroid: [number, number];
}

/**
 * Draws region shapes inside their layer's SVG group, and their names
 * in a separate labels group on top of everything (so lines don't cover them).
 */
export function createRegionLayer(
  svg: SVGSVGElement,
  labelsParent: SVGGElement,
  getLayerGroup: (layerId: string) => SVGGElement | undefined,
): RegionLayer {
  const labels = createSvg('g', { class: 'region-labels' });
  const preview = createSvg('path', { class: 'region-preview' });
  labelsParent.append(preview, labels);

  const cache = new Map<string, CachedRegion>();
  let zoom = 1;
  let selectedId: string | null = null;

  function sync(regions: readonly Region[], layers: readonly Layer[], view: RegionView): void {
    const visibleLayers = new Set(layers.filter((l) => l.visible).map((l) => l.id));
    const layerIds = new Set(layers.map((l) => l.id));
    const seen = new Set<string>();

    // Bigger types first, so nations are drawn on top of their continent.
    const ordered = [...regions].sort((a, b) => rank(a.type) - rank(b.type));

    for (const region of ordered) {
      const parent = layerIds.has(region.layerId) ? getLayerGroup(region.layerId) : undefined;
      if (!parent) continue;
      seen.add(region.id);

      let cached = cache.get(region.id);
      if (!cached) {
        cached = {
          shape: createSvg('path', { class: 'region', 'data-region-id': region.id }),
          label: createSvg('text', { class: 'region-label', 'text-anchor': 'middle' }),
          points: null,
          type: null,
          centroid: [0, 0],
        };
        cache.set(region.id, cached);
      }

      if (cached.points !== region.points) {
        cached.shape.setAttribute('d', smoothClosedPath(region.points));
        cached.centroid = polygonCentroid(region.points);
        cached.points = region.points;
      }
      if (cached.type !== region.type) {
        for (const t of REGION_TYPES) {
          cached.shape.classList.remove(`region--${t.id}`);
          cached.label.classList.remove(`region-label--${t.id}`);
        }
        cached.shape.classList.add(`region--${region.type}`);
        cached.label.classList.add(`region-label--${region.type}`);
        cached.type = region.type;
      }

      cached.shape.style.setProperty('--region-color', region.color);
      cached.label.style.setProperty('--region-color', region.color);
      cached.label.textContent = region.name;
      cached.label.style.display = visibleLayers.has(region.layerId) ? '' : 'none';
      updateLabelTransform(cached);

      // Regions sit under the strokes of their layer (they're mostly fills).
      parent.insertBefore(cached.shape, firstNonRegion(parent));
      labels.append(cached.label);
    }

    for (const [id, cached] of cache) {
      if (!seen.has(id)) {
        cached.shape.remove();
        cached.label.remove();
        cache.delete(id);
      }
    }

    svg.classList.toggle('hide-region-labels', !view.showLabels);
    for (const t of REGION_TYPES) {
      svg.classList.toggle(`hide-region-${t.id}`, view.hiddenTypes.includes(t.id));
    }
    applySelection();
  }

  function updateLabelTransform(cached: CachedRegion): void {
    const [x, y] = cached.centroid;
    cached.label.setAttribute('transform', `translate(${x} ${y}) scale(${1 / zoom})`);
  }

  function setZoom(scale: number): void {
    zoom = scale;
    for (const cached of cache.values()) updateLabelTransform(cached);
  }

  function setSelected(id: string | null): void {
    selectedId = id;
    applySelection();
  }

  function applySelection(): void {
    for (const [id, cached] of cache) {
      cached.shape.classList.toggle('is-selected', id === selectedId);
    }
  }

  function setPreview(points: [number, number][] | null, color: string): void {
    if (!points || points.length < 2) {
      preview.setAttribute('d', '');
      return;
    }
    const d = 'M' + points.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' L') + ' Z';
    preview.setAttribute('d', d);
    preview.style.setProperty('--region-color', color);
  }

  return { sync, setZoom, setSelected, setPreview };
}

function rank(type: RegionType): number {
  return REGION_TYPES.findIndex((t) => t.id === type);
}

/** First child of the layer group that isn't a region shape (image or stroke). */
function firstNonRegion(parent: SVGGElement): Element | null {
  for (const child of parent.children) {
    if (!child.classList.contains('region') && !child.classList.contains('layer-image')) {
      return child;
    }
  }
  return null;
}
