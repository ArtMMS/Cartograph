import { formatDistance } from '../core/map-scale';
import { TRAVEL_MODES, formatMinutes, formatTravelTime, travelTime } from '../core/travel';

export interface TravelPanel {
  element: HTMLElement;
  /** `km` = measured distance; `points` = how many points were clicked. */
  render(km: number, finished: boolean, points: number): void;
}

/** Shows the measured distance and how long it takes with each way of travelling. */
export function createTravelPanel(onClear: () => void): TravelPanel {
  const element = document.createElement('div');
  element.className = 'travel';

  element.innerHTML = `
    <p class="travel__hint">Left-click to add points along the route · <strong>right-click</strong> (or double-click / Enter) stops the ruler · <strong>Esc</strong> clears it</p>
    <div class="travel__distance">
      <span class="travel__km">0 km</span>
      <span class="travel__mi"></span>
    </div>
    <ul class="travel__modes"></ul>
    <button type="button" class="panel-button travel__clear">Clear route (Esc)</button>
  `;

  const km = element.querySelector<HTMLSpanElement>('.travel__km')!;
  const mi = element.querySelector<HTMLSpanElement>('.travel__mi')!;
  const list = element.querySelector<HTMLUListElement>('.travel__modes')!;
  element.querySelector('.travel__clear')!.addEventListener('click', onClear);

  function render(distanceKm: number, finished: boolean, points: number): void {
    km.textContent = formatDistance(distanceKm);
    mi.textContent = `${(distanceKm / 1.609).toFixed(1)} mi${
      finished ? ' · 📌 stopped (Esc to clear)' : points > 0 ? ' · measuring…' : ''
    }`;

    list.replaceChildren(
      ...TRAVEL_MODES.map((mode) => {
        const t = travelTime(distanceKm, mode);
        const li = document.createElement('li');
        li.className = 'travel__mode';
        li.innerHTML = `
          <span class="travel__icon">${mode.icon}</span>
          <span class="travel__info">
            <strong>${mode.name}</strong>
            <span class="travel__time"></span>
            <small></small>
          </span>
        `;
        li.querySelector('.travel__time')!.textContent = formatTravelTime(t);
        li.querySelector('small')!.textContent =
          `${formatMinutes(t.movingMinutes)} moving · ${mode.kmPerHour} km/h, ${mode.hoursPerDay} h/day`;
        return li;
      }),
    );
  }

  render(0, false, 0);
  return { element, render };
}
