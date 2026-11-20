import type { Layer } from '../core/layer';
import { MARKER_TYPES, type Marker, type MarkerType, type MarkerView } from '../core/marker';
import { createSvg } from '../core/svg';

export interface MarkerLayer {
  /** Makes the markers on the map match the list. */
  sync(markers: readonly Marker[], layers: readonly Layer[], view: MarkerView): void;
  /** Keeps markers the same size on screen at any zoom. */
  setZoom(scale: number): void;
  setSelected(id: string | null): void;
}

interface CachedMarker {
  group: SVGGElement;
  icon: SVGGElement;
  label: SVGTextElement;
  type: MarkerType | null;
  marker: Marker;
}

/** Draws markers (icon + label) inside their layer's SVG group. */
export function createMarkerLayer(
  svg: SVGSVGElement,
  getLayerGroup: (layerId: string) => SVGGElement | undefined,
): MarkerLayer {
  const cache = new Map<string, CachedMarker>();
  let zoom = 1;
  let selectedId: string | null = null;

  function sync(markers: readonly Marker[], layers: readonly Layer[], view: MarkerView): void {
    const layerIds = new Set(layers.map((l) => l.id));
    const seen = new Set<string>();

    for (const marker of markers) {
      const parent = layerIds.has(marker.layerId) ? getLayerGroup(marker.layerId) : undefined;
      if (!parent) continue;
      seen.add(marker.id);

      let cached = cache.get(marker.id);
      if (!cached) {
        const group = createSvg('g', { class: 'marker', 'data-marker-id': marker.id });
        const icon = createSvg('g', { class: 'marker__icon' });
        const label = createSvg('text', { class: 'marker__label', 'text-anchor': 'middle' });
        group.append(icon, label);
        cached = { group, icon, label, type: null, marker };
        cache.set(marker.id, cached);
      }
      cached.marker = marker;

      if (cached.type !== marker.type) {
        drawIcon(cached.icon, marker.type);
        for (const t of MARKER_TYPES) cached.group.classList.remove(`marker--${t.id}`);
        cached.group.classList.add(`marker--${marker.type}`);
        cached.label.setAttribute('y', String(LABEL_OFFSET[marker.type]));
        cached.type = marker.type;
      }
      cached.label.textContent = marker.name;
      updateTransform(cached);

      // Markers always sit above the strokes of their layer.
      if (cached.group.parentNode !== parent || parent.lastChild !== cached.group) {
        parent.append(cached.group);
      }
    }

    for (const [id, cached] of cache) {
      if (!seen.has(id)) {
        cached.group.remove();
        cache.delete(id);
      }
    }

    // Display settings: classes on the SVG, read by the CSS.
    svg.classList.toggle('hide-marker-labels', !view.showLabels);
    for (const t of MARKER_TYPES) {
      svg.classList.toggle(`hide-marker-${t.id}`, view.hiddenTypes.includes(t.id));
    }

    applySelection();
  }

  function updateTransform(cached: CachedMarker): void {
    const { x, y } = cached.marker;
    cached.group.setAttribute('transform', `translate(${x} ${y}) scale(${1 / zoom})`);
  }

  function setZoom(scale: number): void {
    zoom = scale;
    for (const cached of cache.values()) updateTransform(cached);
  }

  function setSelected(id: string | null): void {
    selectedId = id;
    applySelection();
  }

  function applySelection(): void {
    for (const [id, cached] of cache) {
      cached.group.classList.toggle('is-selected', id === selectedId);
    }
  }

  return { sync, setZoom, setSelected };
}

/** How far above the icon the name goes (screen pixels). */
const LABEL_OFFSET: Record<MarkerType, number> = {
  capital: -14,
  city: -11,
  village: -10,
  poi: -11,
  area: -11,
  forest: -16,
  mountain: -16,
  water: -12,
  road: -15,
};

/** Icon shapes, in screen pixels (the group is scaled to cancel the zoom). */
function drawIcon(icon: SVGGElement, type: MarkerType): void {
  icon.replaceChildren(createSvg('circle', { class: 'marker__ring', r: 13 }));
  const shape = (tag: 'circle' | 'rect' | 'path', attrs: Record<string, string | number>): void => {
    icon.append(createSvg(tag, attrs));
  };

  switch (type) {
    case 'capital':
      shape('circle', { class: 'marker__shape marker__shape--outline', r: 8 });
      shape('circle', { class: 'marker__shape', r: 4.5 });
      break;
    case 'city':
      shape('circle', { class: 'marker__shape', r: 5.5 });
      break;
    case 'village':
      shape('circle', { class: 'marker__shape marker__shape--outline', r: 4 });
      break;
    case 'poi':
      shape('rect', { class: 'marker__shape', x: -5, y: -5, width: 10, height: 10, transform: 'rotate(45)' });
      break;
    case 'area':
      // Small dashed circle: "this whole place".
      shape('circle', { class: 'marker__symbol marker__symbol--area', r: 6 });
      break;
    case 'forest':
      shape('path', {
        class: 'marker__symbol marker__symbol--forest',
        d: 'M0,-12 L6,-4 L3,-4 L8,3 L-8,3 L-3,-4 L-6,-4 Z M-1,3 L1,3 L1,6 L-1,6 Z',
      });
      break;
    case 'mountain':
      shape('path', { class: 'marker__symbol marker__symbol--mountain', d: 'M-10,5 L-1,-11 L10,5 Z' });
      shape('path', { class: 'marker__symbol marker__symbol--snow', d: 'M-1,-11 L-4.5,-5 L-1.5,-6.5 L1,-5 L3,-6.5 Z' });
      break;
    case 'water':
      shape('path', {
        class: 'marker__symbol marker__symbol--water',
        d: 'M0,-9 C4,-3 6,0 6,3 A6,6 0 0 1 -6,3 C-6,0 -4,-3 0,-9 Z',
      });
      break;
    case 'road':
      // Signpost.
      shape('path', { class: 'marker__symbol marker__symbol--post', d: 'M-1,-12 L1,-12 L1,6 L-1,6 Z' });
      shape('path', { class: 'marker__symbol marker__symbol--sign', d: 'M-1,-11 L8,-11 L11,-8 L8,-5 L-1,-5 Z' });
      break;
  }

  // Bigger invisible circle: easier to click.
  icon.append(createSvg('circle', { class: 'marker__hit', r: 10 }));
}
