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
import { createRegions, type Regions } from './regions';
import { createTravelPanel } from './travel-panel';
import { attachMeasure, type Measure } from '../tools/measure';
import { attachFileDrop } from './drop-zone';
import { createMapView, type MapView } from './map-view';
import { createSidebar, type Sidebar } from './sidebar';
import { createToolbar, type Toolbar } from './toolbar';
import { createCompassOverlay, type CompassOverlay } from './compass';
import { createInfoBox } from './info-box';
import { createSearchBox } from './search';
import { createTexts } from './texts';
import { createTerrainTool } from './terrain';
import { createViewPanel } from './view-panel';
import { getMarkerType } from '../core/marker';
import { getRegionType } from '../core/region';

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
  let regions: Regions | null = null;
  let measure: Measure | null = null;
  const history = new History();

  const sidebar = createSidebar();
  const mapView = createMapView();
  let viewMode = false;
  let compass: CompassOverlay | null = null;
  const toolbar = createToolbar({
    onSelectTool: selectTool,
    onToggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    onToggleCompass: () => {
      if (!compass) return;
      compass.setVisible(!compass.isVisible());
      toolbar.setCompass(compass.isVisible());
    },
    onToggleViewMode: () => setViewMode(!viewMode),
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
      compass?.setZoom(scale);
      mapView.setZoomLabel(scale);
      mapView.hexGrid.setScale(scale);
      transform?.render();
      markers?.setZoom(scale);
      regions?.setZoom(scale);
      measure?.setZoom(scale);
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

  // ---------- Regions & nations ----------

  const regionController = createRegions({
    mapView,
    viewport,
    sidebar,
    history,
    drawing,
    getActiveTool: () => activeTool,
  });
  regions = regionController;

  // ---------- Distance & travel time ----------

  const travelPanel = createTravelPanel(() => measure?.clear());
  sidebar.travelSlot.append(travelPanel.element);
  let lastMeasure = { length: 0, finished: false, points: 0 };
  const renderTravel = (): void =>
    travelPanel.render(
      lastMeasure.length * mapScale.kmPerUnit,
      lastMeasure.finished,
      lastMeasure.points,
    );

  measure = attachMeasure({
    svg: mapView.svg,
    viewport,
    overlay: mapView.layers.overlay,
    isActive: () => activeTool === 'measure',
    onChange: (length, finished, points) => {
      lastMeasure = { length, finished, points };
      renderTravel();
    },
  });
  mapScale.onChange(renderTravel);

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

  // ---------- Free texts & terrain generator ----------

  const textController = createTexts({
    mapView,
    viewport,
    sidebar,
    history,
    drawing,
    markers: markerController.store,
    getActiveTool: () => activeTool,
  });

  const terrainTool = createTerrainTool({
    mapView,
    viewport,
    sidebar,
    drawing,
    getActiveTool: () => activeTool,
  });

  // ---------- Compass rose & scale ----------

  compass = createCompassOverlay(mapView.element);
  compass.setZoom(viewport.getScale());
  toolbar.setCompass(compass.isVisible());

  // ---------- View mode (read-only: browse and read notes) ----------

  const infoBox = createInfoBox(mapView.element, () => clearViewed());
  const viewPanel = createViewPanel(mapView.element, mapView.svg, () => {
    // Hiding regions closes an open region box.
    if (!viewPanel?.regionsVisible()) regionController.highlight(null);
  });

  function clearViewed(): void {
    regionController.highlight(null);
    markerController.highlight(null);
  }

  function showMarkerInfo(id: string): void {
    const marker = markerController.store.get(id);
    if (!marker) return;
    clearViewed();
    markerController.highlight(marker.id);
    const type = getMarkerType(marker.type);
    infoBox.show({
      icon: type.icon,
      title: marker.name,
      subtitle: type.name,
      path: regionController.pathAt(marker.x, marker.y),
      notes: marker.notes,
    });
  }

  function showRegionInfo(id: string): void {
    const region = regionController.store.get(id);
    if (!region) return;
    clearViewed();
    regionController.highlight(region.id);
    const type = getRegionType(region.type);
    infoBox.show({
      icon: type.icon,
      title: region.name,
      subtitle: type.name,
      path: regionController.pathOf(region.id),
      notes: region.notes,
    });
  }

  // A click (not a drag) in View mode opens the notes of what's under the mouse.
  // The element under the mouse is read on pointerdown: while panning the map
  // captures the pointer, so pointerup always reports the <svg> itself.
  let viewClick: { x: number; y: number; target: EventTarget | null } | null = null;
  mapView.svg.addEventListener(
    'pointerdown',
    (e) => {
      viewClick = viewMode && e.button === 0 ? { x: e.clientX, y: e.clientY, target: e.target } : null;
    },
    { capture: true },
  );
  mapView.svg.addEventListener('pointerup', (e) => {
    if (!viewMode || !viewClick) return;
    const moved = Math.hypot(e.clientX - viewClick.x, e.clientY - viewClick.y);
    const down = { target: viewClick.target } as unknown as Event;
    viewClick = null;
    if (moved > 4) return;

    const marker = markerController.markerFromEvent(down);
    if (marker) {
      showMarkerInfo(marker.id);
      return;
    }
    // Texts linked to a marker open that marker's notes.
    const text = textController.textFromEvent(down);
    if (text?.linkedMarkerId && markerController.store.get(text.linkedMarkerId)) {
      showMarkerInfo(text.linkedMarkerId);
      return;
    }
    const p = viewport.screenToWorld(e.clientX, e.clientY);
    const region = viewPanel.regionsVisible() ? regionController.findVisibleAt(p.x, p.y) : null;
    if (region) {
      showRegionInfo(region.id);
    } else {
      infoBox.hide();
      clearViewed();
    }
  });

  function setViewMode(on: boolean): void {
    viewMode = on;
    root.classList.toggle('is-view-mode', on);
    toolbar.setViewMode(on);
    drawing.clearSelection();
    markerController.clearSelection();
    regionController.clearSelection();
    textController.clearSelection();
    measure?.clear();
    infoBox.hide();
    clearViewed();
    viewPanel.setActive(on);
    selectTool('pan');
    sidebar.setStatus(on ? 'View mode' : 'Edit mode');
  }

  // ---------- Search ----------

  const search = createSearchBox(
    () => ({ markers: markerController.store.all(), regions: regionController.store.all() }),
    (result) => {
      if (result.kind === 'marker') {
        markerController.focus(result.item.id, !viewMode);
        if (viewMode) showMarkerInfo(result.item.id);
      } else {
        regionController.focus(result.item.id, !viewMode);
        if (viewMode) showRegionInfo(result.item.id);
      }
      if (!viewMode && activeTool !== 'select') selectTool('select');
    },
  );
  mapView.element.append(search.element);

  const files = createFileController({
    root,
    mapView,
    drawing,
    markers: markerController,
    regions: regionController,
    texts: textController,
    history,
    viewport,
    isCompassVisible: () => compass?.isVisible() ?? false,
    isHexVisible: () => mapView.hexGrid.isVisible(),
  });

  // ---------- Undo / redo & shortcuts ----------

  function undo(): void {
    const command = history.undo();
    drawing.refreshSelection();
    markerController.refreshSelection();
    regionController.refreshSelection();
    textController.refreshSelection();
    sidebar.setStatus(command ? `Undo: ${command.label}` : 'Nothing to undo');
  }

  function redo(): void {
    const command = history.redo();
    drawing.refreshSelection();
    markerController.refreshSelection();
    regionController.refreshSelection();
    textController.refreshSelection();
    sidebar.setStatus(command ? `Redo: ${command.label}` : 'Nothing to redo');
  }

  attachShortcuts({
    onTool: selectTool,
    onUndo: undo,
    onRedo: redo,
    onDelete: () => {
      if (markerController.hasSelection()) markerController.deleteSelection();
      else if (textController.hasSelection()) textController.deleteSelection();
      else if (regionController.hasSelection()) regionController.deleteSelection();
      else drawing.deleteSelection();
    },
    onEscape: () => {
      infoBox.hide();
      clearViewed();
      drawing.clearSelection();
      markerController.clearSelection();
      regionController.clearSelection();
      textController.clearSelection();
      if (activeTool === 'measure') measure?.clear();
    },
    onSave: files.save,
    onSaveAs: files.saveAs,
    onOpen: files.open,
    onDuplicate: () => {
      if (markerController.hasSelection()) markerController.duplicateSelection();
      else if (textController.hasSelection()) textController.duplicateSelection();
      else if (regionController.hasSelection()) regionController.duplicateSelection();
      else drawing.duplicateSelection();
    },
    onSearch: () => search.focus(),
    canEdit: () => !viewMode,
  });

  // ---------- Tools & theme ----------

  function selectTool(id: ToolId): void {
    activeTool = id;
    toolbar.setActive(id);
    mapView.element.dataset.tool = id;
    drawing.onToolChange(id);
    markerController.onToolChange(id);
    regionController.onToolChange(id);
    textController.onToolChange(id);
    terrainTool.onToolChange(id);
    sidebar.setTravelVisible(id === 'measure');
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
