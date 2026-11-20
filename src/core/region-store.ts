import {
  createDefaultRegionView,
  type Region,
  type RegionType,
  type RegionView,
} from './region';

export type RegionPatch = Partial<Pick<Region, 'type' | 'name' | 'color' | 'parentId' | 'notes'>>;

export interface RemovedRegion {
  region: Region;
  index: number;
}

/** Holds all regions and the region display settings. */
export class RegionStore {
  private regions: Region[] = [];
  private view: RegionView = createDefaultRegionView();
  private readonly listeners = new Set<() => void>();
  /** Increases on every change (used to detect unsaved changes). */
  revision = 0;

  all(): readonly Region[] {
    return this.regions;
  }

  get(id: string): Region | undefined {
    return this.regions.find((r) => r.id === id);
  }

  children(id: string): Region[] {
    return this.regions.filter((r) => r.parentId === id);
  }

  getView(): RegionView {
    return this.view;
  }

  insert(region: Region, index = this.regions.length): void {
    this.regions.splice(index, 0, region);
    this.emit();
  }

  remove(id: string): RemovedRegion | null {
    const index = this.regions.findIndex((r) => r.id === id);
    if (index === -1) return null;
    const [region] = this.regions.splice(index, 1);
    this.emit();
    return { region, index };
  }

  /** Removes every matching region, in ascending index order (re-insert in reverse to undo). */
  removeWhere(predicate: (region: Region) => boolean): RemovedRegion[] {
    const removed: RemovedRegion[] = [];
    for (let i = this.regions.length - 1; i >= 0; i--) {
      if (predicate(this.regions[i])) {
        const [region] = this.regions.splice(i, 1);
        removed.push({ region, index: i });
      }
    }
    if (removed.length > 0) this.emit();
    return removed.reverse();
  }

  update(id: string, patch: RegionPatch): void {
    const region = this.get(id);
    if (!region) return;
    Object.assign(region, patch);
    this.emit();
  }

  /** Replaces the outline (moving a region). */
  updateShape(id: string, points: [number, number][]): void {
    const region = this.get(id);
    if (!region) return;
    region.points = points;
    this.emit();
  }

  /** Several updates with a single notification. */
  updateMany(patches: [string, RegionPatch][]): void {
    for (const [id, patch] of patches) {
      const region = this.get(id);
      if (region) Object.assign(region, patch);
    }
    this.emit();
  }

  setShowLabels(show: boolean): void {
    this.view.showLabels = show;
    this.emit();
  }

  setTypeHidden(type: RegionType, hidden: boolean): void {
    const set = new Set(this.view.hiddenTypes);
    if (hidden) set.add(type);
    else set.delete(type);
    this.view.hiddenTypes = [...set];
    this.emit();
  }

  replaceAll(regions: Region[], view: RegionView): void {
    this.regions = [...regions];
    this.view = { showLabels: view.showLabels, hiddenTypes: [...view.hiddenTypes] };
    this.emit();
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private emit(): void {
    this.revision++;
    for (const listener of this.listeners) listener();
  }
}
