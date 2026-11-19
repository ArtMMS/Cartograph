/** Size of the map "world" in SVG units. */
export const WORLD_WIDTH = 2000;
export const WORLD_HEIGHT = 1500;

/**
 * Real-world scale. The world is roughly the size of Europe
 * (~4,000 km east–west × ~3,000 km north–south), so 1 unit = 2 km.
 */
export const KM_PER_UNIT = 2;

/**
 * Hexcrawl hex size, measured flat side to flat side
 * (= distance between the centers of two neighboring hexes).
 * 40 km ≈ 24 miles ≈ one day of travel at normal pace in D&D 5e.
 */
export const HEX_SIZE_KM = 40;

/** Hex size in world units. */
export const HEX_SIZE_UNITS = HEX_SIZE_KM / KM_PER_UNIT;
