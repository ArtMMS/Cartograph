import { MAX_SNAP_PX, MIN_SNAP_PX, type SnapSettings } from '../core/snap';

export interface SnapPanel {
  element: HTMLElement;
  render(settings: SnapSettings): void;
}

/** "Snap to line ends" on/off + distance (shown under the brush). */
export function createSnapPanel(onChange: (settings: SnapSettings) => void): SnapPanel {
  const element = document.createElement('div');
  element.className = 'snap-panel';

  element.innerHTML = `
    <label class="snap-panel__toggle">
      <input type="checkbox" />
      <span>🧲 Snap to line ends</span>
    </label>
    <label class="field snap-panel__distance">
      <span class="field__label">Distance</span>
      <input class="field__range" type="range" min="${MIN_SNAP_PX}" max="${MAX_SNAP_PX}" step="1" />
      <span class="field__value"></span>
    </label>
    <p class="snap-panel__hint">Hold <kbd>Alt</kbd> while drawing to ignore snapping</p>
  `;

  const toggle = element.querySelector<HTMLInputElement>('input[type="checkbox"]')!;
  const range = element.querySelector<HTMLInputElement>('input[type="range"]')!;
  const value = element.querySelector<HTMLSpanElement>('.field__value')!;

  let current: SnapSettings = { enabled: true, distancePx: 12 };

  toggle.addEventListener('change', () => onChange({ ...current, enabled: toggle.checked }));
  range.addEventListener('input', () => onChange({ ...current, distancePx: Number(range.value) }));

  function render(settings: SnapSettings): void {
    current = settings;
    toggle.checked = settings.enabled;
    range.value = String(settings.distancePx);
    range.disabled = !settings.enabled;
    value.textContent = `${settings.distancePx}px`;
  }

  return { element, render };
}
