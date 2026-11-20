import { formatDistance } from '../core/map-scale';
import {
  REGION_TYPES,
  canBeParent,
  getRegionType,
  type Region,
  type RegionType,
  type RegionView,
} from '../core/region';
import { createNotesEditor } from './notes-editor';

// ---------- "New region" type picker (visible with the Region tool) ----------

export interface RegionTypePicker {
  element: HTMLElement;
  render(type: RegionType): void;
}

export function createRegionTypePicker(onPick: (type: RegionType) => void): RegionTypePicker {
  const element = document.createElement('div');
  element.className = 'marker-types';

  const buttons = new Map<RegionType, HTMLButtonElement>();
  for (const t of REGION_TYPES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'marker-types__button';
    button.innerHTML = `<span>${t.icon}</span><span>${t.name}</span>`;
    button.addEventListener('click', () => onPick(t.id));
    buttons.set(t.id, button);
    element.append(button);
  }

  const hint = document.createElement('p');
  hint.className = 'marker-types__hint';
  hint.textContent = 'Drag on the map to draw the outline — it closes by itself';
  element.append(hint);

  function render(type: RegionType): void {
    for (const [id, button] of buttons) button.classList.toggle('is-active', id === type);
  }

  return { element, render };
}

// ---------- Regions section: show/hide by type + tree ----------

export interface RegionTreeHandlers {
  onToggleLabels(): void;
  onToggleType(type: RegionType): void;
  onSelect(id: string): void;
}

export interface RegionTree {
  element: HTMLElement;
  render(regions: readonly Region[], view: RegionView, selectedId: string | null): void;
}

export function createRegionTree(handlers: RegionTreeHandlers): RegionTree {
  const element = document.createElement('div');
  element.className = 'region-tree';

  const labels = document.createElement('label');
  labels.className = 'marker-view__labels';
  labels.innerHTML = '<input type="checkbox" /> <span>Show region names</span>';
  const labelsInput = labels.querySelector('input')!;
  labelsInput.addEventListener('change', handlers.onToggleLabels);

  const chips = document.createElement('div');
  chips.className = 'marker-view__chips';
  const chipButtons = new Map<RegionType, HTMLButtonElement>();
  for (const t of REGION_TYPES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'marker-view__chip';
    button.addEventListener('click', () => handlers.onToggleType(t.id));
    chipButtons.set(t.id, button);
    chips.append(button);
  }

  const list = document.createElement('ul');
  list.className = 'region-tree__list';
  list.addEventListener('click', (e) => {
    const row = (e.target as Element).closest<HTMLElement>('[data-region-id]');
    if (row?.dataset.regionId) handlers.onSelect(row.dataset.regionId);
  });

  element.append(labels, chips, list);

  function render(regions: readonly Region[], view: RegionView, selectedId: string | null): void {
    labelsInput.checked = view.showLabels;

    for (const t of REGION_TYPES) {
      const button = chipButtons.get(t.id)!;
      const hidden = view.hiddenTypes.includes(t.id);
      const count = regions.filter((r) => r.type === t.id).length;
      button.classList.toggle('is-off', hidden);
      button.textContent = `${t.icon} ${t.name} ${count}`;
      button.title = `${hidden ? 'Show' : 'Hide'} ${t.name.toLowerCase()} regions`;
    }

    // Tree: regions without a (valid) parent at the top, children nested below.
    const ids = new Set(regions.map((r) => r.id));
    const byParent = new Map<string | null, Region[]>();
    for (const r of regions) {
      const parent = r.parentId && ids.has(r.parentId) ? r.parentId : null;
      if (!byParent.has(parent)) byParent.set(parent, []);
      byParent.get(parent)!.push(r);
    }

    const rows: HTMLLIElement[] = [];
    const addRows = (parentId: string | null, depth: number): void => {
      const children = [...(byParent.get(parentId) ?? [])].sort(
        (a, b) =>
          getRegionType(a.type).rank - getRegionType(b.type).rank || a.name.localeCompare(b.name),
      );
      for (const r of children) {
        const li = document.createElement('li');
        li.className = 'region-tree__row';
        li.dataset.regionId = r.id;
        li.style.paddingLeft = `${6 + depth * 14}px`;
        li.classList.toggle('is-selected', r.id === selectedId);
        li.classList.toggle('is-hidden', view.hiddenTypes.includes(r.type));
        li.title = getRegionType(r.type).name;

        const dot = document.createElement('span');
        dot.className = 'region-tree__dot';
        dot.style.background = r.color;
        const name = document.createElement('span');
        name.className = 'region-tree__name';
        name.textContent = `${getRegionType(r.type).icon} ${r.name || '(no name)'}`;

        li.append(dot, name);
        rows.push(li);
        addRows(r.id, depth + 1);
      }
    };
    addRows(null, 0);

    if (rows.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'sidebar__empty region-tree__empty';
      empty.textContent = 'No regions yet — use the Region tool (R).';
      rows.push(empty);
    }
    list.replaceChildren(...rows);
  }

  return { element, render };
}

// ---------- Selected region details ----------

export interface RegionDetailsHandlers {
  onName(name: string): void;
  onType(type: RegionType): void;
  onParent(parentId: string | null): void;
  onColor(color: string): void;
  onNotes(notes: string): void;
  onDelete(): void;
}

export interface RegionDetails {
  element: HTMLElement;
  /** `areaKm2` = area in km²; `all` = every region (for the parent list). */
  render(region: Region, all: readonly Region[], areaKm2: number): void;
  focusName(): void;
}

export function createRegionDetails(handlers: RegionDetailsHandlers): RegionDetails {
  const element = document.createElement('div');
  element.className = 'marker-details';

  element.innerHTML = `
    <div class="region-details__top">
      <input class="region-details__color" type="color" title="Fill color" />
      <input class="marker-details__name" type="text" placeholder="Name" maxlength="80" />
    </div>
    <label class="field region-details__field">
      <span class="field__label">Type</span>
      <select class="marker-details__type region-details__type">
        ${REGION_TYPES.map((t) => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('')}
      </select>
    </label>
    <label class="field region-details__field">
      <span class="field__label">Part of</span>
      <select class="marker-details__type region-details__parent"></select>
    </label>
    <div class="region-details__notes"></div>
    <p class="marker-details__pos region-details__area"></p>
    <button type="button" class="panel-button panel-button--danger region-details__delete">🗑 Delete region (Del)</button>
  `;

  const color = element.querySelector<HTMLInputElement>('.region-details__color')!;
  const name = element.querySelector<HTMLInputElement>('.marker-details__name')!;
  const type = element.querySelector<HTMLSelectElement>('.region-details__type')!;
  const parent = element.querySelector<HTMLSelectElement>('.region-details__parent')!;
  const area = element.querySelector<HTMLParagraphElement>('.region-details__area')!;

  const notes = createNotesEditor(handlers.onNotes);
  element.querySelector('.region-details__notes')!.append(notes.element);

  color.addEventListener('input', () => handlers.onColor(color.value));
  name.addEventListener('input', () => handlers.onName(name.value));
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') name.blur();
  });
  type.addEventListener('change', () => handlers.onType(type.value as RegionType));
  parent.addEventListener('change', () => handlers.onParent(parent.value || null));
  element.querySelector('.region-details__delete')!.addEventListener('click', handlers.onDelete);

  let shownId: string | null = null;

  function render(region: Region, all: readonly Region[], areaKm2: number): void {
    // Another region was selected: leave the fields and show its values.
    if (region.id !== shownId) {
      if (element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      notes.blur();
      shownId = region.id;
    }

    if (document.activeElement !== name) name.value = region.name;
    if (document.activeElement !== color) color.value = region.color;
    type.value = region.type;
    notes.setValue(region.notes);

    // Possible parents: bigger types only.
    const options = all
      .filter((r) => r.id !== region.id && canBeParent(r.type, region.type))
      .sort((a, b) => getRegionType(a.type).rank - getRegionType(b.type).rank || a.name.localeCompare(b.name));
    parent.replaceChildren(new Option('— none —', ''));
    for (const r of options) parent.append(new Option(`${getRegionType(r.type).icon} ${r.name}`, r.id));
    parent.value = region.parentId ?? '';
    parent.disabled = options.length === 0;

    const side = Math.sqrt(areaKm2);
    area.textContent = `Area ≈ ${Math.round(areaKm2).toLocaleString('en-US')} km² (≈ ${formatDistance(side)} × ${formatDistance(side)})`;
  }

  function focusName(): void {
    name.focus();
    name.select();
  }

  return { element, render, focusName };
}
