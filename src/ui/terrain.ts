import { createSvg } from '../core/svg';
import { TERRAIN_KINDS, generateTerrain, type TerrainKind } from '../core/terrain';
import type { Viewport } from '../core/viewport';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';
import type { ToolId } from '../tools/tool-ids';
import type { Drawing } from './drawing';
import type { MapView } from './map-view';
import type { Sidebar } from './sidebar';

/** Size (world units) used when the user just clicks instead of dragging a box. */
const CLICK_SIZE: Record<TerrainKind, [number, number]> = {
  continent: [700, 520],
  island: [260, 190],
  archipelago: [520, 380],
  wild: [360, 260],
};

export interface TerrainOptions {
  mapView: MapView;
  viewport: Viewport;
  sidebar: Sidebar;
  drawing: Drawing;
  getActiveTool: () => ToolId;
}

/** Terrain tool (G): drag a box (or click) on the map to generate coastlines automatically. */
export function createTerrainTool(options: TerrainOptions): { onToolChange(id: ToolId): void } {
  const { mapView, viewport, sidebar, drawing } = options;
  const svg = mapView.svg;
  let kind: TerrainKind = 'continent';

  // ---------- Panel ----------

  const panel = document.createElement('div');
  panel.className = 'marker-types';
  const buttons = new Map<TerrainKind, HTMLButtonElement>();
  for (const k of TERRAIN_KINDS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'marker-types__button';
    button.title = k.description;
    button.innerHTML = `<span>${k.icon}</span><span>${k.name}</span>`;
    button.addEventListener('click', () => {
      kind = k.id;
      renderPanel();
    });
    buttons.set(k.id, button);
    panel.append(button);
  }
  const hint = document.createElement('p');
  hint.className = 'marker-types__hint';
  hint.textContent =
    'Drag a box on the map (or just click) to generate land with coast and fill. Not happy? Ctrl+Z and try again.';
  panel.append(hint);
  sidebar.terrainSlot.append(panel);

  function renderPanel(): void {
    for (const [id, button] of buttons) button.classList.toggle('is-active', id === kind);
  }
  renderPanel();

  // ---------- Drag a box ----------

  const box = createSvg('rect', { class: 'terrain-box' });
  box.style.display = 'none';
  mapView.layers.overlay.append(box);

  let start: { pointerId: number; x: number; y: number } | null = null;

  function setBox(x1: number, y1: number, x2: number, y2: number): void {
    box.style.display = '';
    box.setAttribute('x', String(Math.min(x1, x2)));
    box.setAttribute('y', String(Math.min(y1, y2)));
    box.setAttribute('width', String(Math.abs(x2 - x1)));
    box.setAttribute('height', String(Math.abs(y2 - y1)));
  }

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.defaultPrevented || options.getActiveTool() !== 'terrain') return;
    e.preventDefault();
    svg.setPointerCapture(e.pointerId);
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    start = { pointerId: e.pointerId, x: p.x, y: p.y };
  });

  svg.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.pointerId) return;
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    setBox(start.x, start.y, p.x, p.y);
  });

  const finish = (e: PointerEvent): void => {
    if (!start || e.pointerId !== start.pointerId) return;
    if (svg.hasPointerCapture(e.pointerId)) svg.releasePointerCapture(e.pointerId);
    box.style.display = 'none';

    const p = viewport.screenToWorld(e.clientX, e.clientY);
    let x = Math.min(start.x, p.x);
    let y = Math.min(start.y, p.y);
    let width = Math.abs(p.x - start.x);
    let height = Math.abs(p.y - start.y);
    start = null;
    if (e.type === 'pointercancel') return;

    // A click: use a default size around the point.
    if (width * viewport.getScale() < 12 || height * viewport.getScale() < 12) {
      [width, height] = CLICK_SIZE[kind];
      x = p.x - width / 2;
      y = p.y - height / 2;
    }

    // Keep inside the world.
    x = Math.max(0, x);
    y = Math.max(0, y);
    width = Math.min(width, WORLD_WIDTH - x);
    height = Math.min(height, WORLD_HEIGHT - y);

    const outlines = generateTerrain(kind, { x, y, width, height });
    const result = drawing.addGeneratedLand(outlines);
    sidebar.setStatus(
      typeof result === 'string'
        ? result
        : `Generated ${result} landmass${result > 1 ? 'es' : ''} (Ctrl+Z to undo)`,
    );
  };
  svg.addEventListener('pointerup', finish);
  svg.addEventListener('pointercancel', finish);

  return {
    onToolChange: (id) => sidebar.setTerrainVisible(id === 'terrain'),
  };
}
