import type { Layer } from '../core/layer';
import { createSvg } from '../core/svg';
import type { MapText } from '../core/text';

export interface TextLayer {
  sync(texts: readonly MapText[], layers: readonly Layer[]): void;
  setSelected(id: string | null): void;
}

/** Draws free texts inside their layer's SVG group (sizes in world units). */
export function createTextLayer(getLayerGroup: (layerId: string) => SVGGElement | undefined): TextLayer {
  const cache = new Map<string, SVGTextElement>();
  let selectedId: string | null = null;

  function sync(texts: readonly MapText[], layers: readonly Layer[]): void {
    const layerIds = new Set(layers.map((l) => l.id));
    const seen = new Set<string>();

    for (const t of texts) {
      const parent = layerIds.has(t.layerId) ? getLayerGroup(t.layerId) : undefined;
      if (!parent) continue;
      seen.add(t.id);

      let el = cache.get(t.id);
      if (!el) {
        el = createSvg('text', { class: 'map-text', 'text-anchor': 'middle', 'data-text-id': t.id });
        cache.set(t.id, el);
      }
      render(el, t);
      if (el.parentNode !== parent || parent.lastChild !== el) parent.append(el);
    }

    for (const [id, el] of cache) {
      if (!seen.has(id)) {
        el.remove();
        cache.delete(id);
      }
    }
    applySelection();
  }

  function render(el: SVGTextElement, t: MapText): void {
    el.setAttribute('transform', `translate(${t.x} ${t.y}) rotate(${t.rotation})`);
    el.setAttribute('font-size', String(t.size));
    el.setAttribute('font-family', t.font === 'serif' ? "Georgia, 'Times New Roman', serif" : 'system-ui, sans-serif');
    el.setAttribute('font-weight', t.bold ? '700' : '400');
    el.setAttribute('font-style', t.italic ? 'italic' : 'normal');
    el.setAttribute('fill', t.color);
    el.setAttribute('stroke', t.outlineColor);
    el.setAttribute('stroke-width', String((t.size * t.outline) / 100));
    el.setAttribute('stroke-linejoin', 'round');
    el.setAttribute('paint-order', 'stroke');
    el.classList.toggle('has-link', t.linkedMarkerId !== null);

    // One <tspan> per line, centered vertically around (x, y).
    const lines = t.text.split('\n');
    el.replaceChildren(
      ...lines.map((line, i) => {
        const span = createSvg('tspan', { x: 0 });
        span.setAttribute('dy', i === 0 ? `${(-(lines.length - 1) * 1.15) / 2 + 0.35}em` : '1.15em');
        span.textContent = line || ' ';
        return span;
      }),
    );
  }

  function setSelected(id: string | null): void {
    selectedId = id;
    applySelection();
  }

  function applySelection(): void {
    for (const [id, el] of cache) el.classList.toggle('is-selected', id === selectedId);
  }

  return { sync, setSelected };
}
