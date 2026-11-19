import { BASE_LAYER_ID, type Layer } from '../core/layer';

export interface LayersPanelHandlers {
  onAdd(): void;
  onActivate(id: string): void;
  onRename(id: string, name: string): void;
  onDelete(id: string): void;
  onToggleVisible(id: string): void;
  onToggleLock(id: string): void;
  /** +1 = move up (towards the top), -1 = move down. */
  onMove(id: string, direction: 1 | -1): void;
  onBaseColor(color: string): void;
}

export interface LayersPanel {
  element: HTMLElement;
  /** `layers` from bottom to top; `counts` = strokes per layer. */
  render(layers: readonly Layer[], activeId: string, counts: Map<string, number>): void;
}

interface Row {
  element: HTMLLIElement;
  visible: HTMLButtonElement;
  lock: HTMLButtonElement;
  name: HTMLSpanElement;
  count: HTMLSpanElement;
  up?: HTMLButtonElement;
  down?: HTMLButtonElement;
  color?: HTMLInputElement;
}

/** The list of layers in the sidebar (top of the list = top of the map). */
export function createLayersPanel(handlers: LayersPanelHandlers): LayersPanel {
  const element = document.createElement('div');
  element.className = 'layers-panel';

  const addButton = document.createElement('button');
  addButton.type = 'button';
  addButton.className = 'panel-button layers-panel__add';
  addButton.textContent = '+ New layer';
  addButton.addEventListener('click', handlers.onAdd);

  const list = document.createElement('ul');
  list.className = 'layers-panel__list';

  const hint = document.createElement('p');
  hint.className = 'layers-panel__hint';
  hint.textContent = 'Click to make active · double-click to rename';

  element.append(addButton, list, hint);

  const rows = new Map<string, Row>();

  // ---------- Rows ----------

  function iconButton(className: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `icon-button icon-button--small ${className}`;
    button.addEventListener('click', (e) => {
      e.stopPropagation(); // don't activate the row
      onClick();
    });
    return button;
  }

  function createRow(layer: Layer): Row {
    const id = layer.id;
    const isBase = id === BASE_LAYER_ID;

    const li = document.createElement('li');
    li.className = 'layer-row';
    li.addEventListener('click', () => handlers.onActivate(id));

    const visible = iconButton('layer-row__visible', () => handlers.onToggleVisible(id));
    const lock = iconButton('layer-row__lock', () => handlers.onToggleLock(id));

    const name = document.createElement('span');
    name.className = 'layer-row__name';
    name.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startRename(row, id);
    });

    const count = document.createElement('span');
    count.className = 'layer-row__count';

    li.append(visible, lock, name, count);
    const row: Row = { element: li, visible, lock, name, count };

    if (isBase) {
      const color = document.createElement('input');
      color.type = 'color';
      color.className = 'layer-row__color';
      color.title = 'Paper color';
      color.addEventListener('click', (e) => e.stopPropagation());
      color.addEventListener('input', () => handlers.onBaseColor(color.value));
      li.append(color);
      row.color = color;
    } else {
      row.up = iconButton('layer-row__up', () => handlers.onMove(id, 1));
      row.up.textContent = '▲';
      row.up.title = 'Move up';
      row.down = iconButton('layer-row__down', () => handlers.onMove(id, -1));
      row.down.textContent = '▼';
      row.down.title = 'Move down';
      const remove = iconButton('layer-row__delete', () => handlers.onDelete(id));
      remove.textContent = '🗑';
      remove.title = 'Delete layer (Ctrl+Z to undo)';
      li.append(row.up, row.down, remove);
    }

    return row;
  }

  function startRename(row: Row, id: string): void {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'layer-row__rename';
    input.value = row.name.textContent ?? '';
    input.maxLength = 40;

    let done = false;
    const finish = (save: boolean): void => {
      if (done) return;
      done = true;
      const value = input.value.trim();
      input.replaceWith(row.name);
      if (save && value && value !== row.name.textContent) handlers.onRename(id, value);
    };

    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(true);
      if (e.key === 'Escape') finish(false);
    });
    input.addEventListener('blur', () => finish(true));

    row.name.replaceWith(input);
    input.focus();
    input.select();
  }

  // ---------- Render ----------

  function render(layers: readonly Layer[], activeId: string, counts: Map<string, number>): void {
    const ids = new Set(layers.map((l) => l.id));
    for (const [id, row] of rows) {
      if (!ids.has(id)) {
        row.element.remove();
        rows.delete(id);
      }
    }

    // The list shows the top layer first.
    const topToBottom = [...layers].reverse();

    topToBottom.forEach((layer, listIndex) => {
      let row = rows.get(layer.id);
      if (!row) {
        row = createRow(layer);
        rows.set(layer.id, row);
      }

      row.element.classList.toggle('is-active', layer.id === activeId);
      row.element.classList.toggle('is-hidden', !layer.visible);

      if (!row.element.querySelector('.layer-row__rename')) row.name.textContent = layer.name;
      row.name.title = layer.name;
      if (layer.kind === 'image') {
        row.count.textContent = '🖼';
        row.count.title = 'Image layer';
      } else {
        row.count.textContent = String(counts.get(layer.id) ?? 0);
        row.count.title = 'Strokes in this layer';
      }

      row.visible.textContent = layer.visible ? '👁' : '🚫';
      row.visible.title = layer.visible ? 'Hide layer' : 'Show layer';
      row.lock.textContent = layer.locked ? '🔒' : '🔓';
      row.lock.title = layer.locked ? 'Unlock layer' : 'Lock layer';
      row.lock.classList.toggle('is-active', layer.locked);

      if (row.color && layer.color && document.activeElement !== row.color) {
        row.color.value = layer.color;
      }

      // Bottom-most movable layer can't go down; top-most can't go up.
      const bottomIndex = topToBottom.length - 2; // just above Base
      if (row.up) row.up.disabled = listIndex === 0;
      if (row.down) row.down.disabled = listIndex === bottomIndex;

      const current = list.children[listIndex];
      if (current !== row.element) list.insertBefore(row.element, current ?? null);
    });
  }

  return { element, render };
}
