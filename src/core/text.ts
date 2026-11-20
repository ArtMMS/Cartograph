export type TextFont = 'serif' | 'sans';

/** Free text placed on the map (sea names, titles, notes…). Sizes are in world units. */
export interface MapText {
  id: string;
  /** Layer this text belongs to (a "texts" layer). */
  layerId: string;
  text: string;
  /** Center of the text, in world units. */
  x: number;
  y: number;
  /** Font size in world units (grows with the map when zooming). */
  size: number;
  font: TextFont;
  bold: boolean;
  italic: boolean;
  color: string;
  outlineColor: string;
  /** Outline thickness, in % of the font size (0 = no outline). */
  outline: number;
  /** Rotation in degrees. */
  rotation: number;
  /** Clicking the text in View mode opens this marker's notes. */
  linkedMarkerId: string | null;
}

/** New text, styled like the "Area" region names (italic serif with a light outline). */
export function createText(layerId: string, x: number, y: number, size: number): MapText {
  return {
    id: crypto.randomUUID(),
    layerId,
    text: 'Text',
    x,
    y,
    size,
    font: 'serif',
    bold: false,
    italic: true,
    color: '#3b2a1a',
    outlineColor: '#f6ecd2',
    outline: 18,
    rotation: 0,
    linkedMarkerId: null,
  };
}

export function isMapText(value: unknown): value is MapText {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === 'string' &&
    typeof v.layerId === 'string' &&
    typeof v.text === 'string' &&
    typeof v.x === 'number' &&
    typeof v.y === 'number' &&
    typeof v.size === 'number'
  );
}

/** Fills missing fields of a text read from a file. */
export function normalizeText(t: MapText): MapText {
  const d = createText(t.layerId, t.x, t.y, t.size);
  return {
    ...d,
    ...t,
    font: t.font === 'sans' ? 'sans' : 'serif',
    linkedMarkerId: typeof t.linkedMarkerId === 'string' ? t.linkedMarkerId : null,
  };
}
