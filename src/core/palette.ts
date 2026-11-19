export interface PalettePreset {
  id: string;
  name: string;
  color: string;
  /** Thickness in world units. */
  size: number;
}

/** Simple map elements, matching the hand-drawn sketch style. */
export const PALETTE: readonly PalettePreset[] = [
  { id: 'coast', name: 'Coast', color: '#222222', size: 5 },
  { id: 'mountain', name: 'Mountain', color: '#8a6a4f', size: 6 },
  { id: 'forest', name: 'Forest', color: '#2e9e57', size: 5 },
  { id: 'river', name: 'River', color: '#2b8fd6', size: 3 },
  { id: 'lake', name: 'Lake', color: '#7cc3ee', size: 4 },
  { id: 'desert', name: 'Desert', color: '#e8c98a', size: 8 },
  { id: 'border', name: 'Border', color: '#c0392b', size: 3 },
];
