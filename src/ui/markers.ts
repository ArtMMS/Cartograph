import type { History } from '../core/history';
import { createMarkerLayer as createMarkerLayerData, isLayerEditable, type Layer } from '../core/layer';
import { formatDistance, mapScale } from '../core/map-scale';
import { createMarker, getMarkerType, type Marker, type MarkerType } from '../core/marker';
import { MarkerStore, type RemovedMarker } from '../core/marker-store';
import type { Viewport } from '../core/viewport';
import type { ToolId } from '../tools/tool-ids';
import type { Drawing } from './drawing';
import { createMarkerLayer } from './marker-layer';
import { createMarkerDetails, createMarkerTypePicker, createMarkerViewPanel } from './marker-panels';
import type { MapView } from './map-view';
import type { Sidebar } from './sidebar';

export interface MarkersOptions {
  mapView: MapView;
  viewport: Viewport;
  sidebar: Sidebar;
  history: History;
  drawing: Drawing;
  getActiveTool: () => ToolId;
}

export interface Markers {
  store: MarkerStore;
  setZoom(scale: number): void;
  onToolChange(id: ToolId): void;
  hasSelection(): boolean;
  deleteSelection(): void;
  duplicateSelection(): void;
  /** Centers the map on a marker and selects it if editable (search). */
  focus(id: string, select: boolean): void;
  /** View mode: highlight ring around a marker (null clears it). */
  highlight(id: string | null): void;
  /** View mode: the visible marker under the mouse, if any. */
  markerFromEvent(e: Event): Marker | null;
  clearSelection(): void;
  /** Call after undo/redo or layer changes. */
  refreshSelection(): void;
}

/** Cities, villages and points of interest: placing, moving, editing, deleting, showing/hiding. */
export function createMarkers(options: MarkersOptions): Markers {
  const { mapView, viewport, sidebar, history, drawing } = options;
  const layers = drawing.layers;
  const svg = mapView.svg;

  const store = new MarkerStore();
  const renderer = createMarkerLayer(svg, (id) => drawing.getLayerGroup(id));
  renderer.setZoom(viewport.getScale());

  let newType: MarkerType = 'city';
  let selectedId: string | null = null;

  // ---------- Panels ----------

  const typePicker = createMarkerTypePicker((type) => {
    newType = type;
    typePicker.render(newType);
  });
  sidebar.markerToolSlot.append(typePicker.element);
  typePicker.render(newType);

  const viewPanel = createMarkerViewPanel({
    onToggleLabels: () => store.setShowLabels(!store.getView().showLabels),
    onToggleType: (type) => {
      const hidden = store.getView().hiddenTypes.includes(type);
      store.setTypeHidden(type, !hidden);
      const selected = selectedId ? store.get(selectedId) : undefined;
      if (selected && !hidden && selected.type === type) select(null);
    },
  });
  sidebar.markersSlot.append(viewPanel.element);

  const details = createMarkerDetails({
    onName: (name) => editSelected('name', 'Rename marker', name),
    onNotes: (notes) => editSelected('notes', 'Edit notes', notes),
    onType: (type) => {
      const marker = selectedId ? store.get(selectedId) : undefined;
      if (!marker || marker.type === type) return;
      const id = marker.id;
      const before = marker.type;
      store.update(id, { type });
      history.push({
        label: 'Change marker type',
        undo: () => store.update(id, { type: before }),
        redo: () => store.update(id, { type }),
      });
    },
    onDelete: () => deleteSelection(),
    onDuplicate: () => duplicateSelection(),
  });

  function editSelected(field: 'name' | 'notes', label: string, value: string): void {
    const marker = selectedId ? store.get(selectedId) : undefined;
    if (!marker) return;
    const id = marker.id;
    history.pushMergeable(label, `marker:${id}:${field}`, marker[field], value, (v) =>
      store.update(id, { [field]: v }),
    );
  }

  // ---------- Rendering ----------

  function render(): void {
    renderer.sync(store.all(), layers.all(), store.getView());

    const counts = new Map<MarkerType, number>();
    for (const m of store.all()) counts.set(m.type, (counts.get(m.type) ?? 0) + 1);
    viewPanel.render(store.getView(), counts);

    renderDetails();
    drawing.refresh(); // marker counts in the layers list
  }

  function renderDetails(): void {
    const marker = selectedId ? store.get(selectedId) : undefined;
    if (!marker) {
      sidebar.clearDetails(details.element);
      return;
    }
    const east = formatDistance(marker.x * mapScale.kmPerUnit);
    const south = formatDistance(marker.y * mapScale.kmPerUnit);
    details.render(marker, `${getMarkerType(marker.type).icon} ${east} east · ${south} south`);
    sidebar.setDetails(details.element, 'Marker');
  }

  store.onChange(render);
  layers.onChange(() => {
    renderer.sync(store.all(), layers.all(), store.getView());
    refreshSelection();
  });
  mapScale.onChange(renderDetails);

  drawing.registerLayerContent({
    removeFromLayer: (layerId) => {
      const removed = store.removeWhere((m) => m.layerId === layerId);
      return () => restore(removed);
    },
    count: (layerId) => store.all().filter((m) => m.layerId === layerId).length,
  });

  function restore(removed: RemovedMarker[]): void {
    for (let i = removed.length - 1; i >= 0; i--) store.insert(removed[i].marker, removed[i].index);
  }

  // ---------- Selection ----------

  function select(id: string | null): void {
    selectedId = id;
    renderer.setSelected(id);
    renderDetails();
  }

  function isMarkerEditable(marker: Marker): boolean {
    const layer = layers.get(marker.layerId);
    return (
      layer !== undefined &&
      isLayerEditable(layer) &&
      !store.getView().hiddenTypes.includes(marker.type)
    );
  }

  function refreshSelection(): void {
    const marker = selectedId ? store.get(selectedId) : undefined;
    if (selectedId && (!marker || !isMarkerEditable(marker))) select(null);
    else renderDetails();
  }

  function deleteSelection(): void {
    if (!selectedId) return;
    const removed = store.remove(selectedId);
    select(null);
    if (!removed) return;
    history.push({
      label: 'Delete marker',
      undo: () => store.insert(removed.marker, removed.index),
      redo: () => store.remove(removed.marker.id),
    });
    sidebar.setStatus(`Deleted "${removed.marker.name}"`);
  }

  function duplicateSelection(): void {
    const marker = selectedId ? store.get(selectedId) : undefined;
    if (!marker) return;
    const offset = 20 / viewport.getScale();
    const copy: Marker = {
      ...marker,
      id: crypto.randomUUID(),
      name: `${marker.name} (copy)`,
      x: marker.x + offset,
      y: marker.y + offset,
    };
    store.insert(copy);
    history.push({
      label: 'Duplicate marker',
      undo: () => store.remove(copy.id),
      redo: () => store.insert(copy),
    });
    select(copy.id);
    sidebar.setStatus(`Duplicated "${marker.name}"`);
  }

  // ---------- Placing ----------

  /** Where a new marker goes: the active markers layer, another markers layer, or a new one. */
  function findTargetLayer(): { layer: Layer; created: boolean } | string {
    const active = layers.getActive();
    if (active.kind === 'markers') {
      if (isLayerEditable(active)) return { layer: active, created: false };
      return `"${active.name}" is ${active.visible ? 'locked' : 'hidden'} — unlock/show it to add markers`;
    }

    const markerLayers = layers.all().filter((l) => l.kind === 'markers');
    const editable = [...markerLayers].reverse().find(isLayerEditable);
    if (editable) return { layer: editable, created: false };
    if (markerLayers.length > 0) {
      return 'All marker layers are locked or hidden — unlock/show one to add markers';
    }

    // First marker: create the "Markers" layer automatically.
    return { layer: createMarkerLayerData(), created: true };
  }

  function defaultName(type: MarkerType): string {
    const count = store.all().filter((m) => m.type === type).length;
    return `${getMarkerType(type).name} ${count + 1}`;
  }

  function placeMarker(x: number, y: number): void {
    const target = findTargetLayer();
    if (typeof target === 'string') {
      sidebar.setStatus(target);
      return;
    }

    const { layer, created } = target;
    const layerIndex = layers.all().length;
    const marker = createMarker(layer.id, newType, defaultName(newType), x, y);

    if (created) layers.insert(layer, layerIndex);
    store.insert(marker);

    history.push({
      label: 'Add marker',
      undo: () => {
        store.remove(marker.id);
        if (created) layers.remove(layer.id);
      },
      redo: () => {
        if (created) layers.insert(layer, layerIndex);
        store.insert(marker);
      },
    });

    if (store.getView().hiddenTypes.includes(newType)) store.setTypeHidden(newType, false);
    drawing.clearSelection();
    select(marker.id);
    details.focusName();
    sidebar.setStatus(
      created ? `Created the "${layer.name}" layer and added "${marker.name}"` : `Added "${marker.name}"`,
    );
  }

  // ---------- Mouse: select, drag, place ----------

  let drag: {
    pointerId: number;
    id: string;
    offsetX: number;
    offsetY: number;
    fromX: number;
    fromY: number;
    moved: boolean;
  } | null = null;

  // Capture phase: runs before the stroke tools, so clicking a marker doesn't select a stroke.
  svg.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || viewport.isPanKeyDown()) return;
      const tool = options.getActiveTool();
      if (tool !== 'select' && tool !== 'marker') return;

      const p = viewport.screenToWorld(e.clientX, e.clientY);
      const el = e.target instanceof Element ? e.target.closest('[data-marker-id]') : null;
      const marker = el ? store.get(el.getAttribute('data-marker-id') ?? '') : undefined;

      if (marker && isMarkerEditable(marker)) {
        e.preventDefault();
        drawing.clearSelection();
        select(marker.id);
        svg.setPointerCapture(e.pointerId);
        drag = {
          pointerId: e.pointerId,
          id: marker.id,
          offsetX: p.x - marker.x,
          offsetY: p.y - marker.y,
          fromX: marker.x,
          fromY: marker.y,
          moved: false,
        };
        return;
      }

      if (tool === 'select') {
        select(null); // the stroke select tool handles the rest
        return;
      }

      e.preventDefault();
      placeMarker(p.x, p.y);
    },
    { capture: true },
  );

  svg.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    drag.moved = true;
    store.update(drag.id, { x: p.x - drag.offsetX, y: p.y - drag.offsetY });
  });

  const endDrag = (e: PointerEvent): void => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);

    const marker = store.get(drag.id);
    if (drag.moved && marker) {
      const { id, fromX, fromY } = drag;
      const toX = marker.x;
      const toY = marker.y;
      history.push({
        label: 'Move marker',
        undo: () => store.update(id, { x: fromX, y: fromY }),
        redo: () => store.update(id, { x: toX, y: toY }),
      });
    }
    drag = null;
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  // ---------- Tools ----------

  function onToolChange(id: ToolId): void {
    sidebar.setMarkerToolVisible(id === 'marker');
    if (id !== 'select' && id !== 'marker') select(null);
  }

  render();

  return {
    store,
    setZoom: (scale) => renderer.setZoom(scale),
    onToolChange,
    hasSelection: () => selectedId !== null,
    deleteSelection,
    duplicateSelection,
    focus: (id, shouldSelect) => {
      const marker = store.get(id);
      if (!marker) return;
      viewport.centerOn(marker.x, marker.y, Math.max(viewport.getScale(), 1.2));
      if (shouldSelect && isMarkerEditable(marker)) {
        drawing.clearSelection();
        select(id);
      }
    },
    highlight: (id) => renderer.setSelected(id ?? selectedId),
    markerFromEvent: (e) => {
      const el = e.target instanceof Element ? e.target.closest('[data-marker-id]') : null;
      const marker = el ? store.get(el.getAttribute('data-marker-id') ?? '') : undefined;
      if (!marker) return null;
      const layer = layers.get(marker.layerId);
      const visible = !!layer?.visible && !store.getView().hiddenTypes.includes(marker.type);
      return visible ? marker : null;
    },
    clearSelection: () => select(null),
    refreshSelection,
  };
}
