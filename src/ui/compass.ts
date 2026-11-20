import { formatDistance, mapScale } from '../core/map-scale';

const STORAGE_KEY = 'cartograph.compass';

/** Compass rose (English N / E / S / W) as SVG markup, `size` × `size`, centered at (size/2, size/2). */
export function compassRoseSvg(size: number): string {
  const c = size / 2;
  const r = size * 0.36;
  const small = r * 0.55;
  const w = r * 0.16;
  const point = (angle: number, len: number, width: number, dark: boolean): string => {
    const a = (angle * Math.PI) / 180;
    const tip = [c + Math.sin(a) * len, c - Math.cos(a) * len];
    const left = [c + Math.sin(a - Math.PI / 2) * width, c - Math.cos(a - Math.PI / 2) * width];
    const right = [c + Math.sin(a + Math.PI / 2) * width, c - Math.cos(a + Math.PI / 2) * width];
    const f = (n: number): string => n.toFixed(1);
    return (
      `<path d="M${f(c)},${f(c)} L${f(left[0])},${f(left[1])} L${f(tip[0])},${f(tip[1])} Z" fill="${dark ? '#3b2a1a' : '#f6ecd2'}" stroke="#3b2a1a" stroke-width="1"/>` +
      `<path d="M${f(c)},${f(c)} L${f(right[0])},${f(right[1])} L${f(tip[0])},${f(tip[1])} Z" fill="${dark ? '#f6ecd2' : '#3b2a1a'}" stroke="#3b2a1a" stroke-width="1"/>`
    );
  };
  const label = (text: string, x: number, y: number): string =>
    `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" ` +
    `font-family="Georgia, serif" font-weight="700" font-size="${(size * 0.13).toFixed(1)}" fill="#3b2a1a">${text}</text>`;

  return (
    `<circle cx="${c}" cy="${c}" r="${(r * 1.02).toFixed(1)}" fill="none" stroke="#3b2a1a" stroke-width="1" opacity="0.6"/>` +
    `<circle cx="${c}" cy="${c}" r="${(r * 0.8).toFixed(1)}" fill="none" stroke="#3b2a1a" stroke-width="0.6" opacity="0.5"/>` +
    [45, 135, 225, 315].map((a) => point(a, small, w * 0.8, a % 90 !== 0)).join('') +
    [0, 90, 180, 270].map((a) => point(a, r, w, true)).join('') +
    `<circle cx="${c}" cy="${c}" r="${(w * 0.6).toFixed(1)}" fill="#3b2a1a"/>` +
    label('N', c, c - r - size * 0.09) +
    label('S', c, c + r + size * 0.09) +
    label('E', c + r + size * 0.09, c) +
    label('W', c - r - size * 0.09, c)
  );
}

/** A "nice" scale-bar length (1, 2, 5 × 10ⁿ km) close to `maxKm`. */
export function niceDistance(maxKm: number): number {
  const exp = Math.pow(10, Math.floor(Math.log10(maxKm)));
  for (const m of [5, 2, 1]) if (m * exp <= maxKm) return m * exp;
  return exp;
}

/** Scale bar as SVG markup: a black/white bar `px` long labeled with `km`. */
export function scaleBarSvg(px: number, km: number, x = 0, y = 0, fontSize = 11): string {
  const half = px / 2;
  return (
    `<g transform="translate(${x} ${y})">` +
    `<rect x="0" y="0" width="${half.toFixed(1)}" height="6" fill="#3b2a1a"/>` +
    `<rect x="${half.toFixed(1)}" y="0" width="${half.toFixed(1)}" height="6" fill="#f6ecd2" stroke="#3b2a1a" stroke-width="1"/>` +
    `<rect x="0" y="0" width="${px.toFixed(1)}" height="6" fill="none" stroke="#3b2a1a" stroke-width="1"/>` +
    `<text x="0" y="${6 + fontSize + 2}" font-family="Georgia, serif" font-size="${fontSize}" fill="#3b2a1a">0</text>` +
    `<text x="${px.toFixed(1)}" y="${6 + fontSize + 2}" text-anchor="end" font-family="Georgia, serif" font-size="${fontSize}" fill="#3b2a1a">${formatDistance(km)}</text>` +
    `</g>`
  );
}

export interface CompassOverlay {
  isVisible(): boolean;
  setVisible(visible: boolean): void;
  /** Updates the scale bar for the current zoom. */
  setZoom(scale: number): void;
}

/** Compass rose + scale bar in the bottom-left corner of the map (screen overlay). */
export function createCompassOverlay(parent: HTMLElement): CompassOverlay {
  const element = document.createElement('div');
  element.className = 'compass';
  element.innerHTML = `
    <svg class="compass__rose" viewBox="0 0 110 110" width="110" height="110">${compassRoseSvg(110)}</svg>
    <svg class="compass__scale" width="170" height="26"></svg>
  `;
  parent.append(element);

  const scaleSvg = element.querySelector<SVGSVGElement>('.compass__scale')!;
  let visible = loadVisible();
  let zoom = 1;

  function setZoom(scale: number): void {
    zoom = scale;
    if (!visible) return;
    const kmPerPx = mapScale.kmPerUnit / scale;
    const km = niceDistance(150 * kmPerPx);
    const px = km / kmPerPx;
    scaleSvg.innerHTML = scaleBarSvg(px, km, 4, 2);
  }

  function setVisible(value: boolean): void {
    visible = value;
    element.hidden = !value;
    try {
      localStorage.setItem(STORAGE_KEY, value ? '1' : '0');
    } catch {
      // Not critical.
    }
    setZoom(zoom);
  }

  mapScale.onChange(() => setZoom(zoom));
  setVisible(visible);

  return { isVisible: () => visible, setVisible, setZoom };
}

function loadVisible(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}
