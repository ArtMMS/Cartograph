import { applyTheme, loadTheme, type Theme } from '../core/theme';
import { Viewport } from '../core/viewport';
import { TOOLS, type ToolId } from '../tools/tool-ids';
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

  const sidebar = createSidebar();
  const mapView = createMapView();
  const toolbar = createToolbar({
    onSelectTool: selectTool,
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  });

  root.append(toolbar.element, mapView.element, sidebar.element);

  const viewport = new Viewport({
    svg: mapView.svg,
    container: mapView.element,
    canPanWithLeftButton: () => activeTool === 'pan',
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
