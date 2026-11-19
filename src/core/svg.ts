export const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * Creates an SVG element with the given attributes.
 * Example: createSvg('rect', { x: 0, y: 0, width: 10, height: 10 })
 */
export function createSvg<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [name, value] of Object.entries(attrs)) {
    el.setAttribute(name, String(value));
  }
  return el;
}
