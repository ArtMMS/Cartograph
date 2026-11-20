import { readAutosave, readAutosaveInfo, writeAutosave } from '../core/autosave';
import { buildExportSvg, svgToPng } from '../core/export';
import {
  hasFileSystemAccess,
  isCancel,
  openFile,
  saveBlobAs,
  saveFileAs,
  writeFile,
} from '../core/file-io';
import { createSaveDialog } from './save-dialog';
import type { History } from '../core/history';
import { BASE_LAYER_ID, createBaseLayer } from '../core/layer';
import {
  parseMapFile,
  serializeMapFile,
  toMapFile,
  type MapFile,
} from '../core/map-file';
import { mapScale, type ScalePresetId } from '../core/map-scale';
import type { Viewport } from '../core/viewport';
import { createDefaultMarkerView } from '../core/marker';
import type { Drawing } from './drawing';
import type { Markers } from './markers';
import { createDefaultRegionView } from '../core/region';
import type { Regions } from './regions';
import { createFileBar } from './file-bar';
import type { MapView } from './map-view';
import { createStartMenu } from './start-menu';
import { createToaster } from './toast';

/** Wait this long after the last change before writing the backup. */
const AUTOSAVE_DELAY_MS = 1500;
const DEFAULT_NAME = 'Untitled map';

export interface FileControllerOptions {
  root: HTMLElement;
  mapView: MapView;
  drawing: Drawing;
  markers: Markers;
  regions: Regions;
  history: History;
  viewport: Viewport;
  /** Whether the compass is on (default for "include compass" when exporting). */
  isCompassVisible: () => boolean;
}

export interface FileController {
  save(): void;
  saveAs(): void;
  open(): void;
  /** Shows the start menu (call once when the app opens). */
  showStartMenu(): void;
}

/**
 * Everything about files: start menu, new/open/save/save as,
 * unsaved-changes tracking, autosave backup and the close-tab warning.
 */
export function createFileController(options: FileControllerOptions): FileController {
  const { root, mapView, drawing, markers, regions, history, viewport } = options;

  let name = DEFAULT_NAME;
  let handle: FileSystemFileHandle | undefined;
  let savedRevision = currentRevision();
  let autosavedRevision = savedRevision;
  let autosaveTimer: number | undefined;
  let busy = false;

  const toast = createToaster(mapView.element);

  const fileBar = createFileBar({
    onNew: () => {
      if (!confirmDiscard()) return;
      startMenu.open({ step: 'new', autosave: null, closable: true });
    },
    onOpen: () => void open(),
    onSave: () => void save(),
    onSaveAs: () => void saveAs(),
  });
  mapView.element.append(fileBar.element);

  const saveDialog = createSaveDialog(root);

  const startMenu = createStartMenu(root, {
    onCreate: (preset) => {
      newMap(preset);
      startMenu.close();
    },
    onOpen: () => void open({ fromMenu: true }),
    onRestore: () => {
      const file = readAutosave();
      if (!file) {
        toast('The backup could not be read.', 'error');
        return;
      }
      applyMapFile(file);
      // A restored backup was never saved to a file: keep it marked as unsaved.
      handle = undefined;
      savedRevision = -1;
      render();
      startMenu.close();
      toast(`Restored "${file.name}" from the backup`, 'success');
    },
  });

  // ---------- State ----------

  function currentRevision(): number {
    return (
      drawing.strokes.revision +
      drawing.layers.revision +
      markers.store.revision +
      regions.store.revision +
      mapScale.revision
    );
  }

  function isDirty(): boolean {
    return currentRevision() !== savedRevision;
  }

  function markSaved(): void {
    savedRevision = currentRevision();
    autosavedRevision = savedRevision;
    render();
  }

  function render(): void {
    const dirty = isDirty();
    fileBar.render(name, dirty);
    document.title = `${dirty ? '● ' : ''}${name} — Cartograph`;
  }

  function buildFile(): MapFile {
    return toMapFile({
      name,
      scale: mapScale.preset.id,
      activeLayerId: drawing.layers.getActive().id,
      layers: drawing.layers.all(),
      strokes: drawing.strokes.all(),
      markers: markers.store.all(),
      markerView: markers.store.getView(),
      regions: regions.store.all(),
      regionView: regions.store.getView(),
    });
  }

  function applyMapFile(file: MapFile): void {
    mapScale.set(file.scale);
    drawing.loadState(file.layers, file.strokes, file.activeLayerId);
    markers.store.replaceAll(file.markers, file.markerView);
    markers.clearSelection();
    regions.store.replaceAll(file.regions, file.regionView);
    regions.clearSelection();
    history.clear();
    name = file.name || DEFAULT_NAME;
    markSaved();
    viewport.fit();
  }

  function confirmDiscard(): boolean {
    return !isDirty() || window.confirm('You have unsaved changes. Discard them?');
  }

  function fileBaseName(fileName: string): string {
    return fileName.replace(/\.json$/i, '') || DEFAULT_NAME;
  }

  function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  // ---------- Actions ----------

  function newMap(preset: ScalePresetId): void {
    mapScale.set(preset);
    drawing.loadState([createBaseLayer()], [], BASE_LAYER_ID);
    markers.store.replaceAll([], createDefaultMarkerView());
    markers.clearSelection();
    regions.store.replaceAll([], createDefaultRegionView());
    regions.clearSelection();
    history.clear();
    name = DEFAULT_NAME;
    handle = undefined;
    markSaved();
    viewport.fit();
    toast(`New ${mapScale.preset.name.toLowerCase()} map`, 'info');
  }

  async function open(opts: { fromMenu?: boolean } = {}): Promise<void> {
    if (busy || (!opts.fromMenu && !confirmDiscard())) return;
    busy = true;
    try {
      const opened = await openFile();
      const file = parseMapFile(opened.text);
      file.name = fileBaseName(opened.name);
      applyMapFile(file);
      handle = opened.handle;
      render();
      startMenu.close();
      toast(`Opened ${opened.name}`, 'success');
    } catch (err) {
      if (!isCancel(err)) toast(`Could not open: ${errorMessage(err)}`, 'error');
    } finally {
      busy = false;
    }
  }

  /** Save / Ctrl+S: always the .json map file (overwrites the open file). */
  async function save(): Promise<void> {
    if (!handle) return saveJsonAs();
    if (busy) return;
    busy = true;
    try {
      await writeFile(handle, serializeMapFile(buildFile()));
      markSaved();
      toast(`✓ Saved ${handle.name}`, 'success');
    } catch (err) {
      if (!isCancel(err)) toast(`Could not save: ${errorMessage(err)}`, 'error');
    } finally {
      busy = false;
    }
  }

  /** Save as: asks for the format — map file (.json) or image (.png / .svg). */
  async function saveAs(): Promise<void> {
    if (busy) return;
    const choice = await saveDialog.open({ compass: options.isCompassVisible() });
    if (!choice) return;
    if (choice.format === 'json') return saveJsonAs();
    return exportImage(choice.format, { labels: choice.labels, compass: choice.compass });
  }

  async function exportImage(
    format: 'png' | 'svg',
    exportOptions: { labels: boolean; compass: boolean },
  ): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const svgText = buildExportSvg(mapView.svg, exportOptions);
      const blob =
        format === 'png'
          ? await svgToPng(svgText)
          : new Blob([svgText], { type: 'image/svg+xml' });
      const saved = await saveBlobAs(
        blob,
        `${name}.${format}`,
        format === 'png' ? 'PNG image' : 'SVG image',
        format === 'png' ? 'image/png' : 'image/svg+xml',
        `.${format}`,
      );
      toast(`✓ Exported ${saved}`, 'success');
    } catch (err) {
      if (!isCancel(err)) toast(`Could not export: ${errorMessage(err)}`, 'error');
    } finally {
      busy = false;
    }
  }

  async function saveJsonAs(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      const newHandle = await saveFileAs(serializeMapFile(buildFile()), `${name}.json`);
      if (newHandle) {
        handle = newHandle;
        name = fileBaseName(newHandle.name);
      }
      markSaved();
      toast(
        newHandle ? `✓ Saved ${newHandle.name}` : `✓ Downloaded ${name}.json`,
        'success',
      );
    } catch (err) {
      if (!isCancel(err)) toast(`Could not save: ${errorMessage(err)}`, 'error');
    } finally {
      busy = false;
    }
  }

  // ---------- Autosave (backup in the browser) ----------

  function scheduleAutosave(): void {
    render();
    window.clearTimeout(autosaveTimer);
    autosaveTimer = window.setTimeout(() => {
      const revision = currentRevision();
      // Only back up unsaved work that changed since the last backup.
      if (revision === autosavedRevision || !isDirty()) return;
      const info = writeAutosave(buildFile());
      autosavedRevision = revision;
      if (info && !info.hasImages) warnImagesNotBackedUp();
    }, AUTOSAVE_DELAY_MS);
  }

  let warnedAboutImages = false;
  function warnImagesNotBackedUp(): void {
    if (warnedAboutImages) return;
    warnedAboutImages = true;
    toast('Images are too big for the browser backup — save to a file to keep them.', 'info');
  }

  drawing.strokes.onChange(scheduleAutosave);
  drawing.layers.onChange(scheduleAutosave);
  markers.store.onChange(scheduleAutosave);
  regions.store.onChange(scheduleAutosave);
  mapScale.onChange(scheduleAutosave);

  // ---------- Close-tab warning ----------

  window.addEventListener('beforeunload', (e) => {
    if (!isDirty()) return;
    e.preventDefault();
    e.returnValue = ''; // required by some browsers
  });

  // ---------- Start ----------

  function showStartMenu(): void {
    startMenu.open({ step: 'home', autosave: readAutosaveInfo(), closable: false });
  }

  if (!hasFileSystemAccess()) {
    toast('This browser can only download files — use Chrome or Edge to save directly.', 'info');
  }
  render();

  return {
    save: () => void save(),
    saveAs: () => void saveAs(),
    open: () => void open(),
    showStartMenu,
  };
}
