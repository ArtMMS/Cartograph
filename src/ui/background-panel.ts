import {
  ACCEPTED_IMAGE_TYPES,
  MAX_SCALE_PERCENT,
  MIN_SCALE_PERCENT,
  getScalePercent,
} from '../core/background';
import { isLayerEditable, type Layer } from '../core/layer';

export interface BackgroundPanelHandlers {
  onLoadFile(file: File): void;
  /** 0–1 */
  onOpacity(opacity: number): void;
  /** 100 = fitted to the world. */
  onScalePercent(percent: number): void;
  onPosition(x: number, y: number): void;
  onToggleMove(): void;
  onFit(): void;
  onRemove(): void;
}

export interface BackgroundPanel {
  element: HTMLElement;
  /** `layer` = the active layer if it's an image layer, otherwise null. */
  render(layer: Layer | null, moveMode: boolean, imageLayerCount: number): void;
  showError(message: string): void;
}

/**
 * Sidebar "Images" section: adds images (each one becomes a layer)
 * and adjusts the image of the active image layer.
 */
export function createBackgroundPanel(handlers: BackgroundPanelHandlers): BackgroundPanel {
  const element = document.createElement('div');
  element.className = 'bg-panel';

  element.innerHTML = `
    <input class="bg-panel__file" type="file" accept="${ACCEPTED_IMAGE_TYPES.join(',')}" hidden />
    <button class="panel-button bg-panel__load" type="button">📂 Add image</button>
    <p class="bg-panel__hint">or drag an image onto the map — each image becomes a layer</p>
    <p class="bg-panel__error" hidden></p>
    <p class="bg-panel__empty sidebar__empty" hidden>Select an image layer (🖼) to adjust it.</p>

    <div class="bg-panel__controls" hidden>
      <p class="bg-panel__name"></p>

      <label class="field">
        <span class="field__label">Opacity</span>
        <input class="field__range bg-panel__opacity" type="range" min="0" max="100" step="1" />
        <span class="field__value bg-panel__opacity-value"></span>
      </label>

      <label class="field">
        <span class="field__label">Scale</span>
        <input class="field__range bg-panel__scale" type="range"
          min="${MIN_SCALE_PERCENT}" max="${MAX_SCALE_PERCENT}" step="1" />
        <input class="field__number bg-panel__scale-number" type="number"
          min="${MIN_SCALE_PERCENT}" max="${MAX_SCALE_PERCENT}" step="1" />
      </label>

      <div class="field field--pair">
        <label class="field__inline">
          <span class="field__label">X</span>
          <input class="field__number bg-panel__x" type="number" step="1" />
        </label>
        <label class="field__inline">
          <span class="field__label">Y</span>
          <input class="field__number bg-panel__y" type="number" step="1" />
        </label>
      </div>

      <div class="button-row">
        <button class="panel-button bg-panel__move" type="button" title="Move and resize the image directly on the map">✥ Transform</button>
        <button class="panel-button bg-panel__fit" type="button" title="Fit the image to the world">Fit</button>
        <button class="panel-button panel-button--danger bg-panel__remove" type="button" title="Delete this image layer (Ctrl+Z to undo)">Delete</button>
      </div>
      <p class="bg-panel__locked" hidden>Layer is locked or hidden — unlock/show it in Layers to edit.</p>
    </div>
  `;

  const q = <T extends HTMLElement>(selector: string): T => element.querySelector<T>(selector)!;

  const fileInput = q<HTMLInputElement>('.bg-panel__file');
  const loadButton = q<HTMLButtonElement>('.bg-panel__load');
  const error = q<HTMLParagraphElement>('.bg-panel__error');
  const empty = q<HTMLParagraphElement>('.bg-panel__empty');
  const controls = q<HTMLDivElement>('.bg-panel__controls');
  const name = q<HTMLParagraphElement>('.bg-panel__name');
  const opacity = q<HTMLInputElement>('.bg-panel__opacity');
  const opacityValue = q<HTMLSpanElement>('.bg-panel__opacity-value');
  const scale = q<HTMLInputElement>('.bg-panel__scale');
  const scaleNumber = q<HTMLInputElement>('.bg-panel__scale-number');
  const posX = q<HTMLInputElement>('.bg-panel__x');
  const posY = q<HTMLInputElement>('.bg-panel__y');
  const moveButton = q<HTMLButtonElement>('.bg-panel__move');
  const fitButton = q<HTMLButtonElement>('.bg-panel__fit');
  const removeButton = q<HTMLButtonElement>('.bg-panel__remove');
  const lockedNote = q<HTMLParagraphElement>('.bg-panel__locked');

  // ---------- Events ----------

  loadButton.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // allows loading the same file again
    if (file) handlers.onLoadFile(file);
  });

  opacity.addEventListener('input', () => handlers.onOpacity(Number(opacity.value) / 100));

  scale.addEventListener('input', () => handlers.onScalePercent(Number(scale.value)));

  scaleNumber.addEventListener('change', () => {
    const value = Number(scaleNumber.value);
    if (Number.isFinite(value) && value > 0) handlers.onScalePercent(value);
  });

  const onPositionInput = (): void => {
    const x = Number(posX.value);
    const y = Number(posY.value);
    if (Number.isFinite(x) && Number.isFinite(y)) handlers.onPosition(x, y);
  };
  posX.addEventListener('change', onPositionInput);
  posY.addEventListener('change', onPositionInput);

  moveButton.addEventListener('click', handlers.onToggleMove);
  fitButton.addEventListener('click', handlers.onFit);
  removeButton.addEventListener('click', handlers.onRemove);

  // ---------- Render ----------

  /** Only updates an input if the user isn't typing in it. */
  function setValue(input: HTMLInputElement, value: number): void {
    if (document.activeElement !== input) input.value = String(Math.round(value));
  }

  function render(layer: Layer | null, moveMode: boolean, imageLayerCount: number): void {
    const image = layer?.image;
    controls.hidden = !image;
    empty.hidden = !!image || imageLayerCount === 0;
    if (!layer || !image) return;

    error.hidden = true;
    name.textContent = `🖼 ${layer.name}`;
    name.title = image.name;

    const opacityPercent = image.opacity * 100;
    setValue(opacity, opacityPercent);
    opacityValue.textContent = `${Math.round(opacityPercent)}%`;

    const scalePercent = getScalePercent(image);
    setValue(scale, scalePercent);
    setValue(scaleNumber, scalePercent);

    setValue(posX, image.x);
    setValue(posY, image.y);

    moveButton.classList.toggle('is-active', moveMode);

    // Locked or hidden layer: position and scale can't be changed.
    const editable = isLayerEditable(layer);
    for (const input of [scale, scaleNumber, posX, posY]) input.disabled = !editable;
    moveButton.disabled = !editable;
    fitButton.disabled = !editable;
    opacity.disabled = !layer.visible;
    lockedNote.hidden = editable;
  }

  function showError(message: string): void {
    error.textContent = message;
    error.hidden = false;
  }

  render(null, false, 0);

  return { element, render, showError };
}
