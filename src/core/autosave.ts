import type { MapFile } from './map-file';
import { parseMapFile, serializeMapFile } from './map-file';

const STORAGE_KEY = 'cartograph.autosave';
const INFO_KEY = 'cartograph.autosave.info';

export interface AutosaveInfo {
  name: string;
  savedAt: string;
  /** False when the images didn't fit in the browser storage and were left out. */
  hasImages: boolean;
}

/**
 * Saves a backup copy in the browser (localStorage).
 * localStorage is limited (~5 MB), so if the map doesn't fit,
 * it tries again without the images.
 */
export function writeAutosave(file: MapFile): AutosaveInfo | null {
  const attempts: [MapFile, boolean][] = [
    [file, true],
    // Probably too big — try without images.
    [{ ...file, layers: file.layers.filter((l) => l.kind !== 'image') }, false],
  ];

  for (const [data, hasImages] of attempts) {
    try {
      localStorage.setItem(STORAGE_KEY, serializeMapFile(data));
      const info: AutosaveInfo = { name: file.name, savedAt: file.savedAt, hasImages };
      localStorage.setItem(INFO_KEY, JSON.stringify(info));
      return info;
    } catch {
      // Try the next option.
    }
  }
  return null;
}

/** Name/date of the last backup (cheap: doesn't read the whole map). */
export function readAutosaveInfo(): AutosaveInfo | null {
  try {
    const text = localStorage.getItem(INFO_KEY);
    if (!text || !localStorage.getItem(STORAGE_KEY)) return null;
    const info = JSON.parse(text) as AutosaveInfo;
    return typeof info.name === 'string' ? info : null;
  } catch {
    return null;
  }
}

/** The last backup, if there is one and it's valid. */
export function readAutosave(): MapFile | null {
  try {
    const text = localStorage.getItem(STORAGE_KEY);
    return text ? parseMapFile(text) : null;
  } catch {
    return null;
  }
}
