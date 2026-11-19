import type { Command, History } from '../core/history';
import type { LoadedImage } from '../core/background';
import {
  BASE_LAYER_ID,
  createImageLayer,
  createLayer,
  isLayerEditable,
  type Layer,
} from '../core/layer';
import { LayerStore, type LayerPatch } from '../core/layer-store';
import type { PalettePreset } from '../core/palette';
import { createDefaultBrush, type Brush, type Stroke } from '../core/stroke';
import { StrokeStore, type RemovedStroke, type StrokePatch } from '../core/stroke-store';
import type { Viewport } from '../core/viewport';
import { attachEraser } from '../tools/eraser';
import { attachPencil } from '../tools/pencil';
import { attachSelect } from '../tools/select';
import type { ToolId } from '../tools/tool-ids';
import { createBrushPanel } from './brush-panel';
import { createLayersPanel } from './layers-panel';
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
  /** Call when the active tool changes. */
  onToolChange(id: ToolId): void;
  deleteSelection(): void;
  clearSelection(): void;
  /** Call after undo/redo, in case the selected stroke no longer exists. */
  refreshSelection(): void;
}

/** A command whose "after" state can be updated by later quick edits. */
interface MergeableCommand<T> extends Command {
  mergeKey: string;
  time: number;
  after: T;
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

  /**
   * Applies a change and records it. Quick repeated changes with the same
   * key are merged into one undo step.
   */
  function pushMergeable<T>(
    label: string,
    key: string,
    before: T,
    after: T,
    apply: (value: T) => void,
  ): void {
    apply(after);

    const last = history.last() as MergeableCommand<T> | undefined;
    if (last?.mergeKey === key && Date.now() - last.time < MERGE_WINDOW_MS) {
      last.after = after;
      last.time = Date.now();
      return;
    }

    const command: MergeableCommand<T> = {
      label,
      mergeKey: key,
      time: Date.now(),
      after,
      undo: () => apply(before),
      redo: () => apply(command.after),
    };
    history.push(command);
  }

  // ---------- Stroke actions ----------

  function addStroke(stroke: Stroke): void {
    strokes.insert(stroke);
    history.push({
      label: 'Draw',
      undo: () => strokes.remove(stroke.id),
      redo: () => strokes.insert(stroke),
    });
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
    const before: StrokePatch = { color: stroke.color, size: stroke.size };
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
    const removedLayer = layers.remove(id);
    if (!removedLayer) return;

    history.push({
      label: 'Delete layer',
      undo: () => {
        layers.insert(removedLayer.layer, removedLayer.index);
        restoreStrokes(removedStrokes);
        if (wasActive) layers.setActive(id);
      },
      redo: () => {
        strokes.removeWhere((s) => s.layerId === id);
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
    if (stroke) selectionPanel.render({ color: stroke.color, size: stroke.size });
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
    onPreset: (preset: PalettePreset) => {
      brush.color = preset.color;
      brush.size = preset.size;
      brushPanel.render(brush);
    },
  });
  sidebar.brushSlot.append(brushPanel.element);
  brushPanel.render(brush);

  const selectionPanel = createBrushPanel({
    onColor: (color) => selectedId && updateStroke(selectedId, { color }),
    onSize: (size) => selectedId && updateStroke(selectedId, { size }),
    onPreset: (preset) =>
      selectedId && updateStroke(selectedId, { color: preset.color, size: preset.size }),
  });

  const deleteButton = document.createElement('button');
  deleteButton.type = 'button';
  deleteButton.className = 'panel-button panel-button--danger selection-delete';
  deleteButton.textContent = '🗑 Delete stroke (Del)';
  deleteButton.addEventListener('click', deleteSelection);
  sidebar.selectionSlot.append(selectionPanel.element, deleteButton);

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
      if (active.kind === 'image') {
        return `"${active.name}" is an image layer — select a drawing layer to draw`;
      }
      if (!active.visible) return `"${active.name}" is hidden — show it to draw`;
      if (active.locked) return `"${active.name}" is locked — unlock it to draw`;
      return { brush, layerId: active.id };
    },
    onBlocked: (reason) => sidebar.setStatus(reason),
    onPreview: (stroke) => layer.setPreview(stroke),
    onCommit: (stroke) => {
      addStroke(stroke);
      sidebar.setStatus(`Drew on "${layers.get(stroke.layerId)?.name ?? '?'}"`);
    },
  });

  attachSelect({
    svg: mapView.svg,
    viewport,
    isActive: () => options.getActiveTool() === 'select',
    getStrokes: editableStrokes,
    onSelect: select,
  });

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

  function onToolChange(id: ToolId): void {
    sidebar.setBrushVisible(id === 'pencil');
    if (id !== 'select') select(null);
  }

  return {
    strokes,
    layers,
    addImageLayer,
    deleteLayer,
    onToolChange,
    deleteSelection,
    clearSelection: () => select(null),
    refreshSelection,
  };
}
