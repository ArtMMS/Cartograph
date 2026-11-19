import type { History } from '../core/history';
import type { PalettePreset } from '../core/palette';
import { createDefaultBrush, type Brush, type Stroke } from '../core/stroke';
import { StrokeStore, type RemovedStroke, type StrokePatch } from '../core/stroke-store';
import type { Viewport } from '../core/viewport';
import { attachEraser } from '../tools/eraser';
import { attachPencil } from '../tools/pencil';
import { attachSelect } from '../tools/select';
import type { ToolId } from '../tools/tool-ids';
import { createBrushPanel } from './brush-panel';
import type { MapView } from './map-view';
import type { Sidebar } from './sidebar';
import { createStrokeLayer } from './stroke-layer';

/** Quick repeated edits to the same stroke (e.g. dragging a slider) merge into one undo step. */
const MERGE_WINDOW_MS = 1000;

export interface DrawingOptions {
  mapView: MapView;
  viewport: Viewport;
  sidebar: Sidebar;
  history: History;
  getActiveTool: () => ToolId;
}

export interface Drawing {
  store: StrokeStore;
  /** Call when the active tool changes. */
  onToolChange(id: ToolId): void;
  deleteSelection(): void;
  clearSelection(): void;
  /** Call after undo/redo, in case the selected stroke no longer exists. */
  refreshSelection(): void;
}

/** Everything about strokes: pencil, select, eraser, brush and selection panels, undo steps. */
export function createDrawing(options: DrawingOptions): Drawing {
  const { mapView, viewport, sidebar, history } = options;

  const store = new StrokeStore();
  const layer = createStrokeLayer(mapView.layers.drawing);
  const brush: Brush = createDefaultBrush();
  let selectedId: string | null = null;

  store.onChange(() => layer.sync(store.all()));

  // ---------- Actions (each one creates an undo step) ----------

  function addStroke(stroke: Stroke): void {
    store.insert(stroke);
    history.push({
      label: 'Draw',
      undo: () => store.remove(stroke.id),
      redo: () => store.insert(stroke),
    });
  }

  function pushRemoval(label: string, removed: RemovedStroke[]): void {
    if (removed.length === 0) return;
    history.push({
      label,
      // Re-insert in reverse order so every stroke goes back to its exact place.
      undo: () => {
        for (let i = removed.length - 1; i >= 0; i--) {
          store.insert(removed[i].stroke, removed[i].index);
        }
      },
      redo: () => {
        for (const r of removed) store.remove(r.stroke.id);
      },
    });
  }

  function updateStroke(id: string, patch: StrokePatch): void {
    const stroke = store.get(id);
    if (!stroke) return;

    const before: StrokePatch = { color: stroke.color, size: stroke.size };
    store.update(id, patch);
    const after: StrokePatch = { color: stroke.color, size: stroke.size };

    const last = history.last() as (ReturnType<typeof makeUpdateCommand> | undefined);
    if (last?.mergeKey === id && Date.now() - last.time < MERGE_WINDOW_MS) {
      last.after = after;
      last.time = Date.now();
      return;
    }
    history.push(makeUpdateCommand(id, before, after));
  }

  function makeUpdateCommand(id: string, before: StrokePatch, after: StrokePatch) {
    return {
      label: 'Edit stroke',
      mergeKey: id,
      time: Date.now(),
      before,
      after,
      undo(): void {
        store.update(id, this.before);
      },
      redo(): void {
        store.update(id, this.after);
      },
    };
  }

  // ---------- Selection ----------

  function select(id: string | null): void {
    selectedId = id;
    layer.setSelected(id);
    renderSelectionPanel();
  }

  function renderSelectionPanel(): void {
    const stroke = selectedId ? store.get(selectedId) : undefined;
    sidebar.setSelectionVisible(!!stroke);
    if (stroke) selectionPanel.render({ color: stroke.color, size: stroke.size });
  }

  function deleteSelection(): void {
    if (!selectedId) return;
    const removed = store.remove(selectedId);
    select(null);
    if (removed) {
      pushRemoval('Delete stroke', [removed]);
      sidebar.setStatus('Stroke deleted');
    }
  }

  function refreshSelection(): void {
    if (selectedId && !store.get(selectedId)) select(null);
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

  // Keep the selection panel in sync after edits / undo.
  store.onChange(() => {
    if (selectedId) renderSelectionPanel();
  });

  // ---------- Tools ----------

  attachPencil({
    svg: mapView.svg,
    viewport,
    isActive: () => options.getActiveTool() === 'pencil',
    getBrush: () => brush,
    onPreview: (stroke) => layer.setPreview(stroke),
    onCommit: (stroke) => {
      addStroke(stroke);
      sidebar.setStatus(`Strokes: ${store.all().length}`);
    },
  });

  attachSelect({
    svg: mapView.svg,
    viewport,
    isActive: () => options.getActiveTool() === 'select',
    getStrokes: () => store.all(),
    onSelect: select,
  });

  let erased: RemovedStroke[] = [];
  attachEraser({
    svg: mapView.svg,
    viewport,
    isActive: () => options.getActiveTool() === 'eraser',
    getStrokes: () => store.all(),
    onErase: (id) => {
      const removed = store.remove(id);
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
    store,
    onToolChange,
    deleteSelection,
    clearSelection: () => select(null),
    refreshSelection,
  };
}
