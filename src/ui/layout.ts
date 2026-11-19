import {
  canEditBackground,
  createBackground,
  fitBackground,
  loadImageFile,
  setScalePercent,
  type BackgroundImage,
} from '../core/background';
import { applyTheme, loadTheme, type Theme } from '../core/theme';
import { History } from '../core/history';
import { Viewport } from '../core/viewport';
import {
  createBackgroundTransform,
  type BackgroundTransform,
} from '../tools/background-transform';
import { attachShortcuts } from '../tools/shortcuts';
import { TOOLS, type ToolId } from '../tools/tool-ids';
import { createBackgroundLayer } from './background-layer';
import { createBackgroundPanel } from './background-panel';
import { createDrawing } from './drawing';
import { attachFileDrop } from './drop-zone';
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
  let transformBackground = false;
  let transform: BackgroundTransform | null = null;
  const history = new History();

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
    canPanWithLeftButton: (e) => {
      if (activeTool !== 'pan') return false;
      // In Transform mode, dragging the image (or its handles) edits it
      // instead of panning; dragging anywhere else still pans.
      if (e && transform?.hitTest(e)) return false;
      return true;
    },
    onChange: (scale) => {
      mapView.setZoomLabel(scale);
      mapView.hexGrid.setScale(scale);
      transform?.render();
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
    onLoadFile: loadBackgroundFile,
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
      // Transform works with the Pan tool, so drawing tools don't fight over the mouse.
      if (!transformBackground) selectTool('pan');
      setTransformBackground(!transformBackground);
    },
    onToggleLock: () => {
      if (!background) return;
      background.locked = !background.locked;
      if (background.locked) setTransformBackground(false);
      updateBackground();
      sidebar.setStatus(background.locked ? 'Background locked' : 'Background unlocked');
    },
    onToggleVisible: () => {
      if (!background) return;
      background.visible = !background.visible;
      if (!background.visible) setTransformBackground(false);
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
      setTransformBackground(false);
      updateBackground();
      sidebar.setStatus('Background removed');
    },
  });
  sidebar.backgroundSlot.append(backgroundPanel.element);

  transform = createBackgroundTransform({
    svg: mapView.svg,
    viewport,
    overlay: mapView.layers.overlay,
    getBackground: () => background,
    isActive: () =>
      transformBackground && background !== null && canEditBackground(background),
    onChange: updateBackground,
  });

  attachFileDrop(mapView.element, '📂 Drop image to use as background', loadBackgroundFile);

  function loadBackgroundFile(file: File): void {
    loadImageFile(file)
      .then((image) => {
        background = createBackground(image);
        setTransformBackground(false);
        updateBackground();
        sidebar.setStatus(`Background loaded: ${image.name}`);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        backgroundPanel.showError(message);
        sidebar.setStatus(message);
      });
  }

  function updateBackground(): void {
    backgroundLayer.render(background);
    backgroundPanel.render(background, transformBackground);
    transform?.render();
  }

  function setTransformBackground(on: boolean): void {
    transformBackground = on;
    viewport.refreshCursor();
    updateBackground();
  }

  // ---------- Drawing ----------

  const drawing = createDrawing({
    mapView,
    viewport,
    sidebar,
    history,
    getActiveTool: () => activeTool,
  });

  // ---------- Undo / redo & shortcuts ----------

  function undo(): void {
    const command = history.undo();
    drawing.refreshSelection();
    sidebar.setStatus(command ? `Undo: ${command.label}` : 'Nothing to undo');
  }

  function redo(): void {
    const command = history.redo();
    drawing.refreshSelection();
    sidebar.setStatus(command ? `Redo: ${command.label}` : 'Nothing to redo');
  }

  attachShortcuts({
    onTool: selectTool,
    onUndo: undo,
    onRedo: redo,
    onDelete: () => drawing.deleteSelection(),
    onEscape: () => drawing.clearSelection(),
  });

  // ---------- Tools & theme ----------

  function selectTool(id: ToolId): void {
    activeTool = id;
    toolbar.setActive(id);
    mapView.element.dataset.tool = id;
    drawing.onToolChange(id);
    if (id !== 'pan') setTransformBackground(false);
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
