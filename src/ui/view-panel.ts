import { MARKER_TYPES, type MarkerType } from '../core/marker';

/**
 * View mode panel: turn regions and each marker type on/off while reading the map.
 * These switches only affect View mode (they don't change the map file).
 */
export function createViewPanel(
  parent: HTMLElement,
  svg: SVGSVGElement,
  onChange: () => void,
): { setActive(active: boolean): void; regionsVisible(): boolean } {
  const element = document.createElement('div');
  element.className = 'view-panel';
  element.hidden = true;
  element.innerHTML = `
    <strong class="view-panel__title">Show on map</strong>
    <label class="view-panel__regions"><input type="checkbox" checked /> ⬠ Regions</label>
    <div class="view-panel__chips"></div>
  `;
  parent.append(element);

  const regionsInput = element.querySelector<HTMLInputElement>('.view-panel__regions input')!;
  const chips = element.querySelector<HTMLDivElement>('.view-panel__chips')!;
  const hidden = new Set<MarkerType>();
  let active = false;

  for (const t of MARKER_TYPES) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'marker-view__chip';
    chip.textContent = `${t.icon} ${t.short}`;
    chip.title = `Show/hide ${t.name.toLowerCase()}`;
    chip.addEventListener('click', () => {
      if (hidden.has(t.id)) hidden.delete(t.id);
      else hidden.add(t.id);
      chip.classList.toggle('is-off', hidden.has(t.id));
      apply();
    });
    chips.append(chip);
  }
  regionsInput.addEventListener('change', apply);

  // Clicks on the panel shouldn't reach the map.
  element.addEventListener('pointerdown', (e) => e.stopPropagation());

  function apply(): void {
    svg.classList.toggle('view-hide-regions', active && !regionsInput.checked);
    for (const t of MARKER_TYPES) {
      svg.classList.toggle(`view-hide-marker-${t.id}`, active && hidden.has(t.id));
    }
    onChange();
  }

  return {
    setActive: (value) => {
      active = value;
      element.hidden = !value;
      apply();
    },
    regionsVisible: () => !active || regionsInput.checked,
  };
}
