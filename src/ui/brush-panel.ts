import { PALETTE, type PalettePreset } from '../core/palette';
import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, type Brush } from '../core/stroke';
import { STROKE_STYLES, isDrawStyle, type DrawStyle } from '../core/stroke-style';
import { formatDistance, mapScale } from '../core/map-scale';

export interface BrushPanelHandlers {
  onColor(color: string): void;
  onSize(size: number): void;
  onStyle(style: DrawStyle): void;
  /** Palette click: sets color, size and style together. */
  onPreset(preset: PalettePreset): void;
}

export interface BrushPanel {
  element: HTMLElement;
  render(brush: Brush): void;
}

/** Palette + color and thickness controls (used for the Pencil and the selected stroke). */
export function createBrushPanel(handlers: BrushPanelHandlers): BrushPanel {
  const element = document.createElement('div');
  element.className = 'brush-panel';

  element.innerHTML = `
    <div class="palette"></div>

    <label class="field">
      <span class="field__label">Color</span>
      <input class="brush-panel__color" type="color" />
      <input class="field__number brush-panel__hex" type="text" maxlength="7" spellcheck="false" />
    </label>

    <label class="field">
      <span class="field__label">Style</span>
      <select class="brush-panel__style">
        ${STROKE_STYLES.map((s) => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('')}
      </select>
    </label>

    <label class="field">
      <span class="field__label">Size</span>
      <input class="field__range brush-panel__size" type="range"
        min="${MIN_BRUSH_SIZE}" max="${MAX_BRUSH_SIZE}" step="1" />
      <input class="field__number brush-panel__size-number" type="number"
        min="${MIN_BRUSH_SIZE}" max="${MAX_BRUSH_SIZE}" step="1" />
    </label>

    <div class="brush-panel__preview">
      <span class="brush-panel__dot"></span>
      <span class="brush-panel__km"></span>
    </div>
  `;

  const q = <T extends HTMLElement>(selector: string): T => element.querySelector<T>(selector)!;

  const palette = q<HTMLDivElement>('.palette');
  const color = q<HTMLInputElement>('.brush-panel__color');
  const hex = q<HTMLInputElement>('.brush-panel__hex');
  const size = q<HTMLInputElement>('.brush-panel__size');
  const style = q<HTMLSelectElement>('.brush-panel__style');
  const sizeNumber = q<HTMLInputElement>('.brush-panel__size-number');
  const dot = q<HTMLSpanElement>('.brush-panel__dot');
  const km = q<HTMLSpanElement>('.brush-panel__km');

  // ---------- Palette ----------

  const swatches = new Map<string, HTMLButtonElement>();
  for (const preset of PALETTE) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'palette__swatch';
    button.title = `${preset.name} (size ${preset.size}, ${STROKE_STYLES.find((s) => s.id === preset.style)?.name ?? ''})`;
    button.innerHTML = `<span class="palette__color" style="background:${preset.color}"></span><span class="palette__name">${preset.name}</span>`;
    button.addEventListener('click', () => handlers.onPreset(preset));
    swatches.set(preset.id, button);
    palette.append(button);
  }

  // ---------- Events ----------

  color.addEventListener('input', () => handlers.onColor(color.value));

  hex.addEventListener('change', () => {
    const value = hex.value.trim();
    const normalized = value.startsWith('#') ? value : `#${value}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) handlers.onColor(normalized.toLowerCase());
  });

  size.addEventListener('input', () => handlers.onSize(Number(size.value)));
  style.addEventListener('change', () => {
    if (isDrawStyle(style.value)) handlers.onStyle(style.value);
  });

  sizeNumber.addEventListener('change', () => {
    const value = Number(sizeNumber.value);
    if (Number.isFinite(value)) {
      handlers.onSize(Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, Math.round(value))));
    }
  });

  // ---------- Render ----------

  function setValue(input: HTMLInputElement, value: string): void {
    if (document.activeElement !== input) input.value = value;
  }

  function render(brush: Brush): void {
    setValue(color, brush.color);
    setValue(hex, brush.color);
    setValue(size, String(brush.size));
    setValue(sizeNumber, String(brush.size));
    style.value = brush.style;

    // Preview dot: grows with the size (capped so it fits the panel).
    const px = Math.max(2, Math.min(28, brush.size));
    dot.style.width = `${px}px`;
    dot.style.height = `${px}px`;
    dot.style.background = brush.color;
    km.textContent = `≈ ${formatDistance(brush.size * mapScale.kmPerUnit)} ${
      brush.style === 'line' || brush.style === 'border' ? 'wide' : 'symbols'
    }`;

    // Highlight the preset that matches the current color and style.
    for (const preset of PALETTE) {
      const match =
        preset.color.toLowerCase() === brush.color.toLowerCase() && preset.style === brush.style;
      swatches.get(preset.id)!.classList.toggle('is-active', match);
    }
  }

  return { element, render };
}
