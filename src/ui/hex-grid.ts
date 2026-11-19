import { createSvg } from '../core/svg';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';

const PATTERN_ID = 'hex-grid-pattern';

export interface HexGrid {
  element: SVGGElement;
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  /** Hex size (flat side to flat side) in world units. */
  setHexSize(units: number): void;
  /** Keeps lines ~1px thick and fades the grid when hexes get too small. */
  setScale(scale: number): void;
}

/**
 * Pointy-top hex grid drawn with a single repeating SVG pattern,
 * so it stays cheap no matter how many hexes there are.
 */
export function createHexGrid(defs: SVGDefsElement, initialHexSize: number): HexGrid {
  const pattern = createSvg('pattern', {
    id: PATTERN_ID,
    patternUnits: 'userSpaceOnUse',
    x: 0,
    y: 0,
  });
  const path = createSvg('path', { class: 'hex-grid__line' });
  pattern.append(path);
  defs.append(pattern);

  const element = createSvg('g', { 'data-layer': 'grid', class: 'hex-grid' });
  element.append(
    createSvg('rect', {
      x: 0,
      y: 0,
      width: WORLD_WIDTH,
      height: WORLD_HEIGHT,
      fill: `url(#${PATTERN_ID})`,
    }),
  );

  let visible = false;
  let hexSize = initialHexSize;
  let lastScale = 1;
  element.style.display = 'none';

  function setHexSize(units: number): void {
    hexSize = units;

    // Pointy-top hex: width (flat to flat) = w, radius r = w / √3.
    const w = units;
    const r = w / Math.sqrt(3);
    const h = w / 2;

    // One tile = one full hex + the vertical edge of the offset row below.
    pattern.setAttribute('width', String(w));
    pattern.setAttribute('height', String(3 * r));
    path.setAttribute(
      'd',
      [
        `M ${h} 0`,
        `L ${w} ${r / 2}`,
        `L ${w} ${1.5 * r}`,
        `L ${h} ${2 * r}`,
        `L 0 ${1.5 * r}`,
        `L 0 ${r / 2}`,
        'Z',
        `M ${h} ${2 * r}`,
        `L ${h} ${3 * r}`,
      ].join(' '),
    );
    setScale(lastScale);
  }

  function setVisible(value: boolean): void {
    visible = value;
    element.style.display = value ? '' : 'none';
  }

  function setScale(scale: number): void {
    lastScale = scale;
    path.setAttribute('stroke-width', String(1 / scale));

    // Hex size on screen, in pixels. Fade out below ~12px, hidden below 4px.
    const hexPx = hexSize * scale;
    const opacity = Math.min(1, Math.max(0, (hexPx - 4) / 8));
    element.style.opacity = String(opacity);
  }

  setHexSize(initialHexSize);

  return { element, isVisible: () => visible, setVisible, setHexSize, setScale };
}
