import {
  canEditBackground,
  createBackground,
  fitBackground,
  loadImageFile,
  setScalePercent,
  type BackgroundImage,
} from '../core/background';
import { applyTheme, loadTheme, type Theme } from '../core/theme';
import { Viewport } from '../core/viewport';
import { attachBackgroundMove } from '../tools/background-move';
import { TOOLS, type ToolId } from '../tools/tool-ids';
import { createBackgroundLayer } from './background-layer';
import { createBackgroundPanel } from './background-panel';
import { createMapView, type MapView } from './map-view';
import { createSidebar, type Sidebar } from './sidebar';
import { createToolbar, type Toolbar } from './toolbar';

export interface AppLayout {
  toolbar: Toolbar;
  mapView: MapView;
  sidebar: Sidebar;
  viewport: Viewport;
}

/** Builds the main screen: toolbar (left), map (center), sidebar (right). */
export function createLayout(root: HTMLElement): AppLayout {
  root.classList.add('app');

  let activeTool: ToolId = 'pan';
  let theme: Theme = loadTheme();
  let hexMode = false;
  let background: BackgroundImage | null = null;
  let moveBackground = false;

  const sidebar = createSidebar();
  const mapView = createMapView();
  const toolbar = createToolbar({
    onSelectTool: selectTool,
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  });

  root.append(toolbar.element, mapView.element, sidebar.element);

  // ---------- Viewport ----------

  const viewport = new Viewport({
    svg: mapView.svg,
    container: mapView.element,
    canPanWithLeftButton: () => activeTool === 'pan' && !moveBackground,
    onChange: (scale) => {
      mapView.setZoomLabel(scale);
      mapView.hexGrid.setScale(scale);
    },
  });

  mapView.centerButton.addEventListener('click', () => viewport.fit());
  mapView.hexButton.addEventListener('click', () => {
    hexMode = !hexMode;
    mapView.setHexMode(hexMode);
  });

  // ---------- Background image ----------

  const backgroundLayer = createBackgroundLayer(mapView.layers.background);

  const backgroundPanel = createBackgroundPanel({
    onLoadFile: (file) => {
      loadImageFile(file)
        .then((image) => {
          background = createBackground(image);
          updateBackground();
          sidebar.setStatus(`Background loaded: ${image.name}`);
        })
        .catch((err: unknown) => {
          backgroundPanel.showError(err instanceof Error ? err.message : String(err));
        });
    },
    onOpacity: (opacity) => {
      if (!background) return;
      background.opacity = opacity;
      updateBackground();
    },
    onScalePercent: (percent) => {
      if (!background || !canEditBackground(background)) return;
      setScalePercent(background, percent);
      updateBackground();
    },
    onPosition: (x, y) => {
      if (!background || !canEditBackground(background)) return;
      background.x = x;
      background.y = y;
      updateBackground();
    },
    onToggleMove: () => {
      if (!background || !canEditBackground(background)) return;
      setMoveBackground(!moveBackground);
    },
    onToggleLock: () => {
      if (!background) return;
      background.locked = !background.locked;
      if (background.locked) setMoveBackground(false);
      updateBackground();
      sidebar.setStatus(background.locked ? 'Background locked' : 'Background unlocked');
    },
    onToggleVisible: () => {
      if (!background) return;
      background.visible = !background.visible;
      if (!background.visible) setMoveBackground(false);
      updateBackground();
      sidebar.setStatus(background.visible ? 'Background shown' : 'Background hidden');
    },
    onFit: () => {
      if (!background || !canEditBackground(background)) return;
      fitBackground(background);
      updateBackground();
    },
    onRemove: () => {
      background = null;
      setMoveBackground(false);
      updateBackground();
      sidebar.setStatus('Background removed');
    },
  });
  sidebar.backgroundSlot.append(backgroundPanel.element);

  attachBackgroundMove({
    svg: mapView.svg,
    viewport,
    isActive: () => moveBackground && background !== null && canEditBackground(background),
    onDrag: (dx, dy) => {
      if (!background) return;
      background.x += dx;
      background.y += dy;
      updateBackground();
    },
  });

  function updateBackground(): void {
    backgroundLayer.render(background);
    backgroundPanel.render(background, moveBackground);
  }

  function setMoveBackground(on: boolean): void {
    moveBackground = on;
    mapView.element.classList.toggle('is-moving-bg', on);
    viewport.refreshCursor();
    updateBackground();
  }

  // ---------- Tools & theme ----------

  function selectTool(id: ToolId): void {
    activeTool = id;
    toolbar.setActive(id);
    viewport.refreshCursor();

    const tool = TOOLS.find((t) => t.id === id);
    sidebar.setStatus(`Tool: ${tool?.label ?? id}`);
  }

  function setTheme(value: Theme): void {
    theme = value;
    applyTheme(value);
    toolbar.setTheme(value);
  }

  setTheme(theme);
  selectTool('pan');

  return { toolbar, mapView, sidebar, viewport };
}
