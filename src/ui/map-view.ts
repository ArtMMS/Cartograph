import { createSvg } from '../core/svg';

/** Size of the map "world" in SVG units. */
export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 1500;

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
}

export function createMapView(): MapView {
  const element = document.createElement('main');
  element.className = 'map-view';

  const svg = createSvg('svg', {
    class: 'map-view__svg',
    viewBox: `0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`,
    preserveAspectRatio: 'xMidYMid meet',
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
  element.append(svg);

  return { element, svg, layers };
}
