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
        cached.label.setAttribute('y', String(marker.type === 'capital' ? -14 : -11));
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

/** Icon shapes, in screen pixels (the group is scaled to cancel the zoom). */
function drawIcon(icon: SVGGElement, type: MarkerType): void {
  icon.replaceChildren(createSvg('circle', { class: 'marker__ring', r: 13 }));

  switch (type) {
    case 'capital':
      icon.append(
        createSvg('circle', { class: 'marker__shape marker__shape--outline', r: 8 }),
        createSvg('circle', { class: 'marker__shape', r: 4.5 }),
      );
      break;
    case 'city':
      icon.append(createSvg('circle', { class: 'marker__shape', r: 5.5 }));
      break;
    case 'village':
      icon.append(createSvg('circle', { class: 'marker__shape marker__shape--outline', r: 4 }));
      break;
    case 'poi':
      icon.append(
        createSvg('rect', {
          class: 'marker__shape',
          x: -5,
          y: -5,
          width: 10,
          height: 10,
          transform: 'rotate(45)',
        }),
      );
      break;
  }

  // Bigger invisible circle: easier to click.
  icon.append(createSvg('circle', { class: 'marker__hit', r: 10 }));
}
