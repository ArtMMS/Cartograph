import { createSvg } from '../core/svg';
import { HEX_SIZE_UNITS, WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';

const PATTERN_ID = 'hex-grid-pattern';

export interface HexGrid {
  element: SVGGElement;
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  /** Keeps lines ~1px thick and fades the grid when hexes get too small. */
  setScale(scale: number): void;
}

/**
 * Pointy-top hex grid drawn with a single repeating SVG pattern,
 * so it stays cheap no matter how many hexes there are.
 */
export function createHexGrid(defs: SVGDefsElement): HexGrid {
  // Pointy-top hex: width (flat to flat) = HEX_SIZE_UNITS, radius R = width / √3.
  const w = HEX_SIZE_UNITS;
  const r = w / Math.sqrt(3);
  const h = w / 2;

  // One tile = one full hex + the vertical edge of the offset row below.
  const pattern = createSvg('pattern', {
    id: PATTERN_ID,
    patternUnits: 'userSpaceOnUse',
    x: 0,
    y: 0,
    width: w,
    height: 3 * r,
  });

  const path = createSvg('path', {
    class: 'hex-grid__line',
    d: [
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
  });

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
  element.style.display = 'none';

  function setVisible(value: boolean): void {
    visible = value;
    element.style.display = value ? '' : 'none';
  }

  function setScale(scale: number): void {
    path.setAttribute('stroke-width', String(1 / scale));

    // Hex size on screen, in pixels. Fade out below ~12px, hidden below 4px.
    const hexPx = HEX_SIZE_UNITS * scale;
    const opacity = Math.min(1, Math.max(0, (hexPx - 4) / 8));
    element.style.opacity = String(opacity);
  }

  return { element, isVisible: () => visible, setVisible, setScale };
}
