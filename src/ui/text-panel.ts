import { getMarkerType, type Marker } from '../core/marker';
import type { MapText, TextFont } from '../core/text';

export interface TextPanelHandlers {
  onChange(patch: Partial<MapText>, mergeKey: string): void;
  onDuplicate(): void;
  onDelete(): void;
}

export interface TextPanel {
  element: HTMLElement;
  render(text: MapText, markers: readonly Marker[]): void;
  focusText(): void;
}

/** Editing a free text: content, font, size, bold/italic, colors, outline, rotation, link. */
export function createTextPanel(handlers: TextPanelHandlers): TextPanel {
  const element = document.createElement('div');
  element.className = 'marker-details text-panel';
  element.innerHTML = `
    <textarea class="text-panel__text notes__input" rows="2" placeholder="Text (Enter = new line)"></textarea>
    <div class="text-panel__row">
      <select class="text-panel__font marker-details__type">
        <option value="serif">Serif</option>
        <option value="sans">Sans-serif</option>
      </select>
      <button type="button" class="text-panel__toggle" data-key="bold" title="Bold"><b>B</b></button>
      <button type="button" class="text-panel__toggle" data-key="italic" title="Italic"><i>I</i></button>
    </div>
    <label class="field">
      <span class="field__label">Size</span>
      <input class="field__range text-panel__size" type="range" min="4" max="200" step="1" />
      <span class="field__value text-panel__size-value"></span>
    </label>
    <label class="field">
      <span class="field__label">Color</span>
      <input class="text-panel__color brush-panel__color" type="color" />
      <span class="field__label text-panel__mini">Outline</span>
      <input class="text-panel__outline-color brush-panel__color" type="color" />
    </label>
    <label class="field">
      <span class="field__label">Outline</span>
      <input class="field__range text-panel__outline" type="range" min="0" max="40" step="1" />
      <span class="field__value text-panel__outline-value"></span>
    </label>
    <label class="field">
      <span class="field__label">Rotation</span>
      <input class="field__range text-panel__rotation" type="range" min="-90" max="90" step="1" />
      <span class="field__value text-panel__rotation-value"></span>
    </label>
    <label class="field">
      <span class="field__label">Opens</span>
      <select class="text-panel__link marker-details__type" title="In View mode, clicking this text opens the notes of this marker"></select>
    </label>
    <div class="button-row">
      <button type="button" class="panel-button text-panel__duplicate">⧉ Duplicate (Ctrl+D)</button>
      <button type="button" class="panel-button panel-button--danger text-panel__delete">🗑 Delete (Del)</button>
    </div>
    <p class="marker-types__hint">Drag the text on the map to move it</p>
  `;

  const q = <T extends HTMLElement>(s: string): T => element.querySelector<T>(s)!;
  const textInput = q<HTMLTextAreaElement>('.text-panel__text');
  const font = q<HTMLSelectElement>('.text-panel__font');
  const size = q<HTMLInputElement>('.text-panel__size');
  const sizeValue = q<HTMLSpanElement>('.text-panel__size-value');
  const color = q<HTMLInputElement>('.text-panel__color');
  const outlineColor = q<HTMLInputElement>('.text-panel__outline-color');
  const outline = q<HTMLInputElement>('.text-panel__outline');
  const outlineValue = q<HTMLSpanElement>('.text-panel__outline-value');
  const rotation = q<HTMLInputElement>('.text-panel__rotation');
  const rotationValue = q<HTMLSpanElement>('.text-panel__rotation-value');
  const link = q<HTMLSelectElement>('.text-panel__link');
  const toggles = [...element.querySelectorAll<HTMLButtonElement>('.text-panel__toggle')];

  let current: MapText | null = null;

  textInput.addEventListener('input', () => handlers.onChange({ text: textInput.value }, 'text'));
  font.addEventListener('change', () => handlers.onChange({ font: font.value as TextFont }, 'font'));
  size.addEventListener('input', () => handlers.onChange({ size: Number(size.value) }, 'size'));
  color.addEventListener('input', () => handlers.onChange({ color: color.value }, 'color'));
  outlineColor.addEventListener('input', () =>
    handlers.onChange({ outlineColor: outlineColor.value }, 'outlineColor'),
  );
  outline.addEventListener('input', () => handlers.onChange({ outline: Number(outline.value) }, 'outline'));
  rotation.addEventListener('input', () =>
    handlers.onChange({ rotation: Number(rotation.value) }, 'rotation'),
  );
  link.addEventListener('change', () =>
    handlers.onChange({ linkedMarkerId: link.value || null }, 'link'),
  );
  for (const button of toggles) {
    button.addEventListener('click', () => {
      if (!current) return;
      const key = button.dataset.key as 'bold' | 'italic';
      handlers.onChange({ [key]: !current[key] }, key);
    });
  }
  q('.text-panel__duplicate').addEventListener('click', handlers.onDuplicate);
  q('.text-panel__delete').addEventListener('click', handlers.onDelete);

  function set(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
    if (document.activeElement !== input) input.value = value;
  }

  function render(text: MapText, markers: readonly Marker[]): void {
    if (current?.id !== text.id && element.contains(document.activeElement)) {
      (document.activeElement as HTMLElement).blur();
    }
    current = text;
    set(textInput, text.text);
    font.value = text.font;
    set(size, String(Math.round(text.size)));
    sizeValue.textContent = String(Math.round(text.size));
    set(color, text.color);
    set(outlineColor, text.outlineColor);
    set(outline, String(text.outline));
    outlineValue.textContent = `${text.outline}%`;
    set(rotation, String(text.rotation));
    rotationValue.textContent = `${text.rotation}°`;
    for (const button of toggles) {
      button.classList.toggle('is-active', text[button.dataset.key as 'bold' | 'italic']);
    }

    link.replaceChildren(new Option('— nothing —', ''));
    for (const m of [...markers].sort((a, b) => a.name.localeCompare(b.name))) {
      link.append(new Option(`${getMarkerType(m.type).icon} ${m.name}`, m.id));
    }
    link.value = text.linkedMarkerId ?? '';
  }

  return {
    element,
    render,
    focusText: () => {
      textInput.focus();
      textInput.select();
    },
  };
}
