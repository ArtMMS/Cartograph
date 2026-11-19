import { isImageFile } from './background';
import { BASE_LAYER_ID, createBaseLayer, type Layer } from './layer';
import { DEFAULT_SCALE_PRESET, isScalePresetId, type ScalePresetId } from './map-scale';
import {
  createDefaultMarkerView,
  isMarkerType,
  type Marker,
  type MarkerView,
} from './marker';
import type { Stroke, StrokePoint } from './stroke';

export const MAP_FILE_VERSION = 1;
export const MAP_FILE_APP = 'cartograph';

/**
 * The .json file format.
 * Images are embedded as base64 data URLs, so one file holds the whole map.
 */
export interface MapFile {
  app: typeof MAP_FILE_APP;
  version: number;
  name: string;
  savedAt: string;
  scale: ScalePresetId;
  activeLayerId: string;
  /** Bottom to top; index 0 is always the Base layer. */
  layers: Layer[];
  /** In drawing order. */
  strokes: Stroke[];
  /** Cities, villages, points of interest. */
  markers: Marker[];
  markerView: MarkerView;
}

export interface MapState {
  name: string;
  scale: ScalePresetId;
  activeLayerId: string;
  layers: readonly Layer[];
  strokes: readonly Stroke[];
  markers: readonly Marker[];
  markerView: MarkerView;
}

/** Turns the current map into a MapFile object. */
export function toMapFile(state: MapState): MapFile {
  return {
    app: MAP_FILE_APP,
    version: MAP_FILE_VERSION,
    name: state.name,
    savedAt: new Date().toISOString(),
    scale: state.scale,
    activeLayerId: state.activeLayerId,
    layers: state.layers.map((l) => ({ ...l, image: l.image ? { ...l.image } : undefined })),
    strokes: state.strokes.map((s) => ({ ...s, points: s.points.map(roundPoint) })),
    markers: state.markers.map((m) => ({ ...m, x: round(m.x), y: round(m.y) })),
    markerView: { ...state.markerView, hiddenTypes: [...state.markerView.hiddenTypes] },
  };
}

export function serializeMapFile(file: MapFile): string {
  return JSON.stringify(file);
}

/** Reads and validates a map file. Throws an Error with a readable message if invalid. */
export function parseMapFile(text: string): MapFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('This file is not valid JSON.');
  }

  if (!isObject(data) || data.app !== MAP_FILE_APP) {
    throw new Error('This is not a Cartograph map file.');
  }
  if (typeof data.version !== 'number' || data.version > MAP_FILE_VERSION) {
    throw new Error('This map was saved by a newer version of Cartograph.');
  }

  const layers = Array.isArray(data.layers) ? data.layers.filter(isLayer) : [];
  if (!layers.some((l) => l.id === BASE_LAYER_ID)) layers.unshift(createBaseLayer());

  const layerIds = new Set(layers.map((l) => l.id));
  const strokes = (Array.isArray(data.strokes) ? data.strokes.filter(isStroke) : []).filter((s) =>
    layerIds.has(s.layerId),
  );

  // Markers are optional (files saved before markers existed don't have them).
  const markers = (Array.isArray(data.markers) ? data.markers.filter(isMarker) : []).filter((m) =>
    layerIds.has(m.layerId),
  );
  const markerView = parseMarkerView(data.markerView);

  return {
    app: MAP_FILE_APP,
    version: MAP_FILE_VERSION,
    markers,
    markerView,
    name: typeof data.name === 'string' ? data.name : 'Untitled map',
    savedAt: typeof data.savedAt === 'string' ? data.savedAt : '',
    scale: isScalePresetId(data.scale) ? data.scale : DEFAULT_SCALE_PRESET,
    activeLayerId: typeof data.activeLayerId === 'string' ? data.activeLayerId : BASE_LAYER_ID,
    layers,
    strokes,
  };
}

// ---------- Validation helpers ----------

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isLayer(value: unknown): value is Layer {
  if (!isObject(value)) return false;
  if (typeof value.id !== 'string' || typeof value.name !== 'string') return false;
  if (value.kind !== 'draw' && value.kind !== 'image' && value.kind !== 'markers') return false;
  if (value.kind === 'image' && !isImageFile(value.image)) return false;
  value.visible = value.visible !== false;
  value.locked = value.locked === true;
  return true;
}

function isStroke(value: unknown): value is Stroke {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.layerId === 'string' &&
    typeof value.color === 'string' &&
    typeof value.size === 'number' &&
    Array.isArray(value.points) &&
    value.points.every((p) => Array.isArray(p) && p.length === 3)
  );
}

function isMarker(value: unknown): value is Marker {
  if (!isObject(value)) return false;
  if (
    typeof value.id !== 'string' ||
    typeof value.layerId !== 'string' ||
    !isMarkerType(value.type) ||
    typeof value.x !== 'number' ||
    typeof value.y !== 'number'
  ) {
    return false;
  }
  value.name = typeof value.name === 'string' ? value.name : '';
  value.notes = typeof value.notes === 'string' ? value.notes : '';
  return true;
}

function parseMarkerView(value: unknown): MarkerView {
  const view = createDefaultMarkerView();
  if (!isObject(value)) return view;
  if (typeof value.showLabels === 'boolean') view.showLabels = value.showLabels;
  if (Array.isArray(value.hiddenTypes)) view.hiddenTypes = value.hiddenTypes.filter(isMarkerType);
  return view;
}

/** 2 decimals is plenty (1 unit ≥ 1.5 m) and keeps files small. */
function roundPoint(p: StrokePoint): StrokePoint {
  return [round(p[0]), round(p[1]), round(p[2])];
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
