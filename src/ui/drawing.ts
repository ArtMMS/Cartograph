import type { History } from '../core/history';
import type { LoadedImage } from '../core/background';
import {
  BASE_LAYER_ID,
  createImageLayer,
  createLayer,
  isLayerEditable,
  type Layer,
} from '../core/layer';
import { LayerStore, type LayerPatch } from '../core/layer-store';
import { mapScale } from '../core/map-scale';
import type { PalettePreset } from '../core/palette';
import {
  cloneStroke,
  createArea,
  createDefaultBrush,
  type Brush,
  type Stroke,
  type StrokePoint,
} from '../core/stroke';
import type { DrawStyle } from '../core/stroke-style';
import { loadSnapSettings, saveSnapSettings } from '../core/snap';
import { StrokeStore, type RemovedStroke, type StrokePatch } from '../core/stroke-store';
import type { Viewport } from '../core/viewport';
import { attachEraser } from '../tools/eraser';
import { attachPencil } from '../tools/pencil';
import { attachSelect } from '../tools/select';
import type { ToolId } from '../tools/tool-ids';
import { createBrushPanel } from './brush-panel';
import { createLayersPanel } from './layers-panel';
import { createSnapPanel } from './snap-panel';
import type { MapView } from './map-view';
import type { Sidebar } from './sidebar';
import { createStrokeLayer } from './stroke-layer';

/** Quick repeated edits (e.g. dragging a slider or color picker) merge into one undo step. */
const MERGE_WINDOW_MS = 1000;

export interface DrawingOptions {
  mapView: MapView;
  viewport: Viewport;
  sidebar: Sidebar;
  history: History;
  getActiveTool: () => ToolId;
}

export interface Drawing {
  strokes: StrokeStore;
  layers: LayerStore;
  /** Adds an uploaded image as a new layer (just above Base) and makes it active. */
  addImageLayer(image: LoadedImage): Layer;
  /** Deletes a layer and its strokes (undoable). */
  deleteLayer(id: string): void;
  /** Registers other content stored in layers (e.g. markers). */
  registerLayerContent(content: LayerContent): void;
  /** Redraws the layers list (e.g. after markers change). */
  refresh(): void;
  /** The SVG group of a layer (markers draw inside it). */
  getLayerGroup(layerId: string): SVGGElement | undefined;
  /** Replaces everything (opening a file or starting a new map). */
  loadState(layers: Layer[], strokes: Stroke[], activeLayerId: string): void;
  /** Call when the active tool changes. */
  onToolChange(id: ToolId): void;
  deleteSelection(): void;
  /** Copies the selected stroke (Ctrl+D). */
  duplicateSelection(): void;
  clearSelection(): void;
  /** True when a stroke is selected. */
  hasSelection(): boolean;
  /** Call after undo/redo, in case the selected stroke no longer exists. */
  refreshSelection(): void;
}

/** Other things stored in layers (markers…), so deleting a layer also removes them. */
export interface LayerContent {
  /** Removes everything in the layer; returns a function that puts it back. */
  removeFromLayer(layerId: string): () => void;
  /** How many items the layer holds (shown in the layers list). */
  count(layerId: string): number;
}

/** Strokes and layers: pencil, select, eraser, brush/selection/layers panels, undo steps. */
export function createDrawing(options: DrawingOptions): Drawing {
  const { mapView, viewport, sidebar, history } = options;

  const strokes = new StrokeStore();
  const layers = new LayerStore();
  const layer = createStrokeLayer(mapView.layers.drawing);
  const brush: Brush = createDefaultBrush();
  let selectedId: string | null = null;

  // ---------- Helpers ----------

  /** Strokes that can be selected/erased (their layer is visible and unlocked). */
  function editableStrokes(): Stroke[] {
    return strokes.all().filter((s) => {
      const l = layers.get(s.layerId);
      return l !== undefined && isLayerEditable(l);
    });
  }

  function pushMergeable<T>(
    label: string,
    key: string,
    before: T,
    after: T,
    apply: (value: T) => void,
  ): void {
    history.pushMergeable(label, key, before, after, apply, MERGE_WINDOW_MS);
  }

  // ---------- Other content living in layers (e.g. markers) ----------

  const contents: LayerContent[] = [];

  // ---------- Stroke actions ----------

  /**
   * Adds a finished stroke. If it closes a shape (its end snapped to its own
   * start, or to a chain of same-style strokes leading back to its start),
   * a filled area is added under the outline automatically.
   */
  function addStroke(stroke: Stroke): boolean {
    strokes.insert(stroke);

    const loop = findClosedLoop(stroke);
    let area: Stroke | null = null;
    let areaIndex = 0;
    if (loop) {
      const element: DrawStyle = stroke.style === 'area' ? 'line' : (stroke.style ?? 'line');
      area = createArea(stroke.layerId, loop.outline, stroke.color, stroke.size, element);
      areaIndex = loop.firstIndex;
      strokes.insert(area, areaIndex);
    }

    history.push({
      label: area ? 'Draw closed shape' : 'Draw',
      undo: () => {
        strokes.remove(stroke.id);
        if (area) strokes.remove(area.id);
      },
      redo: () => {
        if (area) strokes.insert(area, areaIndex);
        strokes.insert(stroke);
      },
    });
    return area !== null;
  }

  /** Exact key of a line end (snapping copies coordinates exactly). */
  function endKey(p: StrokePoint): string {
    return `${p[0].toFixed(3)},${p[1].toFixed(3)}`;
  }

  /**
   * If `stroke` closes a shape, returns the outline and the drawing index of
   * the first stroke of the loop (the fill goes under it).
   */
  function findClosedLoop(stroke: Stroke): { outline: StrokePoint[]; firstIndex: number } | null {
    const pts = stroke.points;
    if (pts.length < 3 || stroke.style === 'area') return null;
    const start = endKey(pts[0]);
    const end = endKey(pts[pts.length - 1]);
    const indexOf = (s: Stroke): number => strokes.all().indexOf(s);

    // A single stroke that ends on its own start.
    if (start === end) {
      return pts.length > 8 ? { outline: pts.slice(0, -1), firstIndex: indexOf(stroke) } : null;
    }

    // A chain of strokes (same layer and style) connected end to end.
    const candidates = strokes
      .all()
      .filter(
        (s) =>
          s !== stroke &&
          s.layerId === stroke.layerId &&
          (s.style ?? 'line') === (stroke.style ?? 'line') &&
          s.points.length > 1,
      );

    type Step = { stroke: Stroke; reversed: boolean };
    const queue: { node: string; path: Step[] }[] = [{ node: end, path: [] }];
    const visited = new Set<string>([end]);

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      for (const s of candidates) {
        if (path.some((step) => step.stroke === s)) continue;
        const a = endKey(s.points[0]);
        const b = endKey(s.points[s.points.length - 1]);
        let next: string | null = null;
        let reversed = false;
        if (a === node) next = b;
        else if (b === node) {
          next = a;
          reversed = true;
        }
        if (next === null) continue;

        const newPath = [...path, { stroke: s, reversed }];
        if (next === start) {
          // Found the way back: outline = new stroke + the chain.
          const outline: StrokePoint[] = [...pts];
          for (const step of newPath) {
            const p = step.reversed ? [...step.stroke.points].reverse() : step.stroke.points;
            outline.push(...p.slice(1));
          }
          outline.pop(); // last point == first point
          const firstIndex = Math.min(indexOf(stroke), ...newPath.map((st) => indexOf(st.stroke)));
          return { outline, firstIndex };
        }
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ node: next, path: newPath });
        }
      }
    }
    return null;
  }

  function restoreStrokes(removed: RemovedStroke[]): void {
    // Reverse order so every stroke goes back to its exact place.
    for (let i = removed.length - 1; i >= 0; i--) {
      strokes.insert(removed[i].stroke, removed[i].index);
    }
  }

  function pushRemoval(label: string, removed: RemovedStroke[]): void {
    if (removed.length === 0) return;
    history.push({
      label,
      undo: () => restoreStrokes(removed),
      redo: () => {
        for (const r of removed) strokes.remove(r.stroke.id);
      },
    });
  }

  function updateStroke(id: string, patch: StrokePatch): void {
    const stroke = strokes.get(id);
    if (!stroke) return;
    // Filled areas keep their "area" style: a style change changes what they're filled with.
    if (stroke.style === 'area' && patch.style) {
      const { style, ...rest } = patch;
      patch = { ...rest, element: style === 'area' ? stroke.element : style };
    }
    const before: StrokePatch = {
      color: stroke.color,
      size: stroke.size,
      style: stroke.style ?? 'line',
      element: stroke.element,
    };
    const after: StrokePatch = { ...before, ...patch };
    pushMergeable('Edit stroke', `stroke:${id}`, before, after, (value) =>
      strokes.update(id, value),
    );
  }

  // ---------- Layer actions ----------

  function nextLayerName(): string {
    const names = new Set(layers.all().map((l) => l.name));
    let n = layers.all().length;
    while (names.has(`Layer ${n}`)) n++;
    return `Layer ${n}`;
  }

  function addLayer(): void {
    const newLayer = createLayer(nextLayerName());
    const previousActive = layers.getActive().id;
    const index = layers.all().length;

    layers.insert(newLayer, index);
    layers.setActive(newLayer.id);

    history.push({
      label: 'New layer',
      undo: () => {
        layers.remove(newLayer.id);
        layers.setActive(previousActive);
      },
      redo: () => {
        layers.insert(newLayer, index);
        layers.setActive(newLayer.id);
      },
    });
    sidebar.setStatus(`Created "${newLayer.name}"`);
  }

  function addImageLayer(image: LoadedImage): Layer {
    const newLayer = createImageLayer(image);
    const previousActive = layers.getActive().id;
    const index = 1; // just above Base, under the drawing layers

    layers.insert(newLayer, index);
    layers.setActive(newLayer.id);

    history.push({
      label: 'Add image',
      undo: () => {
        layers.remove(newLayer.id);
        layers.setActive(previousActive);
      },
      redo: () => {
        layers.insert(newLayer, index);
        layers.setActive(newLayer.id);
      },
    });
    return newLayer;
  }

  function deleteLayer(id: string): void {
    if (id === BASE_LAYER_ID) return;
    const target = layers.get(id);
    if (!target) return;

    const wasActive = layers.getActive().id === id;
    const removedStrokes = strokes.removeWhere((s) => s.layerId === id);
    let restoreContents = contents.map((c) => c.removeFromLayer(id));
    const removedLayer = layers.remove(id);
    if (!removedLayer) return;

    history.push({
      label: 'Delete layer',
      undo: () => {
        layers.insert(removedLayer.layer, removedLayer.index);
        restoreStrokes(removedStrokes);
        for (const restore of restoreContents) restore();
        if (wasActive) layers.setActive(id);
      },
      redo: () => {
        strokes.removeWhere((s) => s.layerId === id);
        restoreContents = contents.map((c) => c.removeFromLayer(id));
        layers.remove(id);
      },
    });
    refreshSelection();
    sidebar.setStatus(`Deleted "${target.name}" (Ctrl+Z to undo)`);
  }

  function renameLayer(id: string, name: string): void {
    const target = layers.get(id);
    if (!target) return;
    const before = target.name;
    layers.update(id, { name });
    history.push({
      label: 'Rename layer',
      undo: () => layers.update(id, { name: before }),
      redo: () => layers.update(id, { name }),
    });
  }

  function moveLayer(id: string, direction: 1 | -1): void {
    const from = layers.indexOf(id);
    const to = from + direction;
    if (from <= 0 || to <= 0 || to >= layers.all().length) return;

    layers.move(id, to);
    history.push({
      label: 'Move layer',
      undo: () => layers.move(id, from),
      redo: () => layers.move(id, to),
    });
  }

  function toggleLayer(id: string, key: 'visible' | 'locked'): void {
    const target = layers.get(id);
    if (!target) return;
    const patch: LayerPatch = { [key]: !target[key] };
    layers.update(id, patch);
    refreshSelection();
  }

  function setBaseColor(color: string): void {
    const base = layers.get(BASE_LAYER_ID);
    if (!base) return;
    pushMergeable('Paper color', 'base-color', base.color ?? '#ffffff', color, (value) =>
      layers.update(BASE_LAYER_ID, { color: value }),
    );
  }

  // ---------- Selection ----------

  function select(id: string | null): void {
    selectedId = id;
    layer.setSelected(id);
    renderSelectionPanel();
  }

  function renderSelectionPanel(): void {
    const stroke = selectedId ? strokes.get(selectedId) : undefined;
    sidebar.setSelectionVisible(!!stroke);
    if (stroke) {
      const style = stroke.style === 'area' ? (stroke.element ?? 'line') : (stroke.style ?? 'line');
      selectionPanel.render({ color: stroke.color, size: stroke.size, style });
    }
  }

  function deleteSelection(): void {
    if (!selectedId) return;
    const removed = strokes.remove(selectedId);
    select(null);
    if (removed) {
      pushRemoval('Delete stroke', [removed]);
      sidebar.setStatus('Stroke deleted');
    }
  }

  /** Clears the selection if the stroke is gone or its layer became hidden/locked. */
  function refreshSelection(): void {
    if (!selectedId) return;
    const stroke = strokes.get(selectedId);
    const strokeLayer = stroke ? layers.get(stroke.layerId) : undefined;
    if (!stroke || !strokeLayer || !isLayerEditable(strokeLayer)) select(null);
    else renderSelectionPanel();
  }

  // ---------- Panels ----------

  const brushPanel = createBrushPanel({
    onColor: (color) => {
      brush.color = color;
      brushPanel.render(brush);
    },
    onSize: (size) => {
      brush.size = size;
      brushPanel.render(brush);
    },
    onStyle: (style) => {
      brush.style = style;
      brushPanel.render(brush);
    },
    onPreset: (preset: PalettePreset) => {
      brush.color = preset.color;
      brush.size = preset.size;
      brush.style = preset.style;
      brushPanel.render(brush);
    },
  });
  sidebar.brushSlot.append(brushPanel.element);
  brushPanel.render(brush);

  // Snap settings (a personal preference, saved in the browser).
  let snap = loadSnapSettings();
  const snapPanel = createSnapPanel((settings) => {
    snap = settings;
    saveSnapSettings(settings);
    snapPanel.render(snap);
  });
  sidebar.brushSlot.append(snapPanel.element);
  snapPanel.render(snap);

  const selectionPanel = createBrushPanel({
    onColor: (color) => selectedId && updateStroke(selectedId, { color }),
    onSize: (size) => selectedId && updateStroke(selectedId, { size }),
    onStyle: (style) => selectedId && updateStroke(selectedId, { style }),
    onPreset: (preset) =>
      selectedId &&
      updateStroke(selectedId, { color: preset.color, size: preset.size, style: preset.style }),
  });

  const selectionButtons = document.createElement('div');
  selectionButtons.className = 'button-row selection-buttons';
  const duplicateButton = document.createElement('button');
  duplicateButton.type = 'button';
  duplicateButton.className = 'panel-button';
  duplicateButton.textContent = '⧉ Duplicate (Ctrl+D)';
  duplicateButton.addEventListener('click', () => duplicateSelection());
  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'panel-button panel-button--danger';
  deleteButton.textContent = '🗑 Delete (Del)';
  deleteButton.addEventListener('click', deleteSelection);
  selectionButtons.append(duplicateButton, deleteButton);
  const moveHint = document.createElement('p');
  moveHint.className = 'marker-types__hint';
  moveHint.textContent = 'Drag the stroke on the map to move it';
  sidebar.selectionSlot.append(selectionPanel.element, selectionButtons, moveHint);

  const layersPanel = createLayersPanel({
    onAdd: addLayer,
    onActivate: (id) => layers.setActive(id),
    onRename: renameLayer,
    onDelete: deleteLayer,
    onToggleVisible: (id) => toggleLayer(id, 'visible'),
    onToggleLock: (id) => toggleLayer(id, 'locked'),
    onMove: moveLayer,
    onBaseColor: setBaseColor,
  });
  sidebar.layersSlot.append(layersPanel.element);

  // ---------- Keep everything in sync ----------

  function renderAll(): void {
    layer.sync(strokes.all(), layers.all());

    const base = layers.get(BASE_LAYER_ID);
    mapView.setPaperColor(base?.visible ? (base.color ?? '#ffffff') : null);

    const counts = new Map<string, number>();
    for (const s of strokes.all()) counts.set(s.layerId, (counts.get(s.layerId) ?? 0) + 1);
    for (const l of layers.all()) {
      for (const c of contents) counts.set(l.id, (counts.get(l.id) ?? 0) + c.count(l.id));
    }
    layersPanel.render(layers.all(), layers.getActive().id, counts);

    if (selectedId) renderSelectionPanel();
  }

  strokes.onChange(renderAll);
  layers.onChange(renderAll);
  renderAll();

  // ---------- Tools ----------

  attachPencil({
    svg: mapView.svg,
    viewport,
    isActive: () => options.getActiveTool() === 'pencil',
    getTarget: () => {
      const active: Layer = layers.getActive();
      if (active.kind !== 'draw') {
        const kinds = { image: 'an image', markers: 'a marker', regions: 'a region' } as const;
        const kind = kinds[active.kind];
        return `"${active.name}" is ${kind} layer — select a drawing layer to draw`;
      }
      if (!active.visible) return `"${active.name}" is hidden — show it to draw`;
      if (active.locked) return `"${active.name}" is locked — unlock it to draw`;
      return { brush, layerId: active.id };
    },
    onBlocked: (reason) => sidebar.setStatus(reason),
    onPreview: (stroke) => layer.setPreview(stroke),
    findSnap: (x, y, extra) => (snap.enabled ? findSnapPoint(x, y, extra) : null),
    onSnapHint: (point) => layer.setSnapHint(point, 7 / viewport.getScale()),
    onCommit: (stroke) => {
      const closed = addStroke(stroke);
      sidebar.setStatus(
        closed
          ? 'Closed shape — filled automatically (Ctrl+Z to undo)'
          : `Drew on "${layers.get(stroke.layerId)?.name ?? '?'}"`,
      );
    },
  });

  attachSelect({
    svg: mapView.svg,
    viewport,
    isActive: () => options.getActiveTool() === 'select',
    getStrokes: editableStrokes,
    onSelect: select,
    onDrag: (id, dx, dy) => {
      const stroke = strokes.get(id);
      if (!stroke) return;
      if (!dragOrigin || dragOrigin.id !== id) dragOrigin = { id, points: stroke.points };
      strokes.update(id, { points: translatePoints(dragOrigin.points, dx, dy) });
    },
    onDragEnd: (id) => {
      const stroke = strokes.get(id);
      if (!stroke || !dragOrigin || dragOrigin.id !== id) return;
      const before = dragOrigin.points;
      const after = stroke.points;
      dragOrigin = null;
      history.push({
        label: 'Move stroke',
        undo: () => strokes.update(id, { points: before }),
        redo: () => strokes.update(id, { points: after }),
      });
    },
  });

  let dragOrigin: { id: string; points: Stroke['points'] } | null = null;

  function translatePoints(points: Stroke['points'], dx: number, dy: number): Stroke['points'] {
    return points.map(([x, y, p]) => [x + dx, y + dy, p]);
  }

  /** Nearest line end (of strokes on visible layers) within the snap distance. */
  function findSnapPoint(x: number, y: number, extra: [number, number][]): [number, number] | null {
    const tolerance = snap.distancePx / viewport.getScale();
    let best: [number, number] | null = null;
    let bestDist = tolerance;

    const consider = (px: number, py: number): void => {
      const d = Math.hypot(px - x, py - y);
      if (d <= bestDist) {
        best = [px, py];
        bestDist = d;
      }
    };

    for (const s of strokes.all()) {
      if (s.points.length === 0 || !layers.get(s.layerId)?.visible) continue;
      const first = s.points[0];
      const last = s.points[s.points.length - 1];
      consider(first[0], first[1]);
      consider(last[0], last[1]);
    }
    for (const [px, py] of extra) consider(px, py);
    return best;
  }

  /** Copies the selected stroke a little to the side and selects the copy. */
  function duplicateSelection(): void {
    const stroke = selectedId ? strokes.get(selectedId) : undefined;
    if (!stroke) return;
    const offset = 20 / viewport.getScale();
    const copy = cloneStroke(stroke, offset, offset);
    const index = strokes.all().indexOf(stroke) + 1;
    strokes.insert(copy, index);
    history.push({
      label: 'Duplicate stroke',
      undo: () => strokes.remove(copy.id),
      redo: () => strokes.insert(copy, index),
    });
    select(copy.id);
    sidebar.setStatus('Stroke duplicated');
  }

  let erased: RemovedStroke[] = [];
  attachEraser({
    svg: mapView.svg,
    viewport,
    isActive: () => options.getActiveTool() === 'eraser',
    getStrokes: editableStrokes,
    onErase: (id) => {
      const removed = strokes.remove(id);
      if (removed) erased.push(removed);
    },
    onEnd: () => {
      if (erased.length > 0) {
        sidebar.setStatus(`Erased ${erased.length} stroke${erased.length > 1 ? 's' : ''}`);
      }
      pushRemoval('Erase', erased);
      erased = [];
    },
  });

  function loadState(newLayers: Layer[], newStrokes: Stroke[], activeLayerId: string): void {
    select(null);
    layer.setPreview(null);
    layers.replaceAll(newLayers, activeLayerId);
    strokes.replaceAll(newStrokes);
  }

  // The brush "≈ km wide" label depends on the map scale.
  mapScale.onChange(() => {
    brushPanel.render(brush);
    renderSelectionPanel();
  });

  function onToolChange(id: ToolId): void {
    sidebar.setBrushVisible(id === 'pencil');
    if (id !== 'select') select(null);
  }

  return {
    strokes,
    layers,
    addImageLayer,
    deleteLayer,
    registerLayerContent: (content) => {
      contents.push(content);
      renderAll();
    },
    refresh: renderAll,
    getLayerGroup: (layerId) => layer.getGroup(layerId),
    loadState,
    onToolChange,
    deleteSelection,
    duplicateSelection,
    clearSelection: () => select(null),
    hasSelection: () => selectedId !== null,
    refreshSelection,
  };
}
