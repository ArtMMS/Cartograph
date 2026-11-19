import type { Stroke } from './stroke';

export type StrokePatch = Partial<Pick<Stroke, 'color' | 'size'>>;

export interface RemovedStroke {
  stroke: Stroke;
  index: number;
}

/** Holds all strokes (in drawing order) and notifies when they change. */
export class StrokeStore {
  private strokes: Stroke[] = [];
  private readonly listeners = new Set<() => void>();

  all(): readonly Stroke[] {
    return this.strokes;
  }

  get(id: string): Stroke | undefined {
    return this.strokes.find((s) => s.id === id);
  }

  /** Inserts a stroke at `index` (default: on top of everything). */
  insert(stroke: Stroke, index = this.strokes.length): void {
    this.strokes.splice(index, 0, stroke);
    this.emit();
  }

  /** Removes a stroke and returns where it was (for undo). */
  remove(id: string): RemovedStroke | null {
    const index = this.strokes.findIndex((s) => s.id === id);
    if (index === -1) return null;
    const [stroke] = this.strokes.splice(index, 1);
    this.emit();
    return { stroke, index };
  }

  update(id: string, patch: StrokePatch): void {
    const stroke = this.get(id);
    if (!stroke) return;
    Object.assign(stroke, patch);
    this.emit();
  }

  onChange(listener: () => void): void {
    this.listeners.add(listener);
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}
