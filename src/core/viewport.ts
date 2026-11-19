import { WORLD_HEIGHT, WORLD_WIDTH } from './world';

const MIN_SCALE = 0.05;
const MAX_SCALE = 20;
/** How fast the mouse wheel zooms. Higher = faster. */
const ZOOM_SPEED = 0.0015;
/** How much of the screen the world fills when centered (0–1). */
const FIT_MARGIN = 0.95;

export interface ViewportOptions {
  /** The SVG whose viewBox is controlled. */
  svg: SVGSVGElement;
  /** Element that receives the cursor classes (can-pan / is-panning). */
  container: HTMLElement;
  /** Returns true when a left-button drag should pan (e.g. Pan tool active). */
  canPanWithLeftButton: () => boolean;
  /** Called whenever the zoom or position changes. */
  onChange?: (scale: number) => void;
}

interface DragState {
  pointerId: number;
  lastX: number;
  lastY: number;
}

/**
 * Camera for the map: handles zoom (mouse wheel, centered on the cursor),
 * pan (middle button, Space + drag, or left drag with the Pan tool)
 * and "fit to screen".
 *
 * Internally: `scale` is screen pixels per world unit, and (x, y) is the
 * world point shown at the top-left corner of the SVG.
 */
export class Viewport {
  private readonly svg: SVGSVGElement;
  private readonly options: ViewportOptions;

  private x = 0;
  private y = 0;
  private scale = 1;
  private width = 0;
  private height = 0;
  private initialized = false;

  private spaceDown = false;
  private drag: DragState | null = null;

  constructor(options: ViewportOptions) {
    this.options = options;
    this.svg = options.svg;

    new ResizeObserver(() => this.handleResize()).observe(this.svg);

    this.svg.addEventListener('wheel', this.handleWheel, { passive: false });
    this.svg.addEventListener('pointerdown', this.handlePointerDown);
    this.svg.addEventListener('pointermove', this.handlePointerMove);
    this.svg.addEventListener('pointerup', this.handlePointerUp);
    this.svg.addEventListener('pointercancel', this.handlePointerUp);
    // Prevents the browser's middle-click autoscroll.
    this.svg.addEventListener('mousedown', (e) => {
      if (e.button === 1) e.preventDefault();
    });

    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', () => {
      this.spaceDown = false;
      this.refreshCursor();
    });
  }

  /** Current zoom (1 = 100%). */
  getScale(): number {
    return this.scale;
  }

  /** Converts a mouse position (clientX/clientY) to world coordinates. */
  screenToWorld(clientX: number, clientY: number): { x: number; y: number } {
    const p = this.toLocal(clientX, clientY);
    return { x: this.x + p.x / this.scale, y: this.y + p.y / this.scale };
  }

  /** Fits the whole world on screen, centered. */
  fit(): void {
    if (this.width === 0 || this.height === 0) return;

    this.scale = clamp(
      Math.min(this.width / WORLD_WIDTH, this.height / WORLD_HEIGHT) * FIT_MARGIN,
      MIN_SCALE,
      MAX_SCALE,
    );
    this.x = WORLD_WIDTH / 2 - this.width / (2 * this.scale);
    this.y = WORLD_HEIGHT / 2 - this.height / (2 * this.scale);
    this.apply();
  }

  /** Zooms by `factor`, keeping the point (px, py) — in SVG pixels — fixed. */
  zoomAt(px: number, py: number, factor: number): void {
    const newScale = clamp(this.scale * factor, MIN_SCALE, MAX_SCALE);
    if (newScale === this.scale) return;

    const worldX = this.x + px / this.scale;
    const worldY = this.y + py / this.scale;

    this.scale = newScale;
    this.x = worldX - px / this.scale;
    this.y = worldY - py / this.scale;
    this.apply();
  }

  /** Moves the map by (dx, dy) screen pixels. */
  panBy(dx: number, dy: number): void {
    this.x -= dx / this.scale;
    this.y -= dy / this.scale;
    this.apply();
  }

  /** Updates the cursor (call after the active tool changes). */
  refreshCursor(): void {
    const { container } = this.options;
    const canPan = this.spaceDown || this.options.canPanWithLeftButton();
    container.classList.toggle('can-pan', canPan);
    container.classList.toggle('is-panning', this.drag !== null);
  }

  // ---------- Internals ----------

  private apply(): void {
    if (this.width === 0 || this.height === 0) return;

    const w = this.width / this.scale;
    const h = this.height / this.scale;
    this.svg.setAttribute('viewBox', `${this.x} ${this.y} ${w} ${h}`);
    this.options.onChange?.(this.scale);
  }

  private toLocal(clientX: number, clientY: number): { x: number; y: number } {
    const rect = this.svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  private handleResize(): void {
    const rect = this.svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this.width = rect.width;
    this.height = rect.height;

    if (!this.initialized) {
      this.initialized = true;
      this.fit();
    } else {
      this.apply();
    }
  }

  private handleWheel = (e: WheelEvent): void => {
    e.preventDefault();

    let delta = e.deltaY;
    if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) delta *= 16;
    else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) delta *= this.height;

    const p = this.toLocal(e.clientX, e.clientY);
    this.zoomAt(p.x, p.y, Math.exp(-delta * ZOOM_SPEED));
  };

  private handlePointerDown = (e: PointerEvent): void => {
    const isMiddle = e.button === 1;
    const isLeftPan =
      e.button === 0 && (this.spaceDown || this.options.canPanWithLeftButton());
    if (!isMiddle && !isLeftPan) return;

    e.preventDefault();
    this.svg.setPointerCapture(e.pointerId);
    this.drag = { pointerId: e.pointerId, lastX: e.clientX, lastY: e.clientY };
    this.refreshCursor();
  };

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;

    const dx = e.clientX - this.drag.lastX;
    const dy = e.clientY - this.drag.lastY;
    this.drag.lastX = e.clientX;
    this.drag.lastY = e.clientY;
    this.panBy(dx, dy);
  };

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.drag || e.pointerId !== this.drag.pointerId) return;

    if (this.svg.hasPointerCapture(e.pointerId)) {
      this.svg.releasePointerCapture(e.pointerId);
    }
    this.drag = null;
    this.refreshCursor();
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.code !== 'Space' || isTypingTarget(e.target)) return;

    e.preventDefault(); // stops the page from scrolling / buttons from clicking
    if (!this.spaceDown) {
      this.spaceDown = true;
      this.refreshCursor();
    }
  };

  private handleKeyUp = (e: KeyboardEvent): void => {
    if (e.code !== 'Space') return;

    this.spaceDown = false;
    this.refreshCursor();
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
