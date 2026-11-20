import { compassRoseSvg, niceDistance, scaleBarSvg } from '../ui/compass';
import { mapScale } from './map-scale';
import type { Box } from './terrain';
import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

export type ExportFormat = 'png' | 'svg';
export type BorderStyle = 'none' | 'classic' | 'royal';

export interface ExportOptions {
  /** Include city and region names. */
  labels: boolean;
  /** Include compass rose and scale bar. */
  compass: boolean;
  /** Include the hex grid. */
  hex: boolean;
  /** Part of the world to export (world units). */
  crop: Box;
  /** Length of the longest side of the map area, in pixels (1K/2K/4K). */
  longSide: number;
  border: BorderStyle;
  /** Shown in the border's title area (empty = no title). */
  title: string;
}

export const RESOLUTIONS = [
  { id: '1k', name: '1K', longSide: 1024 },
  { id: '2k', name: '2K', longSide: 2048 },
  { id: '4k', name: '4K', longSide: 4096 },
] as const;

export function fullWorld(): Box {
  return { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
}

/** Frame thickness (px) for a border style at a given map size. */
function frameWidth(border: BorderStyle, w: number, h: number): number {
  const base = Math.min(w, h);
  if (border === 'classic') return Math.round(base * 0.035);
  if (border === 'royal') return Math.round(base * 0.06);
  return 0;
}

/** Final image size in pixels (map area + frame). */
export function exportSize(options: Pick<ExportOptions, 'crop' | 'longSide' | 'border'>): {
  width: number;
  height: number;
  mapWidth: number;
  mapHeight: number;
  frame: number;
} {
  const { crop, longSide } = options;
  const landscape = crop.width >= crop.height;
  const mapWidth = Math.round(landscape ? longSide : (longSide * crop.width) / crop.height);
  const mapHeight = Math.round(landscape ? (longSide * crop.height) / crop.width : longSide);
  const frame = frameWidth(options.border, mapWidth, mapHeight);
  return { width: mapWidth + 2 * frame, height: mapHeight + 2 * frame, mapWidth, mapHeight, frame };
}

const SVG_NS = 'http://www.w3.org/2000/svg';

/** Builds a standalone SVG of the map (no editor UI), cropped, sized and framed. */
export function buildExportSvg(source: SVGSVGElement, options: ExportOptions): string {
  const { crop } = options;
  const size = exportSize(options);
  const { width, height, mapWidth, mapHeight, frame } = size;
  const pxPerUnit = mapWidth / crop.width;
  // Markers and labels: same proportion of the picture whatever the crop/resolution
  // (13 px labels on a 1600 px wide picture).
  const symbolScale = mapWidth / 1600 / pxPerUnit;

  const map = source.cloneNode(true) as SVGSVGElement;
  map.removeAttribute('class');
  const keep = [...source.classList].filter((c) => c.startsWith('hide-'));
  if (keep.length) map.setAttribute('class', keep.join(' '));

  map
    .querySelectorAll(
      '.bg-transform, .measure, .snap-hint, .stroke--preview, .region-preview, .marker__hit, .marker__ring, .terrain-box',
    )
    .forEach((el) => el.remove());
  map.querySelectorAll('.is-selected, .is-viewed').forEach((el) => el.classList.remove('is-selected', 'is-viewed'));
  if (!options.labels) map.querySelectorAll('.marker__label, .region-label').forEach((el) => el.remove());

  map.querySelectorAll('.marker, .region-label').forEach((el) => {
    const t = el.getAttribute('transform') ?? '';
    el.setAttribute('transform', t.replace(/scale\([^)]*\)/, `scale(${symbolScale})`));
  });

  const hexGroup = map.querySelector<SVGGElement>('.hex-grid');
  if (hexGroup) {
    hexGroup.style.display = options.hex ? '' : 'none';
    hexGroup.style.opacity = '1';
  }
  map.querySelector('.hex-grid__line')?.setAttribute('stroke-width', String(1.2 / pxPerUnit));

  // The map becomes a nested <svg> showing only the cropped area.
  map.setAttribute('x', String(frame));
  map.setAttribute('y', String(frame));
  map.setAttribute('width', String(mapWidth));
  map.setAttribute('height', String(mapHeight));
  map.setAttribute('viewBox', `${crop.x} ${crop.y} ${crop.width} ${crop.height}`);
  map.setAttribute('preserveAspectRatio', 'none');
  map.removeAttribute('style');

  const outer = document.createElementNS(SVG_NS, 'svg');
  outer.setAttribute('xmlns', SVG_NS);
  outer.setAttribute('width', String(width));
  outer.setAttribute('height', String(height));
  outer.setAttribute('viewBox', `0 0 ${width} ${height}`);

  const style = document.createElementNS(SVG_NS, 'style');
  style.textContent = collectCss() + `svg{--grid:rgba(60,50,30,.45);--canvas-paper:#fff;--canvas-border:#d4ccba}`;
  outer.append(style, map);

  if (options.compass) outer.append(compassAndScale(size, pxPerUnit));
  if (options.border !== 'none') outer.append(borderGroup(options.border, size, options.title.trim()));

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(outer);
}

/** Renders the SVG into a PNG of the same size. */
export function svgToPng(svgText: string, width: number, height: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not render the map image'));
    };
    img.src = url;
  });
}

// ---------- Compass and scale (in picture pixels) ----------

function compassAndScale(size: ReturnType<typeof exportSize>, pxPerUnit: number): SVGGElement {
  const { frame, mapWidth, mapHeight } = size;
  const unit = mapWidth / 1600; // proportional to the picture
  const rose = 130 * unit;
  const kmPerPx = mapScale.kmPerUnit / pxPerUnit;
  const km = niceDistance(260 * unit * kmPerPx);
  const barPx = km / kmPerPx;

  const g = document.createElementNS(SVG_NS, 'g');
  g.innerHTML =
    `<g transform="translate(${frame + mapWidth - rose - 20 * unit} ${frame + mapHeight - rose - 20 * unit})">` +
    `${compassRoseSvg(rose)}</g>` +
    // Scale bar next to the compass (the bottom-left corner is kept free for the title).
    `<g transform="translate(${frame + mapWidth - rose - 40 * unit - barPx} ${frame + mapHeight - 44 * unit}) scale(${unit * 1.4})">` +
    `${scaleBarSvg(barPx / (unit * 1.4), km, 0, 0, 11)}</g>`;
  return g;
}

// ---------- Borders ----------

function borderGroup(style: BorderStyle, size: ReturnType<typeof exportSize>, title: string): SVGGElement {
  const { width: W, height: H, frame: t, mapWidth: mw } = size;
  const g = document.createElementNS(SVG_NS, 'g');
  const esc = (s: string): string =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  if (style === 'classic') {
    // Thin dark frame with light inner lines and corner ornaments (old adventure maps).
    const corner = (x: number, y: number): string =>
      `<rect x="${x - t * 0.45}" y="${y - t * 0.45}" width="${t * 0.9}" height="${t * 0.9}" ` +
      `transform="rotate(45 ${x} ${y})" fill="#2e2b26" stroke="#d9d2bf" stroke-width="${t * 0.08}"/>`;
    let html =
      `<path fill-rule="evenodd" fill="#2e2b26" d="M0,0 H${W} V${H} H0 Z M${t},${t} V${H - t} H${W - t} V${t} Z"/>` +
      `<rect x="${t * 0.25}" y="${t * 0.25}" width="${W - t * 0.5}" height="${H - t * 0.5}" fill="none" stroke="#d9d2bf" stroke-width="${t * 0.06}"/>` +
      `<rect x="${t * 0.85}" y="${t * 0.85}" width="${W - t * 1.7}" height="${H - t * 1.7}" fill="none" stroke="#d9d2bf" stroke-width="${t * 0.08}"/>` +
      corner(t / 2, t / 2) +
      corner(W - t / 2, t / 2) +
      corner(t / 2, H - t / 2) +
      corner(W - t / 2, H - t / 2);
    if (title) {
      const fs = mw * 0.035;
      html +=
        `<text x="${W / 2}" y="${t + fs * 1.4}" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" ` +
        `font-size="${fs}" font-weight="700" fill="#1e1c18" stroke="#f3eedf" stroke-width="${fs * 0.18}" ` +
        `paint-order="stroke" stroke-linejoin="round">${esc(title)}</text>`;
    }
    g.innerHTML = html;
    return g;
  }

  // Royal: thick red-brown wooden frame with gold lines and a title cartouche (bottom-left).
  let html =
    `<defs><linearGradient id="frame-wood" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#7a3420"/><stop offset="0.5" stop-color="#5a2416"/><stop offset="1" stop-color="#7a3420"/>` +
    `</linearGradient></defs>` +
    `<path fill-rule="evenodd" fill="url(#frame-wood)" d="M0,0 H${W} V${H} H0 Z M${t},${t} V${H - t} H${W - t} V${t} Z"/>` +
    `<rect x="${t * 0.12}" y="${t * 0.12}" width="${W - t * 0.24}" height="${H - t * 0.24}" fill="none" stroke="#2a0f08" stroke-width="${t * 0.08}"/>` +
    `<rect x="${t * 0.42}" y="${t * 0.42}" width="${W - t * 0.84}" height="${H - t * 0.84}" fill="none" stroke="#c9a35b" stroke-width="${t * 0.05}"/>` +
    `<rect x="${t * 0.92}" y="${t * 0.92}" width="${W - t * 1.84}" height="${H - t * 1.84}" fill="none" stroke="#c9a35b" stroke-width="${t * 0.07}"/>`;

  if (title) {
    const words = title.toUpperCase().split(/\s+/);
    const lines =
      words.length > 2 ? [words.slice(0, Math.ceil(words.length / 2)).join(' '), words.slice(Math.ceil(words.length / 2)).join(' ')] : [words.join(' ')];
    const boxW = mw * 0.26;
    const fs = Math.min(mw * 0.04, (boxW * 0.85) / Math.max(...lines.map((l) => l.length * 0.62)));
    const boxH = fs * (lines.length * 1.25 + 1.2);
    const bx = t + mw * 0.02;
    const by = H - t - boxH - mw * 0.02;
    html +=
      `<rect x="${bx}" y="${by}" width="${boxW}" height="${boxH}" fill="#efe4c8" stroke="#5a2416" stroke-width="${fs * 0.18}"/>` +
      `<rect x="${bx + fs * 0.3}" y="${by + fs * 0.3}" width="${boxW - fs * 0.6}" height="${boxH - fs * 0.6}" fill="none" stroke="#7a3420" stroke-width="${fs * 0.06}"/>` +
      lines
        .map(
          (line, i) =>
            `<text x="${bx + boxW / 2}" y="${by + fs * (1.45 + i * 1.25)}" text-anchor="middle" ` +
            `font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="${fs}" ` +
            `letter-spacing="${fs * 0.06}" fill="#5a2416">${esc(line)}</text>`,
        )
        .join('');
  }
  g.innerHTML = html;
  return g;
}

function collectCss(): string {
  let css = '';
  for (const sheet of [...document.styleSheets]) {
    try {
      for (const rule of [...sheet.cssRules]) css += rule.cssText + '\n';
    } catch {
      // Stylesheets from other origins can't be read — skip them.
    }
  }
  return css;
}
