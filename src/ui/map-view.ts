import { createSvg } from '../core/svg';
import { HEX_SIZE_KM, WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';
import { createHexGrid, type HexGrid } from './hex-grid';

export interface MapView {
  element: HTMLElement;
  svg: SVGSVGElement;
  /** Groups drawn from bottom to top. */
  layers: {
    background: SVGGElement;
    drawing: SVGGElement;
    regions: SVGGElement;
    markers: SVGGElement;
    overlay: SVGGElement;
  };
  hexGrid: HexGrid;
  /** "Hex" toggle button in the HUD. */
  hexButton: HTMLButtonElement;
  /** "Center map" button in the HUD. */
  centerButton: HTMLButtonElement;
  /** Updates the zoom percentage shown in the HUD (1 = 100%). */
  setZoomLabel(scale: number): void;
  /** Turns hexcrawl mode on/off (grid + HUD label + button state). */
  setHexMode(on: boolean): void;
}

export function createMapView(): MapView {
  const element = document.createElement('main');
  element.className = 'map-view';

  const svg = createSvg('svg', {
    class: 'map-view__svg',
    viewBox: `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`,
    preserveAspectRatio: 'xMinYMin meet',
  });

  const defs = createSvg('defs');

  // Paper: the drawable area of the world.
  const paper = createSvg('rect', {
    class: 'map-view__paper',
    x: 0,
    y: 0,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
  });

  const layers = {
    background: createSvg('g', { 'data-layer': 'background' }),
    drawing: createSvg('g', { 'data-layer': 'drawing' }),
    regions: createSvg('g', { 'data-layer': 'regions' }),
    markers: createSvg('g', { 'data-layer': 'markers' }),
    overlay: createSvg('g', { 'data-layer': 'overlay' }),
  };

  const hexGrid = createHexGrid(defs);

  svg.append(
    defs,
    paper,
    layers.background,
    layers.regions,
    layers.drawing,
    hexGrid.element,
    layers.markers,
    layers.overlay,
  );

  // ---------- HUD ----------
  const hud = document.createElement('div');
  hud.className = 'map-hud';

  const hexButton = document.createElement('button');
  hexButton.type = 'button';
  hexButton.className = 'map-hud__button';
  hexButton.title = 'Toggle hexcrawl grid';
  hexButton.textContent = '⬡ Hex';

  const hexLabel = document.createElement('span');
  hexLabel.className = 'map-hud__info';
  hexLabel.textContent = `1 hex = ${HEX_SIZE_KM} km`;
  hexLabel.hidden = true;

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'map-hud__info map-hud__zoom';
  zoomLabel.textContent = '100%';

  const centerButton = document.createElement('button');
  centerButton.type = 'button';
  centerButton.className = 'map-hud__button';
  centerButton.title = 'Center map';
  centerButton.textContent = '⌖ Center';

  hud.append(hexButton, hexLabel, zoomLabel, centerButton);
  element.append(svg, hud);

  function setZoomLabel(scale: number): void {
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function setHexMode(on: boolean): void {
    hexGrid.setVisible(on);
    hexLabel.hidden = !on;
    hexButton.classList.toggle('is-active', on);
  }

  return {
    element,
    svg,
    layers,
    hexGrid,
    hexButton,
    centerButton,
    setZoomLabel,
    setHexMode,
  };
}
