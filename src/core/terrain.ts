import type { StrokePoint } from './stroke';

export type TerrainKind = 'continent' | 'island' | 'archipelago' | 'wild';

export interface TerrainKindInfo {
  id: TerrainKind;
  name: string;
  icon: string;
  description: string;
}

export const TERRAIN_KINDS: readonly TerrainKindInfo[] = [
  { id: 'continent', name: 'Continent', icon: '🌍', description: 'Big landmass with peninsulas and bays' },
  { id: 'island', name: 'Large island', icon: '🏝️', description: 'One medium-sized island' },
  { id: 'archipelago', name: 'Archipelago', icon: '🪨', description: 'Many small islands' },
  { id: 'wild', name: 'Wild coast', icon: '🌀', description: 'Irregular shape — good for completing edges' },
];

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Generates closed coastline outlines (one per landmass) inside the box. */
export function generateTerrain(kind: TerrainKind, box: Box, seed = Math.random()): StrokePoint[][] {
  const rand = mulberry(Math.floor(seed * 2 ** 31));
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;

  switch (kind) {
    case 'continent':
      return [landmass(cx, cy, box.width / 2, box.height / 2, { amp: 0.32, harmonics: 14, detail: 4 }, rand)];
    case 'island':
      return [landmass(cx, cy, box.width / 2, box.height / 2, { amp: 0.22, harmonics: 8, detail: 3 }, rand)];
    case 'wild':
      return [landmass(cx, cy, box.width / 2, box.height / 2, { amp: 0.5, harmonics: 18, detail: 4 }, rand)];
    case 'archipelago': {
      const count = 6 + Math.floor(rand() * 9);
      const islands: StrokePoint[][] = [];
      const placed: { x: number; y: number; r: number }[] = [];
      for (let tries = 0; islands.length < count && tries < count * 20; tries++) {
        const r = Math.min(box.width, box.height) * (0.05 + rand() * 0.12);
        const x = box.x + r + rand() * Math.max(1, box.width - 2 * r);
        const y = box.y + r + rand() * Math.max(1, box.height - 2 * r);
        // Keep islands from overlapping.
        if (placed.some((p) => Math.hypot(p.x - x, p.y - y) < (p.r + r) * 1.05)) continue;
        placed.push({ x, y, r });
        const stretch = 0.6 + rand() * 0.8;
        islands.push(landmass(x, y, r * stretch, r / stretch, { amp: 0.28, harmonics: 7, detail: 2 }, rand));
      }
      return islands;
    }
  }
}

interface ShapeOptions {
  /** How bumpy the outline is (0–0.6). */
  amp: number;
  /** Number of sine waves around the shape (more = more peninsulas). */
  harmonics: number;
  /** Fractal subdivisions of the coast (more = more jagged detail). */
  detail: number;
}

/** A blob: wobbly ellipse (sum of sine waves) + fractal coastline detail. */
function landmass(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  options: ShapeOptions,
  rand: () => number,
): StrokePoint[] {
  const waves = Array.from({ length: options.harmonics }, (_, i) => {
    const k = i + 2;
    return { k, amp: (options.amp * (rand() * 2 - 1)) / Math.pow(k, 0.8), phase: rand() * Math.PI * 2 };
  });
  const tilt = rand() * Math.PI;

  const base = 72;
  const raw: [number, number][] = [];
  let maxR = 0;
  const radii: number[] = [];
  for (let i = 0; i < base; i++) {
    const t = (i / base) * Math.PI * 2;
    let r = 1;
    for (const w of waves) r += w.amp * Math.sin(w.k * t + w.phase);
    r = Math.max(0.25, r);
    radii.push(r);
    maxR = Math.max(maxR, r);
  }
  for (let i = 0; i < base; i++) {
    const t = (i / base) * Math.PI * 2;
    const r = radii[i] / maxR; // fits inside the box
    const ex = Math.cos(t) * rx * r;
    const ey = Math.sin(t) * ry * r;
    // Rotate a little inside the box (keeps the overall size).
    const a = (tilt - Math.PI / 2) * 0.15;
    raw.push([cx + ex * Math.cos(a) - ey * Math.sin(a), cy + ex * Math.sin(a) + ey * Math.cos(a)]);
  }

  // Fractal coastline: split each edge and push the middle in/out randomly.
  let points = raw;
  for (let level = 0; level < options.detail; level++) {
    const next: [number, number][] = [];
    for (let i = 0; i < points.length; i++) {
      const [ax, ay] = points[i];
      const [bx, by] = points[(i + 1) % points.length];
      const len = Math.hypot(bx - ax, by - ay);
      const nx = -(by - ay) / (len || 1);
      const ny = (bx - ax) / (len || 1);
      const off = (rand() - 0.5) * len * 0.45;
      next.push([ax, ay], [(ax + bx) / 2 + nx * off, (ay + by) / 2 + ny * off]);
    }
    points = next;
  }

  return points.map(([x, y]) => [Math.round(x * 100) / 100, Math.round(y * 100) / 100, 0.5]);
}

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
