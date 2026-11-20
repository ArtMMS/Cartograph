import { MARKER_TYPES, type Marker, type MarkerType, type MarkerView } from '../core/marker';
import { createNotesEditor } from './notes-editor';

// ---------- "New marker" type picker (visible with the Marker tool) ----------

export interface MarkerTypePicker {
  element: HTMLElement;
  render(type: MarkerType): void;
}

export function createMarkerTypePicker(onPick: (type: MarkerType) => void): MarkerTypePicker {
  const element = document.createElement('div');
  element.className = 'marker-types';

  const buttons = new Map<MarkerType, HTMLButtonElement>();
  for (const t of MARKER_TYPES) {
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
  hint.textContent = 'Click on the map to place · drag a marker to move it';
  element.append(hint);

  function render(type: MarkerType): void {
    for (const [id, button] of buttons) button.classList.toggle('is-active', id === type);
  }

  return { element, render };
}

// ---------- Markers view settings (labels + types on/off) ----------

export interface MarkerViewPanel {
  element: HTMLElement;
  render(view: MarkerView, counts: Map<MarkerType, number>): void;
}

export function createMarkerViewPanel(handlers: {
  onToggleLabels(): void;
  onToggleType(type: MarkerType): void;
}): MarkerViewPanel {
  const element = document.createElement('div');
  element.className = 'marker-view';

  const labels = document.createElement('label');
  labels.className = 'marker-view__labels';
  labels.innerHTML = '<input type="checkbox" /> <span>Show labels (names)</span>';
  const labelsInput = labels.querySelector('input')!;
  labelsInput.addEventListener('change', handlers.onToggleLabels);

  const chips = document.createElement('div');
  chips.className = 'marker-view__chips';

  const buttons = new Map<MarkerType, HTMLButtonElement>();
  for (const t of MARKER_TYPES) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'marker-view__chip';
    button.addEventListener('click', () => handlers.onToggleType(t.id));
    buttons.set(t.id, button);
    chips.append(button);
  }

  element.append(labels, chips);

  function render(view: MarkerView, counts: Map<MarkerType, number>): void {
    labelsInput.checked = view.showLabels;
    for (const t of MARKER_TYPES) {
      const button = buttons.get(t.id)!;
      const hidden = view.hiddenTypes.includes(t.id);
      button.classList.toggle('is-off', hidden);
      button.textContent = `${t.icon} ${t.id === 'poi' ? 'POI' : t.name} ${counts.get(t.id) ?? 0}`;
      button.title = `${hidden ? 'Show' : 'Hide'} ${t.name.toLowerCase()} markers`;
    }
  }

  return { element, render };
}

// ---------- Selected marker details (name, type, notes) ----------

export interface MarkerDetailsHandlers {
  onName(name: string): void;
  onType(type: MarkerType): void;
  onNotes(notes: string): void;
  onDelete(): void;
}

export interface MarkerDetails {
  element: HTMLElement;
  render(marker: Marker, kmLabel: string): void;
  /** Puts the cursor in the name field (right after placing a marker). */
  focusName(): void;
}

export function createMarkerDetails(handlers: MarkerDetailsHandlers): MarkerDetails {
  const element = document.createElement('div');
  element.className = 'marker-details';

  element.innerHTML = `
    <input class="marker-details__name" type="text" placeholder="Name" maxlength="80" />
    <select class="marker-details__type">
      ${MARKER_TYPES.map((t) => `<option value="${t.id}">${t.icon} ${t.name}</option>`).join('')}
    </select>
    <div class="marker-details__notes-slot"></div>
    <p class="marker-details__pos"></p>
    <button type="button" class="panel-button panel-button--danger marker-details__delete">🗑 Delete marker (Del)</button>
  `;

  const name = element.querySelector<HTMLInputElement>('.marker-details__name')!;
  const type = element.querySelector<HTMLSelectElement>('.marker-details__type')!;
  const notes = createNotesEditor(handlers.onNotes);
  element.querySelector('.marker-details__notes-slot')!.append(notes.element);
  const pos = element.querySelector<HTMLParagraphElement>('.marker-details__pos')!;

  name.addEventListener('input', () => handlers.onName(name.value));
  name.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') name.blur();
  });
  type.addEventListener('change', () => handlers.onType(type.value as MarkerType));
  element
    .querySelector('.marker-details__delete')!
    .addEventListener('click', handlers.onDelete);

  let shownId: string | null = null;

  function render(marker: Marker, kmLabel: string): void {
    // Another marker was selected: leave the fields and show its values.
    if (marker.id !== shownId) {
      if (element.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      notes.blur();
      shownId = marker.id;
    }
    if (document.activeElement !== name) name.value = marker.name;
    notes.setValue(marker.notes);
    type.value = marker.type;
    pos.textContent = kmLabel;
  }

  function focusName(): void {
    name.focus();
    name.select();
  }

  return { element, render, focusName };
}
