import type { DrawStyle } from './stroke-style';

export interface PalettePreset {
  id: string;
  name: string;
  color: string;
  /** Thickness (or symbol size) in world units. */
  size: number;
  /** Line or map symbols drawn along the stroke. */
  style: DrawStyle;
}

/** Simple map elements, in the style of hand-drawn atlases. */
export const PALETTE: readonly PalettePreset[] = [
  { id: 'coast', name: 'Coast', color: '#5b3a1e', size: 4, style: 'line' },
  { id: 'mountain', name: 'Mountains', color: '#8b5a2b', size: 6, style: 'mountains' },
  { id: 'hills', name: 'Hills', color: '#e8b866', size: 5, style: 'hills' },
  { id: 'forest', name: 'Forest', color: '#1f6b3a', size: 5, style: 'forest' },
  { id: 'grove', name: 'Woods', color: '#7cc864', size: 5, style: 'grove' },
  { id: 'swamp', name: 'Swamp', color: '#2a8c8c', size: 5, style: 'swamp' },
  { id: 'river', name: 'River', color: '#3b8fd6', size: 3, style: 'line' },
  { id: 'lake', name: 'Lake', color: '#3b8fd6', size: 3, style: 'line' },
  { id: 'sea', name: 'Waves', color: '#5d9fd0', size: 5, style: 'waves' },
  { id: 'desert', name: 'Desert', color: '#c9a35b', size: 6, style: 'desert' },
  { id: 'border', name: 'Border', color: '#c0392b', size: 3, style: 'border' },
];
