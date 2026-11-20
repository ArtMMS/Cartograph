import { getMarkerType, type Marker } from '../core/marker';
import { getRegionType, type Region } from '../core/region';

export type SearchResult =
  | { kind: 'marker'; item: Marker }
  | { kind: 'region'; item: Region };

export interface SearchBox {
  element: HTMLElement;
  focus(): void;
}

/** Search field (top-right of the map) for cities and regions by name. Ctrl+F focuses it. */
export function createSearchBox(
  getItems: () => { markers: readonly Marker[]; regions: readonly Region[] },
  onPick: (result: SearchResult) => void,
): SearchBox {
  const element = document.createElement('div');
  element.className = 'search';
  element.innerHTML = `
    <input class="search__input" type="search" placeholder="🔍 Search cities & regions (Ctrl+F)" />
    <ul class="search__results" hidden></ul>
  `;

  const input = element.querySelector<HTMLInputElement>('.search__input')!;
  const list = element.querySelector<HTMLUListElement>('.search__results')!;
  let results: SearchResult[] = [];
  let active = 0;

  function normalize(text: string): string {
    return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  function update(): void {
    const query = normalize(input.value.trim());
    if (!query) {
      results = [];
      render();
      return;
    }
    const { markers, regions } = getItems();
    const matches = (name: string): boolean => normalize(name).includes(query);
    // Names that start with the query come first.
    const score = (name: string): number => (normalize(name).startsWith(query) ? 0 : 1);

    results = [
      ...regions.filter((r) => matches(r.name)).map((item) => ({ kind: 'region' as const, item })),
      ...markers.filter((m) => matches(m.name)).map((item) => ({ kind: 'marker' as const, item })),
    ]
      .sort((a, b) => score(a.item.name) - score(b.item.name) || a.item.name.localeCompare(b.item.name))
      .slice(0, 12);
    active = 0;
    render();
  }

  function render(): void {
    list.hidden = input.value.trim() === '';
    if (results.length === 0) {
      list.innerHTML = '<li class="search__empty">No matches</li>';
      return;
    }
    list.replaceChildren(
      ...results.map((r, i) => {
        const li = document.createElement('li');
        li.className = 'search__result';
        li.classList.toggle('is-active', i === active);
        const info = r.kind === 'marker' ? getMarkerType(r.item.type) : getRegionType(r.item.type);
        li.innerHTML = `<span>${info.icon}</span><span class="search__name"></span><small>${info.name}</small>`;
        li.querySelector('.search__name')!.textContent = r.item.name || '(no name)';
        // mousedown (not click) so it runs before the input loses focus.
        li.addEventListener('mousedown', (e) => {
          e.preventDefault();
          pick(i);
        });
        return li;
      }),
    );
  }

  function pick(index: number): void {
    const result = results[index];
    if (!result) return;
    onPick(result);
    input.value = '';
    results = [];
    render();
    input.blur();
  }

  input.addEventListener('input', update);
  input.addEventListener('focus', update);
  input.addEventListener('blur', () => {
    list.hidden = true;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      active = Math.min(active + 1, results.length - 1);
      render();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(active - 1, 0);
      render();
    } else if (e.key === 'Enter') {
      pick(active);
    } else if (e.key === 'Escape') {
      input.value = '';
      update();
      input.blur();
    }
  });

  return { element, focus: () => input.focus() };
}
