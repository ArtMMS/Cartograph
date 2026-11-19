import { MAX_BRUSH_SIZE, MIN_BRUSH_SIZE, type Brush } from '../core/stroke';
import { KM_PER_UNIT } from '../core/world';

export interface BrushPanelHandlers {
  onColor(color: string): void;
  onSize(size: number): void;
}

export interface BrushPanel {
  element: HTMLElement;
  render(brush: Brush): void;
}

/** Color and thickness controls for the Pencil. */
export function createBrushPanel(handlers: BrushPanelHandlers): BrushPanel {
  const element = document.createElement('div');
  element.className = 'brush-panel';

  element.innerHTML = `
    <label class="field">
      <span class="field__label">Color</span>
      <input class="brush-panel__color" type="color" />
      <input class="field__number brush-panel__hex" type="text" maxlength="7" spellcheck="false" />
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

  const color = q<HTMLInputElement>('.brush-panel__color');
  const hex = q<HTMLInputElement>('.brush-panel__hex');
  const size = q<HTMLInputElement>('.brush-panel__size');
  const sizeNumber = q<HTMLInputElement>('.brush-panel__size-number');
  const dot = q<HTMLSpanElement>('.brush-panel__dot');
  const km = q<HTMLSpanElement>('.brush-panel__km');

  color.addEventListener('input', () => handlers.onColor(color.value));

  hex.addEventListener('change', () => {
    const value = hex.value.trim();
    const normalized = value.startsWith('#') ? value : `#${value}`;
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) handlers.onColor(normalized.toLowerCase());
  });

  size.addEventListener('input', () => handlers.onSize(Number(size.value)));

  sizeNumber.addEventListener('change', () => {
    const value = Number(sizeNumber.value);
    if (Number.isFinite(value)) {
      handlers.onSize(Math.min(MAX_BRUSH_SIZE, Math.max(MIN_BRUSH_SIZE, Math.round(value))));
    }
  });

  function setValue(input: HTMLInputElement, value: string): void {
    if (document.activeElement !== input) input.value = value;
  }

  function render(brush: Brush): void {
    setValue(color, brush.color);
    setValue(hex, brush.color);
    setValue(size, String(brush.size));
    setValue(sizeNumber, String(brush.size));

    // Preview dot: grows with the size (capped so it fits the panel).
    const px = Math.max(2, Math.min(28, brush.size));
    dot.style.width = `${px}px`;
    dot.style.height = `${px}px`;
    dot.style.background = brush.color;
    km.textContent = `≈ ${brush.size * KM_PER_UNIT} km wide`;
  }

  return { element, render };
}
