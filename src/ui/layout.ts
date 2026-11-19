import {
  fitBackground,
  loadImageFile,
  setScalePercent,
  type BackgroundImage,
} from '../core/background';
import { History } from '../core/history';
import { isLayerEditable, type Layer } from '../core/layer';
import { isScalePresetId, mapScale } from '../core/map-scale';
import { applyTheme, loadTheme, type Theme } from '../core/theme';
import { Viewport } from '../core/viewport';
import {
  createBackgroundTransform,
  type BackgroundTransform,
} from '../tools/background-transform';
import { attachShortcuts } from '../tools/shortcuts';
import { TOOLS, type ToolId } from '../tools/tool-ids';
import { createBackgroundPanel } from './background-panel';
import { createDrawing } from './drawing';
import { createFileController } from './file-controller';
import { createMarkers, type Markers } from './markers';
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
  let transformMode = false;
  let transform: BackgroundTransform | null = null;
  let markers: Markers | null = null;
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
      markers?.setZoom(scale);
    },
  });

  mapView.centerButton.addEventListener('click', () => viewport.fit());
  mapView.hexButton.addEventListener('click', () => {
    hexMode = !hexMode;
    mapView.setHexMode(hexMode);
  });

  // ---------- Drawing & layers ----------

  const drawing = createDrawing({
    mapView,
    viewport,
    sidebar,
    history,
    getActiveTool: () => activeTool,
  });

  // ---------- Markers (cities, villages, POIs) ----------

  const markerController = createMarkers({
    mapView,
    viewport,
    sidebar,
    history,
    drawing,
    getActiveTool: () => activeTool,
  });
  markers = markerController;

  // ---------- Image layers ----------

  /** The active layer, if it's an image layer. */
  function activeImageLayer(): Layer | null {
    const layer = drawing.layers.getActive();
    return layer.kind === 'image' && layer.image ? layer : null;
  }

  /** The active layer's image, if it can be moved/resized (visible and unlocked). */
  function editableImage(): BackgroundImage | null {
    const layer = activeImageLayer();
    return layer && isLayerEditable(layer) ? (layer.image ?? null) : null;
  }

  const imagePanel = createBackgroundPanel({
    onLoadFile: loadImage,
    onOpacity: (opacity) => {
      const image = activeImageLayer()?.image;
      if (!image) return;
      image.opacity = opacity;
      drawing.layers.notify();
    },
    onScalePercent: (percent) => {
      const image = editableImage();
      if (!image) return;
      setScalePercent(image, percent);
      drawing.layers.notify();
    },
    onPosition: (x, y) => {
      const image = editableImage();
      if (!image) return;
      image.x = x;
      image.y = y;
      drawing.layers.notify();
    },
    onToggleMove: () => {
      if (!editableImage()) return;
      // Transform works with the Pan tool, so drawing tools don't fight over the mouse.
      if (!transformMode) selectTool('pan');
      setTransformMode(!transformMode);
    },
    onFit: () => {
      const image = editableImage();
      if (!image) return;
      fitBackground(image);
      drawing.layers.notify();
    },
    onRemove: () => {
      const layer = activeImageLayer();
      if (layer) drawing.deleteLayer(layer.id);
    },
  });
  sidebar.backgroundSlot.append(imagePanel.element);

  transform = createBackgroundTransform({
    svg: mapView.svg,
    viewport,
    overlay: mapView.layers.overlay,
    getBackground: editableImage,
    isActive: () => transformMode && editableImage() !== null,
    onChange: () => drawing.layers.notify(),
  });

  attachFileDrop(mapView.element, '📂 Drop image to add it as a layer', loadImage);

  function loadImage(file: File): void {
    loadImageFile(file)
      .then((image) => {
        const layer = drawing.addImageLayer(image);
        sidebar.setStatus(`Image layer added: "${layer.name}"`);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        imagePanel.showError(message);
        sidebar.setStatus(message);
      });
  }

  function updateImagePanel(): void {
    // Leave Transform mode if the active layer is no longer an editable image.
    if (transformMode && !editableImage()) {
      transformMode = false;
      viewport.refreshCursor();
    }
    const imageLayers = drawing.layers.all().filter((l) => l.kind === 'image').length;
    imagePanel.render(activeImageLayer(), transformMode, imageLayers);
    transform?.render();
  }

  function setTransformMode(on: boolean): void {
    transformMode = on;
    viewport.refreshCursor();
    updateImagePanel();
  }

  drawing.layers.onChange(updateImagePanel);
  updateImagePanel();

  // ---------- Map scale (Continent / Kingdom / Town) ----------

  mapView.presetSelect.addEventListener('change', () => {
    const value = mapView.presetSelect.value;
    if (isScalePresetId(value)) {
      mapScale.set(value);
      sidebar.setStatus(`Map size: ${mapScale.preset.name} (${mapScale.worldSizeLabel})`);
    }
  });
  mapScale.onChange(() => mapView.refreshScale());

  // ---------- Files ----------

  const files = createFileController({
    root,
    mapView,
    drawing,
    markers: markerController,
    history,
    viewport,
  });

  // ---------- Undo / redo & shortcuts ----------

  function undo(): void {
    const command = history.undo();
    drawing.refreshSelection();
    markerController.refreshSelection();
    sidebar.setStatus(command ? `Undo: ${command.label}` : 'Nothing to undo');
  }

  function redo(): void {
    const command = history.redo();
    drawing.refreshSelection();
    markerController.refreshSelection();
    sidebar.setStatus(command ? `Redo: ${command.label}` : 'Nothing to redo');
  }

  attachShortcuts({
    onTool: selectTool,
    onUndo: undo,
    onRedo: redo,
    onDelete: () => {
      if (markerController.hasSelection()) markerController.deleteSelection();
      else drawing.deleteSelection();
    },
    onEscape: () => {
      drawing.clearSelection();
      markerController.clearSelection();
    },
    onSave: files.save,
    onSaveAs: files.saveAs,
    onOpen: files.open,
  });

  // ---------- Tools & theme ----------

  function selectTool(id: ToolId): void {
    activeTool = id;
    toolbar.setActive(id);
    mapView.element.dataset.tool = id;
    drawing.onToolChange(id);
    markerController.onToolChange(id);
    if (id !== 'pan' && transformMode) setTransformMode(false);
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
  files.showStartMenu();

  return { toolbar, mapView, sidebar, viewport };
}
