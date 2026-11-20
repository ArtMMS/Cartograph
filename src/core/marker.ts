export type MarkerType =
  | 'capital'
  | 'city'
  | 'village'
  | 'poi'
  | 'area'
  | 'forest'
  | 'mountain'
  | 'water'
  | 'road';

export interface MarkerTypeInfo {
  id: MarkerType;
  name: string;
  /** Short name for chips. */
  short: string;
  icon: string;
}

export const MARKER_TYPES: readonly MarkerTypeInfo[] = [
  { id: 'capital', name: 'Capital', short: 'Capital', icon: '👑' },
  { id: 'city', name: 'City', short: 'City', icon: '🔴' },
  { id: 'village', name: 'Village', short: 'Village', icon: '🟠' },
  { id: 'poi', name: 'Point of interest', short: 'POI', icon: '🔷' },
  { id: 'area', name: 'Area (desert, plains, swamp…)', short: 'Area', icon: '🏜️' },
  { id: 'forest', name: 'Forest', short: 'Forest', icon: '🌲' },
  { id: 'mountain', name: 'Mountains & hills', short: 'Mountain', icon: '⛰️' },
  { id: 'water', name: 'Water (river, lake, sea)', short: 'Water', icon: '💧' },
  { id: 'road', name: 'Road', short: 'Road', icon: '🛤️' },
];

export interface Marker {
  id: string;
  /** Layer this marker belongs to (a "markers" layer). */
  layerId: string;
  type: MarkerType;
  name: string;
  /** Position in world units. */
  x: number;
  y: number;
  notes: string;
}

/** Display settings for markers (saved with the map). */
export interface MarkerView {
  showLabels: boolean;
  hiddenTypes: MarkerType[];
}

export function createDefaultMarkerView(): MarkerView {
  return { showLabels: true, hiddenTypes: [] };
}

export function getMarkerType(id: MarkerType): MarkerTypeInfo {
  return MARKER_TYPES.find((t) => t.id === id) ?? MARKER_TYPES[1];
}

export function isMarkerType(value: unknown): value is MarkerType {
  return MARKER_TYPES.some((t) => t.id === value);
}

export function createMarker(
  layerId: string,
  type: MarkerType,
  name: string,
  x: number,
  y: number,
): Marker {
  return { id: crypto.randomUUID(), layerId, type, name, x, y, notes: '' };
}
