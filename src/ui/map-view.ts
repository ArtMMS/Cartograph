import { createSvg } from '../core/svg';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';

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
  /** "Center map" button in the bottom-right corner. */
  centerButton: HTMLButtonElement;
  /** Updates the zoom percentage shown in the corner (1 = 100%). */
  setZoomLabel(scale: number): void;
}

export function createMapView(): MapView {
  const element = document.createElement('main');
  element.className = 'map-view';

  const svg = createSvg('svg', {
    class: 'map-view__svg',
    viewBox: `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`,
    preserveAspectRatio: 'xMinYMin meet',
  });

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

  svg.append(
    paper,
    layers.background,
    layers.regions,
    layers.drawing,
    layers.markers,
    layers.overlay,
  );

  // HUD: zoom level + center button.
  const hud = document.createElement('div');
  hud.className = 'map-hud';

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'map-hud__zoom';
  zoomLabel.textContent = '100%';

  const centerButton = document.createElement('button');
  centerButton.type = 'button';
  centerButton.className = 'map-hud__button';
  centerButton.title = 'Center map';
  centerButton.textContent = '⌖ Center';

  hud.append(zoomLabel, centerButton);
  element.append(svg, hud);

  function setZoomLabel(scale: number): void {
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  return { element, svg, layers, centerButton, setZoomLabel };
}
