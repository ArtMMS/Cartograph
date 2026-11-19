export const BASE_LAYER_ID = 'base';
export const DEFAULT_BASE_COLOR = '#ffffff';

export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  /** Only the Base layer has a color: it fills the map paper. */
  color?: string;
}

/** The Base layer: always exists, always at the bottom, holds the paper color. */
export function createBaseLayer(): Layer {
  return {
    id: BASE_LAYER_ID,
    name: 'Base',
    visible: true,
    locked: false,
    color: DEFAULT_BASE_COLOR,
  };
}

export function createLayer(name: string): Layer {
  return { id: crypto.randomUUID(), name, visible: true, locked: false };
}

/** True when strokes on this layer can be drawn, selected or erased. */
export function isLayerEditable(layer: Layer): boolean {
  return layer.visible && !layer.locked;
}
