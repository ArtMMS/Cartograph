import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

export const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export interface BackgroundImage {
  /** File name, just for display. */
  name: string;
  /** Image data as a data URL (so it can be saved inside the map file later). */
  src: string;
  /** Original size in pixels. */
  naturalWidth: number;
  naturalHeight: number;
  /** Top-left corner in world units. */
  x: number;
  y: number;
  /** World units per image pixel. */
  scale: number;
  /** 0–1. */
  opacity: number;
}

export interface LoadedImage {
  name: string;
  src: string;
  width: number;
  height: number;
}

/** Reads a PNG/JPG/WEBP file from the PC and returns it as a data URL with its size. */
export function loadImageFile(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      reject(new Error('Unsupported file. Use PNG, JPG or WEBP.'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const src = String(reader.result);
      const img = new Image();
      img.onerror = () => reject(new Error('Could not open the image.'));
      img.onload = () =>
        resolve({ name: file.name, src, width: img.naturalWidth, height: img.naturalHeight });
      img.src = src;
    };
    reader.readAsDataURL(file);
  });
}

/** Scale that makes the image fit entirely inside the world. */
export function getFitScale(naturalWidth: number, naturalHeight: number): number {
  return Math.min(WORLD_WIDTH / naturalWidth, WORLD_HEIGHT / naturalHeight);
}

/** Places the image fitted and centered in the world. */
export function fitBackground(bg: BackgroundImage): void {
  bg.scale = getFitScale(bg.naturalWidth, bg.naturalHeight);
  bg.x = (WORLD_WIDTH - bg.naturalWidth * bg.scale) / 2;
  bg.y = (WORLD_HEIGHT - bg.naturalHeight * bg.scale) / 2;
}

/** Creates a background from a loaded image, fitted and centered, at 50% opacity. */
export function createBackground(image: LoadedImage): BackgroundImage {
  const bg: BackgroundImage = {
    name: image.name,
    src: image.src,
    naturalWidth: image.width,
    naturalHeight: image.height,
    x: 0,
    y: 0,
    scale: 1,
    opacity: 0.5,
  };
  fitBackground(bg);
  return bg;
}

/** Scale as a percentage, where 100% = fitted to the world. */
export function getScalePercent(bg: BackgroundImage): number {
  return (bg.scale / getFitScale(bg.naturalWidth, bg.naturalHeight)) * 100;
}

/** Changes the scale (in %, 100% = fitted) keeping the image center in place. */
export function setScalePercent(bg: BackgroundImage, percent: number): void {
  const centerX = bg.x + (bg.naturalWidth * bg.scale) / 2;
  const centerY = bg.y + (bg.naturalHeight * bg.scale) / 2;

  bg.scale = (getFitScale(bg.naturalWidth, bg.naturalHeight) * percent) / 100;
  bg.x = centerX - (bg.naturalWidth * bg.scale) / 2;
  bg.y = centerY - (bg.naturalHeight * bg.scale) / 2;
}
