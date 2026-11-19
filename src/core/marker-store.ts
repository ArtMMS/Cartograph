import {
  createDefaultMarkerView,
  type Marker,
  type MarkerType,
  type MarkerView,
} from './marker';

export type MarkerPatch = Partial<Pick<Marker, 'type' | 'name' | 'x' | 'y' | 'notes'>>;

export interface RemovedMarker {
  marker: Marker;
  index: number;
}

/** Holds all markers and the marker display settings. */
export class MarkerStore {
  private markers: Marker[] = [];
  private view: MarkerView = createDefaultMarkerView();
  private readonly listeners = new Set<() => void>();
  /** Increases on every change (used to detect unsaved changes). */
  revision = 0;

  all(): readonly Marker[] {
    return this.markers;
  }

  get(id: string): Marker | undefined {
    return this.markers.find((m) => m.id === id);
  }

  getView(): MarkerView {
    return this.view;
  }

  insert(marker: Marker, index = this.markers.length): void {
    this.markers.splice(index, 0, marker);
    this.emit();
  }

  remove(id: string): RemovedMarker | null {
    const index = this.markers.findIndex((m) => m.id === id);
    if (index === -1) return null;
    const [marker] = this.markers.splice(index, 1);
    this.emit();
    return { marker, index };
  }

  /** Removes every matching marker, in ascending index order (re-insert in reverse to undo). */
  removeWhere(predicate: (marker: Marker) => boolean): RemovedMarker[] {
    const removed: RemovedMarker[] = [];
    for (let i = this.markers.length - 1; i >= 0; i--) {
      if (predicate(this.markers[i])) {
        const [marker] = this.markers.splice(i, 1);
        removed.push({ marker, index: i });
      }
    }
    if (removed.length > 0) this.emit();
    return removed.reverse();
  }

  update(id: string, patch: MarkerPatch): void {
    const marker = this.get(id);
    if (!marker) return;
    Object.assign(marker, patch);
    this.emit();
  }

  setShowLabels(show: boolean): void {
    this.view.showLabels = show;
    this.emit();
  }

  setTypeHidden(type: MarkerType, hidden: boolean): void {
    const set = new Set(this.view.hiddenTypes);
    if (hidden) set.add(type);
    else set.delete(type);
    this.view.hiddenTypes = [...set];
    this.emit();
  }

  replaceAll(markers: Marker[], view: MarkerView): void {
    this.markers = [...markers];
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
