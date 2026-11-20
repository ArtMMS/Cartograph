export type RegionType = 'continent' | 'nation' | 'region' | 'area';

export interface RegionTypeInfo {
  id: RegionType;
  name: string;
  icon: string;
  /** Lower = bigger. A region's parent must have a lower rank. */
  rank: number;
}

export const REGION_TYPES: readonly RegionTypeInfo[] = [
  { id: 'continent', name: 'Continent', icon: '🌍', rank: 0 },
  { id: 'nation', name: 'Nation', icon: '🏰', rank: 1 },
  { id: 'region', name: 'Region', icon: '🗺️', rank: 2 },
  { id: 'area', name: 'Area', icon: '🏞️', rank: 3 },
];

/** Colors given to new regions, in order. */
export const REGION_COLORS: readonly string[] = [
  '#e74c3c',
  '#3498db',
  '#27ae60',
  '#f39c12',
  '#8e44ad',
  '#16a085',
  '#d35400',
  '#2c3e50',
  '#c0392b',
  '#7f8c8d',
];

export interface Region {
  id: string;
  /** Layer this region belongs to (a "regions" layer). */
  layerId: string;
  type: RegionType;
  name: string;
  color: string;
  /** Bigger region this one belongs to (e.g. a nation's continent), or null. */
  parentId: string | null;
  /** Closed outline, in world units. */
  points: [number, number][];
  /** Plain text or Markdown. */
  notes: string;
}

/** Display settings for regions (saved with the map). */
export interface RegionView {
  showLabels: boolean;
  hiddenTypes: RegionType[];
}

export function createDefaultRegionView(): RegionView {
  return { showLabels: true, hiddenTypes: [] };
}

export function getRegionType(id: RegionType): RegionTypeInfo {
  return REGION_TYPES.find((t) => t.id === id) ?? REGION_TYPES[2];
}

export function isRegionType(value: unknown): value is RegionType {
  return REGION_TYPES.some((t) => t.id === value);
}

/** True if `parent` can contain `child` (it must be a bigger type). */
export function canBeParent(parent: RegionType, child: RegionType): boolean {
  return getRegionType(parent).rank < getRegionType(child).rank;
}

export function createRegion(
  layerId: string,
  type: RegionType,
  name: string,
  color: string,
  points: [number, number][],
  parentId: string | null,
): Region {
  return { id: crypto.randomUUID(), layerId, type, name, color, parentId, points, notes: '' };
}
