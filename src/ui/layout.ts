import { TOOLS, type ToolId } from '../tools/tool-ids';
import { createMapView, type MapView } from './map-view';
import { createSidebar, type Sidebar } from './sidebar';
import { createToolbar, type Toolbar } from './toolbar';

export interface AppLayout {
  toolbar: Toolbar;
  mapView: MapView;
  sidebar: Sidebar;
}

/** Builds the main screen: toolbar (left), map (center), sidebar (right). */
export function createLayout(root: HTMLElement): AppLayout {
  root.classList.add('app');

  const sidebar = createSidebar();
  const mapView = createMapView();
  const toolbar = createToolbar(selectTool);

  function selectTool(id: ToolId): void {
    toolbar.setActive(id);
    const tool = TOOLS.find((t) => t.id === id);
    sidebar.setStatus(`Tool: ${tool?.label ?? id}`);
  }

  root.append(toolbar.element, mapView.element, sidebar.element);
  selectTool('pan');

  return { toolbar, mapView, sidebar };
}
