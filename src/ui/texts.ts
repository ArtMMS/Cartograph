import type { History } from '../core/history';
import { createTextLayer as createTextLayerData, isLayerEditable, type Layer } from '../core/layer';
import type { MarkerStore } from '../core/marker-store';
import { createText, type MapText } from '../core/text';
import { TextStore, type RemovedText, type TextPatch } from '../core/text-store';
import type { Viewport } from '../core/viewport';
import type { ToolId } from '../tools/tool-ids';
import type { Drawing } from './drawing';
import type { MapView } from './map-view';
import type { Sidebar } from './sidebar';
import { createTextLayer } from './text-layer';
import { createTextPanel } from './text-panel';

export interface TextsOptions {
  mapView: MapView;
  viewport: Viewport;
  sidebar: Sidebar;
  history: History;
  drawing: Drawing;
  markers: MarkerStore;
  getActiveTool: () => ToolId;
}

export interface Texts {
  store: TextStore;
  onToolChange(id: ToolId): void;
  hasSelection(): boolean;
  deleteSelection(): void;
  duplicateSelection(): void;
  clearSelection(): void;
  refreshSelection(): void;
  /** View mode: the visible text under the mouse, if any. */
  textFromEvent(e: Event): MapText | null;
}

/** Free texts on the map: Text tool (T), editing, moving, linking to a marker. */
export function createTexts(options: TextsOptions): Texts {
  const { mapView, viewport, sidebar, history, drawing } = options;
  const layers = drawing.layers;
  const svg = mapView.svg;

  const store = new TextStore();
  const renderer = createTextLayer((id) => drawing.getLayerGroup(id));
  let selectedId: string | null = null;

  const panel = createTextPanel({
    onChange: (patch, key) => {
      const text = selectedId ? store.get(selectedId) : undefined;
      if (!text) return;
      const id = text.id;
      const before: TextPatch = {};
      for (const k of Object.keys(patch) as (keyof TextPatch)[]) {
        (before as Record<string, unknown>)[k] = text[k];
      }
      history.pushMergeable('Edit text', `text:${id}:${key}`, before, patch as TextPatch, (v) =>
        store.update(id, v),
      );
    },
    onDuplicate: () => duplicateSelection(),
    onDelete: () => deleteSelection(),
  });

  // ---------- Rendering ----------

  function render(): void {
    renderer.sync(store.all(), layers.all());
    renderDetails();
    drawing.refresh();
  }

  function renderDetails(): void {
    const text = selectedId ? store.get(selectedId) : undefined;
    if (!text) {
      sidebar.clearDetails(panel.element);
      return;
    }
    panel.render(text, options.markers.all());
    sidebar.setDetails(panel.element, 'Text');
  }

  store.onChange(render);
  layers.onChange(() => {
    renderer.sync(store.all(), layers.all());
    refreshSelection();
  });
  options.markers.onChange(renderDetails);

  drawing.registerLayerContent({
    removeFromLayer: (layerId) => {
      const removed = store.removeWhere((t) => t.layerId === layerId);
      return () => restore(removed);
    },
    count: (layerId) => store.all().filter((t) => t.layerId === layerId).length,
  });

  function restore(removed: RemovedText[]): void {
    for (let i = removed.length - 1; i >= 0; i--) store.insert(removed[i].text, removed[i].index);
  }

  // ---------- Selection ----------

  function select(id: string | null): void {
    selectedId = id;
    renderer.setSelected(id);
    renderDetails();
  }

  function isEditable(text: MapText): boolean {
    const layer = layers.get(text.layerId);
    return layer !== undefined && isLayerEditable(layer);
  }

  function refreshSelection(): void {
    const text = selectedId ? store.get(selectedId) : undefined;
    if (selectedId && (!text || !isEditable(text))) select(null);
    else renderDetails();
  }

  function deleteSelection(): void {
    if (!selectedId) return;
    const removed = store.remove(selectedId);
    select(null);
    if (!removed) return;
    history.push({
      label: 'Delete text',
      undo: () => store.insert(removed.text, removed.index),
      redo: () => store.remove(removed.text.id),
    });
  }

  function duplicateSelection(): void {
    const text = selectedId ? store.get(selectedId) : undefined;
    if (!text) return;
    const offset = 20 / viewport.getScale();
    const copy: MapText = { ...text, id: crypto.randomUUID(), x: text.x + offset, y: text.y + offset };
    store.insert(copy);
    history.push({
      label: 'Duplicate text',
      undo: () => store.remove(copy.id),
      redo: () => store.insert(copy),
    });
    select(copy.id);
  }

  // ---------- Placing ----------

  function findTargetLayer(): { layer: Layer; created: boolean } | string {
    const active = layers.getActive();
    if (active.kind === 'texts') {
      if (isLayerEditable(active)) return { layer: active, created: false };
      return `"${active.name}" is ${active.visible ? 'locked' : 'hidden'} — unlock/show it to add text`;
    }
    const textLayers = layers.all().filter((l) => l.kind === 'texts');
    const editable = [...textLayers].reverse().find(isLayerEditable);
    if (editable) return { layer: editable, created: false };
    if (textLayers.length > 0) return 'All text layers are locked or hidden';
    return { layer: createTextLayerData(), created: true };
  }

  function placeText(x: number, y: number): void {
    const target = findTargetLayer();
    if (typeof target === 'string') {
      sidebar.setStatus(target);
      return;
    }
    const { layer, created } = target;
    const layerIndex = layers.all().length;
    // ~18 px on screen at the current zoom.
    const size = Math.max(4, Math.round(18 / viewport.getScale()));
    const text = createText(layer.id, x, y, size);

    if (created) layers.insert(layer, layerIndex);
    store.insert(text);
    history.push({
      label: 'Add text',
      undo: () => {
        store.remove(text.id);
        if (created) layers.remove(layer.id);
      },
      redo: () => {
        if (created) layers.insert(layer, layerIndex);
        store.insert(text);
      },
    });
    drawing.clearSelection();
    select(text.id);
    panel.focusText();
    sidebar.setStatus(created ? `Created the "${layer.name}" layer` : 'Text added — type it in the panel');
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

  function textAt(e: Event): MapText | undefined {
    const el = e.target instanceof Element ? e.target.closest('[data-text-id]') : null;
    return el ? store.get(el.getAttribute('data-text-id') ?? '') : undefined;
  }

  // Capture phase: texts win over strokes and regions underneath.
  svg.addEventListener(
    'pointerdown',
    (e) => {
      if (e.button !== 0 || viewport.isPanKeyDown() || e.defaultPrevented) return;
      const tool = options.getActiveTool();
      if (tool !== 'select' && tool !== 'text') return;

      const p = viewport.screenToWorld(e.clientX, e.clientY);
      const text = textAt(e);

      if (text && isEditable(text)) {
        e.preventDefault();
        drawing.clearSelection();
        select(text.id);
        svg.setPointerCapture(e.pointerId);
        drag = {
          pointerId: e.pointerId,
          id: text.id,
          offsetX: p.x - text.x,
          offsetY: p.y - text.y,
          fromX: text.x,
          fromY: text.y,
          moved: false,
        };
        return;
      }

      if (tool === 'select') {
        select(null);
        return;
      }
      e.preventDefault();
      placeText(p.x, p.y);
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
    const text = store.get(drag.id);
    if (drag.moved && text) {
      const { id, fromX, fromY } = drag;
      const toX = text.x;
      const toY = text.y;
      history.push({
        label: 'Move text',
        undo: () => store.update(id, { x: fromX, y: fromY }),
        redo: () => store.update(id, { x: toX, y: toY }),
      });
    }
    drag = null;
  };
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);

  function onToolChange(id: ToolId): void {
    if (id !== 'select' && id !== 'text') select(null);
  }

  render();

  return {
    store,
    onToolChange,
    hasSelection: () => selectedId !== null,
    deleteSelection,
    duplicateSelection,
    clearSelection: () => select(null),
    refreshSelection,
    textFromEvent: (e) => {
      const text = textAt(e);
      if (!text) return null;
      return layers.get(text.layerId)?.visible ? text : null;
    },
  };
}
