import { pointInPolygon } from './geometry';
import type { StrokePoint } from './stroke';

/**
 * How a stroke is drawn:
 * - "line": a smooth freehand line (perfect-freehand)
 * - symbol styles: map symbols repeated along the path (like hand-drawn atlases)
 * - "area": a filled shape created automatically when a line is closed with the snap
 */
export type StrokeStyle =
  | 'line'
  | 'coast'
  | 'snow'
  | 'mountains'
  | 'hills'
  | 'forest'
  | 'grove'
  | 'swamp'
  | 'desert'
  | 'waves'
  | 'border'
  | 'area';

/** Styles the user can pick (everything except "area", which is automatic). */
export type DrawStyle = Exclude<StrokeStyle, 'area'>;

/**
 * Styles drawn as a plain freehand line. Coast, desert and snow are lines too,
 * but when closed they fill with land, sand or snow.
 */
export const OUTLINE_STYLES: readonly DrawStyle[] = ['line', 'coast', 'desert', 'snow'];

export function isOutlineStyle(style: DrawStyle): style is 'line' | 'coast' | 'desert' | 'snow' {
  return OUTLINE_STYLES.includes(style);
}

export interface StrokeStyleInfo {
  id: DrawStyle;
  name: string;
  icon: string;
}

export const STROKE_STYLES: readonly StrokeStyleInfo[] = [
  { id: 'line', name: 'Line', icon: '〰️' },
  { id: 'coast', name: 'Coast (fills with land)', icon: '🏝️' },
  { id: 'desert', name: 'Desert (fills with sand)', icon: '🏜️' },
  { id: 'snow', name: 'Snow (fills with snow)', icon: '❄️' },
  { id: 'mountains', name: 'Mountains', icon: '⛰️' },
  { id: 'hills', name: 'Hills', icon: '🌄' },
  { id: 'forest', name: 'Forest (pines)', icon: '🌲' },
  { id: 'grove', name: 'Woods (round trees)', icon: '🌳' },
  { id: 'swamp', name: 'Swamp', icon: '🌾' },
  { id: 'waves', name: 'Waves', icon: '🌊' },
  { id: 'border', name: 'Border (dashed)', icon: '┅' },
];

const ALL_STYLES: readonly string[] = [...STROKE_STYLES.map((s) => s.id), 'area'];

export function isStrokeStyle(value: unknown): value is StrokeStyle {
  return typeof value === 'string' && ALL_STYLES.includes(value);
}

export function isDrawStyle(value: unknown): value is DrawStyle {
  return isStrokeStyle(value) && value !== 'area';
}

/** One SVG path of a stroke. `cls` = CSS class (sets colors), `attrs` = extra attributes. */
export interface ShapePart {
  d: string;
  cls: string;
  attrs?: Record<string, string>;
}

type Glyph = (x: number, y: number, s: number, rand: () => number) => ShapePart[];

// ---------- Glyphs (one map symbol each) ----------

/** Mountain with a lit side, a shaded side and a snow cap (like the example map). */
const mountain: Glyph = (x, y, s, rand) => {
  const k = 0.8 + rand() * 0.45;
  const w = s * 5 * k;
  const h = s * 4 * k;
  const px = x + (rand() - 0.5) * w * 0.15; // peak
  const top = y - h;
  const foot = px + w * 0.08;
  return [
    { cls: 'mtn-light', d: `M${f(x - w / 2)},${f(y)} L${f(px)},${f(top)} L${f(foot)},${f(y)} Z` },
    { cls: 'mtn-dark', d: `M${f(px)},${f(top)} L${f(x + w / 2)},${f(y)} L${f(foot)},${f(y)} Z` },
    {
      cls: 'mtn-snow',
      d:
        `M${f(px)},${f(top)} L${f(px - w * 0.15)},${f(top + h * 0.3)} L${f(px - w * 0.05)},${f(top + h * 0.38)} ` +
        `L${f(px + w * 0.03)},${f(top + h * 0.3)} L${f(px + w * 0.14)},${f(top + h * 0.34)} Z`,
    },
    { cls: 'mtn-outline', d: `M${f(x - w / 2)},${f(y)} L${f(px)},${f(top)} L${f(x + w / 2)},${f(y)}` },
  ];
};

const hill: Glyph = (x, y, s, rand) => {
  const k = 0.8 + rand() * 0.4;
  const hw = s * 2 * k;
  const h = s * 2.2 * k;
  return [{ cls: 'hill', d: `M${f(x - hw)},${f(y)} Q${f(x)},${f(y - h * 1.6)} ${f(x + hw)},${f(y)} Z` }];
};

/** Pine tree made of three stacked triangles. */
const pine: Glyph = (x, y, s, rand) => {
  const k = 0.8 + rand() * 0.4;
  const h = s * 2.6 * k;
  const w = s * 1.5 * k;
  const pts: [number, number][] = [
    [0, -1], [0.33, -0.62], [0.2, -0.62], [0.42, -0.3], [0.26, -0.3], [0.5, 0],
    [-0.5, 0], [-0.26, -0.3], [-0.42, -0.3], [-0.2, -0.62], [-0.33, -0.62],
  ];
  const d = 'M' + pts.map(([px, py]) => `${f(x + px * w)},${f(y + py * h)}`).join(' L') + ' Z';
  return [{ cls: 'tree', d }];
};

/** Round tree with a trunk. */
const roundTree: Glyph = (x, y, s, rand) => {
  const k = 0.8 + rand() * 0.4;
  const r = s * 0.7 * k;
  return [
    { cls: 'trunk', d: `M${f(x)},${f(y)} L${f(x)},${f(y - s * 0.9 * k)}` },
    { cls: 'crown', d: circle(x, y - s * 1.2 * k, r) },
  ];
};

/** Tuft of marsh grass. */
const tuft: Glyph = (x, y, s) => [
  {
    cls: 'tuft',
    d:
      `M${f(x)},${f(y)} L${f(x - s * 0.45)},${f(y - s * 0.8)} ` +
      `M${f(x)},${f(y)} L${f(x)},${f(y - s * 1.1)} ` +
      `M${f(x)},${f(y)} L${f(x + s * 0.45)},${f(y - s * 0.8)} ` +
      `M${f(x - s * 0.7)},${f(y)} L${f(x + s * 0.7)},${f(y)}`,
  },
];

const dots: Glyph = (x, y, s, rand) =>
  Array.from({ length: 3 }, () => ({
    cls: 'dot',
    d: circle(x + (rand() - 0.5) * s * 2, y + (rand() - 0.5) * s * 2, s * 0.22),
  }));

const wave: Glyph = (x, y, s) => {
  const w = s * 3;
  const h = s * 0.9;
  return [{ cls: 'wave', d: `M${f(x - w / 2)},${f(y)} q${f(w / 4)},${f(-h)} ${f(w / 2)},0 t${f(w / 2)},0` }];
};

interface SymbolSpec {
  glyph: Glyph;
  /** Distance between symbols along a line (× size). */
  along: number;
  /** Spread to both sides of the line (× size). */
  spread: number;
  /** Grid spacing when filling an area (× size): [x, y]. */
  grid: [number, number];
  /** Symbols that overlap need to be drawn back-to-front, one by one. */
  layered: boolean;
}

type SymbolStyle = Exclude<DrawStyle, 'line' | 'coast' | 'snow' | 'border'>;

const SYMBOLS: Record<SymbolStyle, SymbolSpec> = {
  mountains: { glyph: mountain, along: 3, spread: 0, grid: [5.5, 3.6], layered: true },
  hills: { glyph: hill, along: 3.4, spread: 0, grid: [6, 3.8], layered: false },
  forest: { glyph: pine, along: 1.1, spread: 2.2, grid: [1.9, 1.6], layered: true },
  grove: { glyph: roundTree, along: 1.5, spread: 2, grid: [2.8, 2.4], layered: true },
  swamp: { glyph: tuft, along: 1.6, spread: 2, grid: [3.2, 2.5], layered: false },
  // Desert as an area: sparse sand dots (as a line, desert is drawn as an outline).
  desert: { glyph: dots, along: 1, spread: 4, grid: [5, 4], layered: false },
  waves: { glyph: wave, along: 4, spread: 2.4, grid: [5, 2.6], layered: false },
};

// ---------- Building shapes ----------

/** Parts of a symbol line (mountains, forest…) or dashed border. */
export function buildSymbolParts(
  style: Exclude<DrawStyle, 'line' | 'coast' | 'desert' | 'snow'>,
  points: readonly StrokePoint[],
  size: number,
  seed: string,
): ShapePart[] {
  if (style === 'border') {
    return [
      {
        cls: 'border',
        d: polylinePath(points),
        attrs: {
          'stroke-width': String(size * 0.5),
          'stroke-dasharray': `${size * 2} ${size * 1.4}`,
        },
      },
    ];
  }

  const spec = SYMBOLS[style];
  const rand = seededRandom(seed);
  const positions = samples(points, size * spec.along, rand).map(({ x, y, nx, ny }) => {
    const off = (rand() - 0.5) * size * spec.spread;
    return [x + nx * off, y + ny * off] as [number, number];
  });
  return placeGlyphs(spec, positions, size, rand);
}

/**
 * Parts of a filled area (closed shape): a colored base plus the element's
 * symbols scattered inside (trees in a forest, peaks in mountains…).
 */
export function buildAreaParts(
  element: DrawStyle,
  outline: readonly [number, number][],
  size: number,
  color: string,
  seed: string,
): ShapePart[] {
  const parts: ShapePart[] = [{ cls: `area-fill--${areaKind(element, color)}`, d: smoothClosed(outline) }];

  // Snow: a few small flakes.
  if (element === 'snow') {
    const rand = seededRandom(seed);
    const flakes = scatter(outline, size * 7, size * 5, rand).map(([x, y]) => ({
      cls: 'flake',
      d: snowflake(x, y, size * 0.5),
    }));
    return parts.concat(mergeParts(flakes));
  }
  if (element === 'line' || element === 'border' || element === 'coast') return parts;

  const spec = SYMBOLS[element];
  const rand = seededRandom(seed);
  const [gx, gy] = spec.grid;
  const positions = scatter(outline, size * gx, size * gy, rand);
  return parts.concat(placeGlyphs(spec, positions, size, rand));
}

/** What a closed area is filled with. */
export function areaKind(
  element: DrawStyle,
  color: string,
): 'land' | 'sand' | 'snow' | 'water' | 'tint' {
  if (element === 'coast') return 'land';
  if (element === 'desert') return 'sand';
  if (element === 'snow') return 'snow';
  if (element === 'waves') return 'water';
  if (element === 'line') return isBluish(color) ? 'water' : 'tint';
  return 'tint';
}

function mergeParts(parts: ShapePart[]): ShapePart[] {
  if (parts.length === 0) return [];
  return [{ cls: parts[0].cls, d: parts.map((p) => p.d).join(' ') }];
}

/** Six-armed flake. */
function snowflake(x: number, y: number, r: number): string {
  let d = '';
  for (let i = 0; i < 3; i++) {
    const a = (i * Math.PI) / 3;
    d += `M${f(x - Math.cos(a) * r)},${f(y - Math.sin(a) * r)} L${f(x + Math.cos(a) * r)},${f(y + Math.sin(a) * r)} `;
  }
  return d;
}

function placeGlyphs(
  spec: SymbolSpec,
  positions: [number, number][],
  size: number,
  rand: () => number,
): ShapePart[] {
  // Back-to-front: symbols further "up" the map are drawn first.
  const sorted = [...positions].sort((a, b) => a[1] - b[1]);
  const glyphs = sorted.map(([x, y]) => spec.glyph(x, y, size, rand));

  if (spec.layered && spec.glyph === mountain) return glyphs.flat();

  // Same-colored symbols: merge into one path per class (much lighter for the browser).
  // Trees get a darker copy underneath, shifted a little, as a shadow.
  const merged = new Map<string, string[]>();
  for (const parts of glyphs) {
    for (const part of parts) {
      if (!merged.has(part.cls)) merged.set(part.cls, []);
      merged.get(part.cls)!.push(part.d);
    }
  }
  const result: ShapePart[] = [];
  for (const [cls, ds] of merged) {
    const d = ds.join(' ');
    if (cls === 'tree' || cls === 'crown') {
      result.push({ cls: `${cls}-shadow`, d, attrs: { transform: `translate(${f(size * 0.18)} ${f(size * 0.12)})` } });
    }
    result.push({ cls, d });
  }
  // Trunks go under the crowns.
  return result.sort((a, b) => order(a.cls) - order(b.cls));
}

function order(cls: string): number {
  return cls === 'trunk' ? 0 : cls.endsWith('-shadow') ? 1 : 2;
}

// ---------- Helpers ----------

interface Sample {
  x: number;
  y: number;
  /** Unit vector perpendicular to the path at this point. */
  nx: number;
  ny: number;
}

/** Points evenly spaced along the path (every `spacing` units). */
function samples(points: readonly StrokePoint[], spacing: number, rand: () => number): Sample[] {
  if (points.length === 0 || spacing <= 0) return [];
  if (points.length === 1) return [{ x: points[0][0], y: points[0][1], nx: 0, ny: -1 }];

  const result: Sample[] = [];
  let next = spacing * (0.3 + rand() * 0.4);

  for (let i = 1; i < points.length; i++) {
    const [ax, ay] = points[i - 1];
    const [bx, by] = points[i];
    const len = Math.hypot(bx - ax, by - ay);
    if (len === 0) continue;
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;

    let t = next;
    while (t <= len) {
      result.push({ x: ax + ((bx - ax) * t) / len, y: ay + ((by - ay) * t) / len, nx, ny });
      t += spacing * (0.85 + rand() * 0.3);
    }
    next = t - len;
  }

  if (result.length === 0) {
    const [x, y] = points[Math.floor(points.length / 2)];
    result.push({ x, y, nx: 0, ny: -1 });
  }
  return result;
}

/** Jittered grid of points inside a polygon. */
function scatter(
  polygon: readonly [number, number][],
  stepX: number,
  stepY: number,
  rand: () => number,
): [number, number][] {
  if (polygon.length < 3 || stepX <= 0 || stepY <= 0) return [];
  const xs = polygon.map((p) => p[0]);
  const ys = polygon.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Safety: never more than ~3000 symbols in one area.
  const cells = ((maxX - minX) / stepX) * ((maxY - minY) / stepY);
  const factor = cells > 3000 ? Math.sqrt(cells / 3000) : 1;
  const sx = stepX * factor;
  const sy = stepY * factor;

  const result: [number, number][] = [];
  let row = 0;
  for (let y = minY + sy * 0.5; y <= maxY; y += sy, row++) {
    const shift = row % 2 === 0 ? 0 : sx / 2;
    for (let x = minX + shift; x <= maxX; x += sx) {
      const px = x + (rand() - 0.5) * sx * 0.7;
      const py = y + (rand() - 0.5) * sy * 0.7;
      if (pointInPolygon(px, py, polygon)) result.push([px, py]);
    }
  }
  return result;
}

/** Smooth open path through the points (for dashed borders). */
function polylinePath(points: readonly StrokePoint[]): string {
  if (points.length === 0) return '';
  if (points.length < 3) return `M${points.map((p) => `${f(p[0])},${f(p[1])}`).join(' L')}`;

  let d = `M${f(points[0][0])},${f(points[0][1])}`;
  for (let i = 1; i < points.length - 1; i++) {
    const [x, y] = points[i];
    const [nx, ny] = points[i + 1];
    d += ` Q${f(x)},${f(y)} ${f((x + nx) / 2)},${f((y + ny) / 2)}`;
  }
  const last = points[points.length - 1];
  return d + ` L${f(last[0])},${f(last[1])}`;
}

/** Smooth closed path (quadratic curves between midpoints). */
function smoothClosed(points: readonly [number, number][]): string {
  const n = points.length;
  if (n < 3) return '';
  const mid = (a: [number, number], b: [number, number]): string =>
    `${f((a[0] + b[0]) / 2)},${f((a[1] + b[1]) / 2)}`;
  let d = `M${mid(points[n - 1], points[0])}`;
  for (let i = 0; i < n; i++) {
    d += ` Q${f(points[i][0])},${f(points[i][1])} ${mid(points[i], points[(i + 1) % n])}`;
  }
  return d + ' Z';
}

function circle(cx: number, cy: number, r: number): string {
  return `M${f(cx - r)},${f(cy)} a${f(r)},${f(r)} 0 1,0 ${f(2 * r)},0 a${f(r)},${f(r)} 0 1,0 ${f(-2 * r)},0`;
}

function isBluish(hex: string): boolean {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return false;
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return b > r + 30 && b >= g;
}

function f(n: number): string {
  return n.toFixed(2);
}

/** Small deterministic random generator (mulberry32) seeded from a string. */
function seededRandom(seed: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
