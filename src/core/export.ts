import { compassRoseSvg, niceDistance, scaleBarSvg } from '../ui/compass';
import { mapScale } from './map-scale';
import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

export type ExportFormat = 'png' | 'svg';

export interface ExportOptions {
  /** Include city and region names. */
  labels: boolean;
  /** Include compass rose and scale bar. */
  compass: boolean;
}

/**
 * Size of markers and labels in the exported image, relative to the editor.
 * On screen they keep a fixed pixel size; in the export they become part of the map.
 */
const SYMBOL_SCALE = 2;
/** PNG resolution: pixels per world unit (2 → 4000 × 3000). */
const PNG_SCALE = 2;

/** Builds a standalone SVG of the whole map (world area only, no editor UI). */
export function buildExportSvg(source: SVGSVGElement, options: ExportOptions): string {
  const svg = source.cloneNode(true) as SVGSVGElement;

  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  svg.setAttribute('viewBox', `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`);
  svg.setAttribute('width', String(WORLD_WIDTH));
  svg.setAttribute('height', String(WORLD_HEIGHT));
  svg.removeAttribute('class');
  // Keep the "hide …" display classes (hidden marker/region types, labels).
  const keep = [...source.classList].filter((c) => c.startsWith('hide-'));
  if (keep.length) svg.setAttribute('class', keep.join(' '));

  // Editor-only things.
  svg
    .querySelectorAll(
      '.bg-transform, .measure, .snap-hint, .stroke--preview, .region-preview, .marker__hit, .marker__ring',
    )
    .forEach((el) => el.remove());
  svg.querySelectorAll('.is-selected, .is-viewed').forEach((el) => {
    el.classList.remove('is-selected', 'is-viewed');
  });

  if (!options.labels) svg.querySelectorAll('.marker__label, .region-label').forEach((el) => el.remove());

  // Markers and labels: fixed size relative to the map (instead of the current zoom).
  svg.querySelectorAll('.marker, .region-label').forEach((el) => {
    const t = el.getAttribute('transform') ?? '';
    el.setAttribute('transform', t.replace(/scale\([^)]*\)/, `scale(${SYMBOL_SCALE})`));
  });

  // Hex grid lines: 1 unit thick.
  svg.querySelector('.hex-grid__line')?.setAttribute('stroke-width', '1');

  if (options.compass) svg.append(compassAndScale());

  // Styles: copy the app's CSS rules so the file looks the same anywhere.
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
  style.textContent = collectCss() + `svg{--grid:rgba(60,50,30,.35);--canvas-paper:#fff;--canvas-border:#d4ccba}`;
  svg.insertBefore(style, svg.firstChild);

  return '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(svg);
}

/** Renders the SVG into a PNG. */
export function svgToPng(svgText: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = WORLD_WIDTH * PNG_SCALE;
      canvas.height = WORLD_HEIGHT * PNG_SCALE;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
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

/** Compass rose (bottom-right) and scale bar (bottom-left) in world units. */
function compassAndScale(): SVGGElement {
  const size = 200;
  const barMaxUnits = 320;
  const km = niceDistance(barMaxUnits * mapScale.kmPerUnit);
  const units = km / mapScale.kmPerUnit;

  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
  g.innerHTML =
    `<g transform="translate(${WORLD_WIDTH - size - 30} ${WORLD_HEIGHT - size - 30})">${compassRoseSvg(size)}</g>` +
    `<g transform="translate(40 ${WORLD_HEIGHT - 70}) scale(2.2)">${scaleBarSvg(units / 2.2, km, 0, 0, 11)}</g>`;
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
