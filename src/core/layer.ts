import { createBackground, type BackgroundImage, type LoadedImage } from './background';

export const BASE_LAYER_ID = 'base';
export const DEFAULT_BASE_COLOR = '#ffffff';

/** "draw" layers hold strokes; "image" layers hold one uploaded image. */
export type LayerKind = 'draw' | 'image';

export interface Layer {
  id: string;
  kind: LayerKind;
  name: string;
  visible: boolean;
  locked: boolean;
  /** Only the Base layer has a color: it fills the map paper. */
  color?: string;
  /** Only image layers have an image. */
  image?: BackgroundImage;
}

/** The Base layer: always exists, always at the bottom, holds the paper color. */
export function createBaseLayer(): Layer {
  return {
    id: BASE_LAYER_ID,
    kind: 'draw',
    name: 'Base',
    visible: true,
    locked: false,
    color: DEFAULT_BASE_COLOR,
  };
}

export function createLayer(name: string): Layer {
  return { id: crypto.randomUUID(), kind: 'draw', name, visible: true, locked: false };
}

/** Image layer named after the file (without the extension). */
export function createImageLayer(image: LoadedImage): Layer {
  const name = image.name.replace(/\.[^.]+$/, '') || 'Image';
  return {
    id: crypto.randomUUID(),
    kind: 'image',
    name,
    visible: true,
    locked: false,
    image: createBackground(image),
  };
}

/** True when strokes on this layer can be drawn, selected or erased. */
export function isLayerEditable(layer: Layer): boolean {
  return layer.visible && !layer.locked;
}
