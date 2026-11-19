import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

export type ScalePresetId = 'continent' | 'kingdom' | 'town';

export interface ScalePreset {
  id: ScalePresetId;
  name: string;
  icon: string;
  /** Kilometers per world unit. */
  kmPerUnit: number;
  /** Hex size (flat side to flat side), in km. */
  hexSizeKm: number;
  description: string;
}

/**
 * Map size presets. The world is always 2000 × 1500 units;
 * the preset decides how many km that represents.
 */
export const SCALE_PRESETS: readonly ScalePreset[] = [
  {
    id: 'continent',
    name: 'Continent',
    icon: '🌍',
    kmPerUnit: 2,
    hexSizeKm: 40, // ≈ 1 day of travel on foot
    description: 'Europe-sized world · 1 hex ≈ 1 day of travel',
  },
  {
    id: 'kingdom',
    name: 'Kingdom',
    icon: '🏰',
    kmPerUnit: 0.3,
    hexSizeKm: 10, // ≈ 6 miles, the classic regional hex
    description: 'One nation or region · classic 6-mile hex',
  },
  {
    id: 'town',
    name: 'Town',
    icon: '🏘️',
    kmPerUnit: 0.0015,
    hexSizeKm: 0.1,
    description: 'A city or village with its surroundings',
  },
];

export const DEFAULT_SCALE_PRESET: ScalePresetId = 'continent';

export function getPreset(id: ScalePresetId): ScalePreset {
  return SCALE_PRESETS.find((p) => p.id === id) ?? SCALE_PRESETS[0];
}

export function isScalePresetId(value: unknown): value is ScalePresetId {
  return SCALE_PRESETS.some((p) => p.id === value);
}

/** "40 km", "10 km", "100 m", "1.5 km"… */
export function formatDistance(km: number): string {
  if (km >= 1) return `${Number(km.toFixed(1)).toLocaleString('en-US')} km`;
  return `${Math.round(km * 1000).toLocaleString('en-US')} m`;
}

/** Current map scale (part of the map file). */
class MapScale {
  private presetId: ScalePresetId = DEFAULT_SCALE_PRESET;
  private readonly listeners = new Set<() => void>();
  /** Increases on every change (used to detect unsaved changes). */
  revision = 0;

  get preset(): ScalePreset {
    return getPreset(this.presetId);
  }

  get kmPerUnit(): number {
    return this.preset.kmPerUnit;
  }

  /** Hex size in world units. */
  get hexSizeUnits(): number {
    return this.preset.hexSizeKm / this.preset.kmPerUnit;
  }

  /** World size in km, e.g. "4,000 × 3,000 km". */
  get worldSizeLabel(): string {
    const w = formatDistance(WORLD_WIDTH * this.kmPerUnit);
    const h = formatDistance(WORLD_HEIGHT * this.kmPerUnit);
    return `${w.replace(/ (k?m)$/, '')} × ${h}`;
  }

  set(id: ScalePresetId): void {
    if (id === this.presetId) return;
    this.presetId = id;
    this.revision++;
    for (const listener of this.listeners) listener();
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }
}

export const mapScale = new MapScale();
