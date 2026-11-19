import {
  ACCEPTED_IMAGE_TYPES,
  canEditBackground,
  getScalePercent,
  type BackgroundImage,
} from '../core/background';

const MIN_SCALE_PERCENT = 10;
const MAX_SCALE_PERCENT = 400;

export interface BackgroundPanelHandlers {
  onLoadFile(file: File): void;
  /** 0–1 */
  onOpacity(opacity: number): void;
  /** 100 = fitted to the world. */
  onScalePercent(percent: number): void;
  onPosition(x: number, y: number): void;
  onToggleMove(): void;
  onToggleLock(): void;
  onToggleVisible(): void;
  onFit(): void;
  onRemove(): void;
}

export interface BackgroundPanel {
  element: HTMLElement;
  render(bg: BackgroundImage | null, moveMode: boolean): void;
  showError(message: string): void;
}

/** Controls for the background image (sidebar "Background" section). */
export function createBackgroundPanel(handlers: BackgroundPanelHandlers): BackgroundPanel {
  const element = document.createElement('div');
  element.className = 'bg-panel';

  element.innerHTML = `
    <input class="bg-panel__file" type="file" accept="${ACCEPTED_IMAGE_TYPES.join(',')}" hidden />
    <button class="panel-button bg-panel__load" type="button">📂 Load image</button>
    <p class="bg-panel__error" hidden></p>

    <div class="bg-panel__controls" hidden>
      <div class="bg-panel__header">
        <p class="bg-panel__name"></p>
        <button class="icon-button bg-panel__visible" type="button"></button>
        <button class="icon-button bg-panel__lock" type="button"></button>
      </div>

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
        <button class="panel-button bg-panel__move" type="button" title="Drag the image on the map">✥ Move</button>
        <button class="panel-button bg-panel__fit" type="button" title="Fit the image to the world">Fit</button>
        <button class="panel-button panel-button--danger bg-panel__remove" type="button">Remove</button>
      </div>
    </div>
  `;

  const q = <T extends HTMLElement>(selector: string): T => element.querySelector<T>(selector)!;

  const fileInput = q<HTMLInputElement>('.bg-panel__file');
  const loadButton = q<HTMLButtonElement>('.bg-panel__load');
  const error = q<HTMLParagraphElement>('.bg-panel__error');
  const controls = q<HTMLDivElement>('.bg-panel__controls');
  const name = q<HTMLParagraphElement>('.bg-panel__name');
  const visibleButton = q<HTMLButtonElement>('.bg-panel__visible');
  const lockButton = q<HTMLButtonElement>('.bg-panel__lock');
  const opacity = q<HTMLInputElement>('.bg-panel__opacity');
  const opacityValue = q<HTMLSpanElement>('.bg-panel__opacity-value');
  const scale = q<HTMLInputElement>('.bg-panel__scale');
  const scaleNumber = q<HTMLInputElement>('.bg-panel__scale-number');
  const posX = q<HTMLInputElement>('.bg-panel__x');
  const posY = q<HTMLInputElement>('.bg-panel__y');
  const moveButton = q<HTMLButtonElement>('.bg-panel__move');
  const fitButton = q<HTMLButtonElement>('.bg-panel__fit');
  const removeButton = q<HTMLButtonElement>('.bg-panel__remove');

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
  visibleButton.addEventListener('click', handlers.onToggleVisible);
  lockButton.addEventListener('click', handlers.onToggleLock);
  fitButton.addEventListener('click', handlers.onFit);
  removeButton.addEventListener('click', handlers.onRemove);

  // ---------- Render ----------

  /** Only updates an input if the user isn't typing in it. */
  function setValue(input: HTMLInputElement, value: number): void {
    if (document.activeElement !== input) input.value = String(Math.round(value));
  }

  function render(bg: BackgroundImage | null, moveMode: boolean): void {
    controls.hidden = !bg;
    loadButton.textContent = bg ? '📂 Replace image' : '📂 Load image';
    if (!bg) return;

    error.hidden = true;
    name.textContent = bg.name;
    name.title = bg.name;

    const opacityPercent = bg.opacity * 100;
    setValue(opacity, opacityPercent);
    opacityValue.textContent = `${Math.round(opacityPercent)}%`;

    const scalePercent = getScalePercent(bg);
    setValue(scale, scalePercent);
    setValue(scaleNumber, scalePercent);

    setValue(posX, bg.x);
    setValue(posY, bg.y);

    moveButton.classList.toggle('is-active', moveMode);

    visibleButton.textContent = bg.visible ? '👁' : '🚫';
    visibleButton.title = bg.visible ? 'Hide background' : 'Show background';
    visibleButton.classList.toggle('is-off', !bg.visible);

    lockButton.textContent = bg.locked ? '🔒' : '🔓';
    lockButton.title = bg.locked ? 'Unlock background' : 'Lock background';
    lockButton.classList.toggle('is-active', bg.locked);

    // Locked or hidden: position and scale can't be changed.
    const editable = canEditBackground(bg);
    for (const input of [scale, scaleNumber, posX, posY]) input.disabled = !editable;
    moveButton.disabled = !editable;
    fitButton.disabled = !editable;
    opacity.disabled = !bg.visible;
  }

  function showError(message: string): void {
    error.textContent = message;
    error.hidden = false;
  }

  render(null, false);

  return { element, render, showError };
}
