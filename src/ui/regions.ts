import {
  pointInPolygon,
  polygonArea,
  polygonCentroid,
  simplifyPath,
  type Point,
} from '../core/geometry';
import type { History } from '../core/history';
import { createRegionLayer as createRegionLayerData, isLayerEditable, type Layer } from '../core/layer';
import { mapScale } from '../core/map-scale';
import {
  REGION_COLORS,
  canBeParent,
  createRegion,
  getRegionType,
  type Region,
  type RegionType,
} from '../core/region';
import { RegionStore, type RegionPatch, type RemovedRegion } from '../core/region-store';
import type { Viewport } from '../core/viewport';
import type { ToolId } from '../tools/tool-ids';
import type { Drawing } from './drawing';
import type { MapView } from './map-view';
import { createRegionLayer } from './region-layer';
import { createRegionDetails, createRegionTree, createRegionTypePicker } from './region-panels';
import type { Sidebar } from './sidebar';

/** Minimum distance between recorded outline points, in screen pixels. */
const MIN_POINT_PX = 3;
/** How much the outline is simplified when finished, in screen pixels. */
const SIMPLIFY_PX = 1.5;
/** Regions smaller than this (on screen) are ignored as accidental clicks. */
const MIN_SIZE_PX = 12;

export interface RegionsOptions {
  mapView: MapView;
  viewport: Viewport;
  sidebar: Sidebar;
  history: History;
  drawing: Drawing;
  getActiveTool: () => ToolId;
}

export interface Regions {
  store: RegionStore;
  setZoom(scale: number): void;
  onToolChange(id: ToolId): void;
  hasSelection(): boolean;
  deleteSelection(): void;
  clearSelection(): void;
  refreshSelection(): void;
}

/** Regions and nations: drawing outlines, names, types, colors, hierarchy, notes, tree. */
export function createRegions(options: RegionsOptions): Regions {
  const { mapView, viewport, sidebar, history, drawing } = options;
  const layers = drawing.layers;
  const svg = mapView.svg;

  const store = new RegionStore();
  const renderer = createRegionLayer(svg, mapView.layers.overlay, (id) => drawing.getLayerGroup(id));
  renderer.setZoom(viewport.getScale());

  let newType: RegionType = 'nation';
  let selectedId: string | null = null;

  // ---------- Panels ----------

  const typePicker = createRegionTypePicker((type) => {
    newType = type;
    typePicker.render(newType);
  });
  sidebar.regionToolSlot.append(typePicker.element);
  typePicker.render(newType);

  const tree = createRegionTree({
    onToggleLabels: () => store.setShowLabels(!store.getView().showLabels),
    onToggleType: (type) => {
      const hidden = store.getView().hiddenTypes.includes(type);
      store.setTypeHidden(type, !hidden);
      refreshSelection();
    },
    onSelect: (id) => {
      const region = store.get(id);
      if (!region) return;
      if (!isRegionSelectable(region)) {
        sidebar.setStatus(`"${region.name}" is on a locked/hidden layer or its type is hidden`);
        return;
      }
      drawing.clearSelection();
      select(id);
    },
  });
  sidebar.regionsSlot.append(tree.element);

  const details = createRegionDetails({
    onName: (name) => editMergeable('name', 'Rename region', name),
    onNotes: (notes) => editMergeable('notes', 'Edit notes', notes),
    onColor: (color) => editMergeable('color', 'Region color', color),
    onType: changeType,
    onParent: changeParent,
    onDelete: () => deleteSelection(),
  });

  function editMergeable(field: 'name' | 'notes' | 'color', label: string, value: string): void {
    const region = selectedId ? store.get(selectedId) : undefined;
    if (!region) return;
    const id = region.id;
    history.pushMergeable(label, `region:${id}:${field}`, region[field], value, (v) =>
      store.update(id, { [field]: v }),
    );
  }

  /** Records a change to several regions as one undo step. */
  function pushSnapshot(label: string, ids: string[], change: () => void): void {
    const snap = (): [string, RegionPatch][] =>
      ids.flatMap((id) => {
        const r = store.get(id);
        return r ? [[id, { type: r.type, parentId: r.parentId }] as [string, RegionPatch]] : [];
      });
    const before = snap();
    change();
    const after = snap();
    history.push({
      label,
      undo: () => store.updateMany(before),
      redo: () => store.updateMany(after),
    });
  }

  function changeType(type: RegionType): void {
    const region = selectedId ? store.get(selectedId) : undefined;
    if (!region || region.type === type) return;

    const children = store.children(region.id);
    pushSnapshot('Change region type', [region.id, ...children.map((c) => c.id)], () => {
      const patches: [string, RegionPatch][] = [];
      const parent = region.parentId ? store.get(region.parentId) : undefined;
      const keepParent = parent && canBeParent(parent.type, type);
      patches.push([region.id, { type, parentId: keepParent ? region.parentId : null }]);
      // Children that are no longer smaller move up to this region's parent.
      for (const child of children) {
        if (!canBeParent(type, child.type)) {
          patches.push([child.id, { parentId: keepParent ? region.parentId : null }]);
        }
      }
      store.updateMany(patches);
    });
  }

  function changeParent(parentId: string | null): void {
    const region = selectedId ? store.get(selectedId) : undefined;
    if (!region || region.parentId === parentId) return;
    const parent = parentId ? store.get(parentId) : undefined;
    if (parentId && (!parent || !canBeParent(parent.type, region.type))) return;
    pushSnapshot('Change region parent', [region.id], () =>
      store.update(region.id, { parentId }),
    );
  }

  // ---------- Rendering ----------

  function render(): void {
    renderer.sync(store.all(), layers.all(), store.getView());
    tree.render(store.all(), store.getView(), selectedId);
    renderDetails();
    drawing.refresh(); // region counts in the layers list
  }

  function renderDetails(): void {
    const region = selectedId ? store.get(selectedId) : undefined;
    if (!region) {
      sidebar.clearDetails(details.element);
      return;
    }
    const km = mapScale.kmPerUnit;
    details.render(region, store.all(), polygonArea(region.points) * km * km);
    sidebar.setDetails(details.element, getRegionType(region.type).name);
  }

  store.onChange(render);
  layers.onChange(() => {
    renderer.sync(store.all(), layers.all(), store.getView());
    refreshSelection();
  });
  mapScale.onChange(renderDetails);

  drawing.registerLayerContent({
    removeFromLayer: (layerId) => {
      const removed = store.removeWhere((r) => r.layerId === layerId);
      return () => restore(removed);
    },
    count: (layerId) => store.all().filter((r) => r.layerId === layerId).length,
  });

  function restore(removed: RemovedRegion[]): void {
    for (let i = removed.length - 1; i >= 0; i--) store.insert(removed[i].region, removed[i].index);
  }

  // ---------- Selection ----------

  function select(id: string | null): void {
    selectedId = id;
    renderer.setSelected(id);
    tree.render(store.all(), store.getView(), selectedId);
    renderDetails();
  }

  function isRegionSelectable(region: Region): boolean {
    const layer = layers.get(region.layerId);
    return (
      layer !== undefined &&
      isLayerEditable(layer) &&
      !store.getView().hiddenTypes.includes(region.type)
    );
  }

  function refreshSelection(): void {
    const region = selectedId ? store.get(selectedId) : undefined;
    if (selectedId && (!region || !isRegionSelectable(region))) select(null);
    else renderDetails();
  }

  function deleteSelection(): void {
    const region = selectedId ? store.get(selectedId) : undefined;
    if (!region) return;

    // Children move up to the deleted region's parent.
    const children = store.children(region.id).map((c) => c.id);
    const parentId = region.parentId;
    select(null);

    store.updateMany(children.map((id) => [id, { parentId }]));
    const removed = store.remove(region.id);
    if (!removed) return;

    history.push({
      label: 'Delete region',
      undo: () => {
        store.insert(removed.region, removed.index);
        store.updateMany(children.map((id) => [id, { parentId: region.id }]));
      },
      redo: () => {
        store.updateMany(children.map((id) => [id, { parentId }]));
        store.remove(region.id);
      },
    });
    sidebar.setStatus(`Deleted "${region.name}"`);
  }

  /** Smallest selectable region containing the point. */
  function regionAt(x: number, y: number): Region | null {
    let best: Region | null = null;
    let bestArea = Infinity;
    for (const r of store.all()) {
      if (!isRegionSelectable(r) || !pointInPolygon(x, y, r.points)) continue;
      const area = polygonArea(r.points);
      if (area < bestArea) {
        best = r;
        bestArea = area;
      }
    }
    return best;
  }

  // ---------- Drawing new regions ----------

  /** Where a new region goes: the active regions layer, another one, or a new one. */
  function findTargetLayer(): { layer: Layer; created: boolean } | string {
    const active = layers.getActive();
    if (active.kind === 'regions') {
      if (isLayerEditable(active)) return { layer: active, created: false };
      return `"${active.name}" is ${active.visible ? 'locked' : 'hidden'} — unlock/show it to add regions`;
    }

    const regionLayers = layers.all().filter((l) => l.kind === 'regions');
    const editable = [...regionLayers].reverse().find(isLayerEditable);
    if (editable) return { layer: editable, created: false };
    if (regionLayers.length > 0) {
      return 'All region layers are locked or hidden — unlock/show one to add regions';
    }

    // First region: create the "Regions" layer automatically.
    return { layer: createRegionLayerData(), created: true };
  }

  /** New region layers go just above the image layers (under the drawings). */
  function regionLayerIndex(): number {
    const all = layers.all();
    let index = 1;
    all.forEach((l, i) => {
      if (l.kind === 'image') index = i + 1;
    });
    return index;
  }

  function nextColor(): string {
    return REGION_COLORS[store.all().length % REGION_COLORS.length];
  }

  function defaultName(type: RegionType): string {
    const count = store.all().filter((r) => r.type === type).length;
    return `${getRegionType(type).name} ${count + 1}`;
  }

  /** Biggest-type-first parent guess: the smallest bigger region containing the centroid. */
  function guessParent(type: RegionType, points: Point[]): string | null {
    const [cx, cy] = polygonCentroid(points);
    let best: Region | null = null;
    let bestArea = Infinity;
    for (const r of store.all()) {
      if (!canBeParent(r.type, type) || !pointInPolygon(cx, cy, r.points)) continue;
      const area = polygonArea(r.points);
      if (area < bestArea) {
        best = r;
        bestArea = area;
      }
    }
    return best?.id ?? null;
  }

  function addRegion(points: Point[]): void {
    const target = findTargetLayer();
    if (typeof target === 'string') {
      sidebar.setStatus(target);
      return;
    }

    const { layer, created } = target;
    const layerIndex = regionLayerIndex();
    const region = createRegion(
      layer.id,
      newType,
      defaultName(newType),
      nextColor(),
      points,
      guessParent(newType, points),
    );

    if (created) layers.insert(layer, layerIndex);
    store.insert(region);

    history.push({
      label: 'Add region',
      undo: () => {
        store.remove(region.id);
        if (created) layers.remove(layer.id);
      },
      redo: () => {
        if (created) layers.insert(layer, layerIndex);
        store.insert(region);
      },
    });

    if (store.getView().hiddenTypes.includes(newType)) store.setTypeHidden(newType, false);
    drawing.clearSelection();
    select(region.id);
    details.focusName();

    const parent = region.parentId ? store.get(region.parentId) : undefined;
    sidebar.setStatus(
      `${created ? `Created the "${layer.name}" layer and added` : 'Added'} "${region.name}"` +
        (parent ? ` inside "${parent.name}"` : ''),
    );
  }

  let outline: { pointerId: number; points: Point[] } | null = null;

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.defaultPrevented || options.getActiveTool() !== 'region') return;
    e.preventDefault();

    const target = findTargetLayer();
    if (typeof target === 'string') {
      sidebar.setStatus(target);
      return;
    }

    svg.setPointerCapture(e.pointerId);
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    outline = { pointerId: e.pointerId, points: [[p.x, p.y]] };
  });

  svg.addEventListener('pointermove', (e) => {
    if (!outline || e.pointerId !== outline.pointerId) return;
    const minDist = MIN_POINT_PX / viewport.getScale();
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length > 0 ? events : [e]) {
      const p = viewport.screenToWorld(ev.clientX, ev.clientY);
      const last = outline.points[outline.points.length - 1];
      if (Math.hypot(p.x - last[0], p.y - last[1]) >= minDist) outline.points.push([p.x, p.y]);
    }
    renderer.setPreview(outline.points, REGION_COLORS[store.all().length % REGION_COLORS.length]);
  });

  const finishOutline = (e: PointerEvent, cancelled: boolean): void => {
    if (!outline || e.pointerId !== outline.pointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);

    const scale = viewport.getScale();
    const points = simplifyPath(outline.points, SIMPLIFY_PX / scale).map(
      (p) => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100] as Point,
    );
    outline = null;
    renderer.setPreview(null, '');

    if (cancelled) return;
    const minArea = (MIN_SIZE_PX / scale) ** 2;
    if (points.length < 3 || polygonArea(points) < minArea) {
      sidebar.setStatus('Region too small — drag to draw an outline');
      return;
    }
    addRegion(points);
  };
  svg.addEventListener('pointerup', (e) => finishOutline(e, false));
  svg.addEventListener('pointercancel', (e) => finishOutline(e, true));

  // ---------- Clicking regions with the Select tool ----------

  // Runs after the stroke Select tool (registered later), so strokes and markers win.
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || options.getActiveTool() !== 'select' || viewport.isPanKeyDown()) return;
    if (e.defaultPrevented || drawing.hasSelection()) {
      select(null); // a marker or stroke was clicked
      return;
    }
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    select(regionAt(p.x, p.y)?.id ?? null);
  });

  // ---------- Tools ----------

  function onToolChange(id: ToolId): void {
    sidebar.setRegionToolVisible(id === 'region');
    if (id !== 'select' && id !== 'region') select(null);
  }

  render();

  return {
    store,
    setZoom: (scale) => renderer.setZoom(scale),
    onToolChange,
    hasSelection: () => selectedId !== null,
    deleteSelection,
    clearSelection: () => select(null),
    refreshSelection,
  };
}
