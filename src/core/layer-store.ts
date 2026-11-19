import { BASE_LAYER_ID, createBaseLayer, type Layer } from './layer';

export type LayerPatch = Partial<Pick<Layer, 'name' | 'visible' | 'locked' | 'color'>>;

export interface RemovedLayer {
  layer: Layer;
  index: number;
}

/**
 * Holds the layers, from bottom (index 0 = Base) to top,
 * plus which one is active (where new strokes go).
 */
export class LayerStore {
  private layers: Layer[] = [createBaseLayer()];
  private activeId = BASE_LAYER_ID;
  private readonly listeners = new Set<() => void>();

  all(): readonly Layer[] {
    return this.layers;
  }

  get(id: string): Layer | undefined {
    return this.layers.find((l) => l.id === id);
  }

  indexOf(id: string): number {
    return this.layers.findIndex((l) => l.id === id);
  }

  getActive(): Layer {
    return this.get(this.activeId) ?? this.layers[0];
  }

  setActive(id: string): void {
    if (!this.get(id) || id === this.activeId) return;
    this.activeId = id;
    this.emit();
  }

  /** Inserts a layer at `index` (default: on top). The Base layer always stays at 0. */
  insert(layer: Layer, index = this.layers.length): void {
    const safeIndex = Math.max(1, Math.min(this.layers.length, index));
    this.layers.splice(safeIndex, 0, layer);
    this.emit();
  }

  /** Removes a layer (never the Base). If it was active, the one below becomes active. */
  remove(id: string): RemovedLayer | null {
    if (id === BASE_LAYER_ID) return null;
    const index = this.indexOf(id);
    if (index === -1) return null;

    const [layer] = this.layers.splice(index, 1);
    if (this.activeId === id) this.activeId = this.layers[index - 1].id;
    this.emit();
    return { layer, index };
  }

  update(id: string, patch: LayerPatch): void {
    const layer = this.get(id);
    if (!layer) return;
    Object.assign(layer, patch);
    this.emit();
  }

  /** Moves a layer to a new index (1 or above — the Base can't move). */
  move(id: string, toIndex: number): void {
    const from = this.indexOf(id);
    if (from <= 0) return;

    const to = Math.max(1, Math.min(this.layers.length - 1, toIndex));
    if (to === from) return;

    const [layer] = this.layers.splice(from, 1);
    this.layers.splice(to, 0, layer);
    this.emit();
  }

  /** Notifies listeners after changing a layer's image in place (position, opacity…). */
  notify(): void {
    this.emit();
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
