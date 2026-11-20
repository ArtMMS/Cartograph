import { createSvg } from '../core/svg';
import { SCALE_PRESETS, formatDistance, mapScale, type ScalePresetId } from '../core/map-scale';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';
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
  /** Map size preset (Continent / Kingdom / Town) in the HUD. */
  presetSelect: HTMLSelectElement;
  /** "Center map" button in the HUD. */
  centerButton: HTMLButtonElement;
  /** Updates the zoom percentage shown in the HUD (1 = 100%). */
  setZoomLabel(scale: number): void;
  /** Turns hexcrawl mode on/off (grid + HUD label + button state). */
  setHexMode(on: boolean): void;
  /** Paper color (from the Base layer). null = transparent. */
  setPaperColor(color: string | null): void;
  /** Updates the hex grid and HUD after the map scale changes. */
  refreshScale(): void;
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

  // Ocean waves over the Base color.
  const wavePattern = createSvg('pattern', {
    id: 'ocean-waves',
    patternUnits: 'userSpaceOnUse',
    width: 140,
    height: 90,
  });
  wavePattern.innerHTML =
    '<path class="ocean-wave" d="M10,20 q8,-6 16,0 t16,0 M80,12 q6,-5 12,0 t12,0 ' +
    'M50,55 q8,-6 16,0 t16,0 M110,70 q6,-5 12,0 t12,0 M15,78 q6,-5 12,0"/>';
  defs.append(wavePattern);
  const waves = createSvg('rect', {
    class: 'map-view__waves',
    x: 0,
    y: 0,
    width: WORLD_WIDTH,
    height: WORLD_HEIGHT,
    fill: 'url(#ocean-waves)',
  });

  const layers = {
    background: createSvg('g', { 'data-layer': 'background' }),
    drawing: createSvg('g', { 'data-layer': 'drawing' }),
    regions: createSvg('g', { 'data-layer': 'regions' }),
    markers: createSvg('g', { 'data-layer': 'markers' }),
    overlay: createSvg('g', { 'data-layer': 'overlay' }),
  };

  const hexGrid = createHexGrid(defs, mapScale.hexSizeUnits);

  svg.append(
    defs,
    paper,
    waves,
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

  const presetSelect = document.createElement('select');
  presetSelect.className = 'map-hud__select';
  presetSelect.title = 'Map size (sets the hex size and the km scale)';
  for (const preset of SCALE_PRESETS) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = `${preset.icon} ${preset.name}`;
    presetSelect.append(option);
  }

  const hexLabel = document.createElement('span');
  hexLabel.className = 'map-hud__info';
  hexLabel.hidden = true;

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'map-hud__info map-hud__zoom';
  zoomLabel.textContent = '100%';

  const centerButton = document.createElement('button');
  centerButton.type = 'button';
  centerButton.className = 'map-hud__button';
  centerButton.title = 'Center map';
  centerButton.textContent = '⌖ Center';

  hud.append(hexButton, presetSelect, hexLabel, zoomLabel, centerButton);
  element.append(svg, hud);

  function setZoomLabel(scale: number): void {
    zoomLabel.textContent = `${Math.round(scale * 100)}%`;
  }

  function setHexMode(on: boolean): void {
    hexGrid.setVisible(on);
    hexLabel.hidden = !on;
    hexButton.classList.toggle('is-active', on);
  }

  function refreshScale(): void {
    const preset = mapScale.preset;
    presetSelect.value = preset.id satisfies ScalePresetId;
    presetSelect.title = `Map size: ${mapScale.worldSizeLabel}`;
    hexLabel.textContent = `1 hex = ${formatDistance(preset.hexSizeKm)}`;
    hexGrid.setHexSize(mapScale.hexSizeUnits);
  }
  refreshScale();

  function setPaperColor(color: string | null): void {
    paper.style.fill = color ?? 'transparent';
    waves.style.display = color ? '' : 'none';
  }

  return {
    element,
    svg,
    layers,
    hexGrid,
    hexButton,
    presetSelect,
    centerButton,
    setZoomLabel,
    setHexMode,
    setPaperColor,
    refreshScale,
  };
}
