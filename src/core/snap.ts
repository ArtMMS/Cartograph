const STORAGE_KEY = 'cartograph.snap';

export interface SnapSettings {
  enabled: boolean;
  /** How close (in screen pixels) the pen must be to an end to snap to it. */
  distancePx: number;
}

export const MIN_SNAP_PX = 4;
export const MAX_SNAP_PX = 40;

/** Snap settings are a personal preference (saved in the browser, not in the map). */
export function loadSnapSettings(): SnapSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as SnapSettings | null;
    if (saved && typeof saved.enabled === 'boolean' && typeof saved.distancePx === 'number') {
      return saved;
    }
  } catch {
    // Use defaults.
  }
  return { enabled: true, distancePx: 12 };
}

export function saveSnapSettings(settings: SnapSettings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Not critical.
  }
}
