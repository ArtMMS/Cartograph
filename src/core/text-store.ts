import type { MapText } from './text';

export type TextPatch = Partial<Omit<MapText, 'id' | 'layerId'>>;

export interface RemovedText {
  text: MapText;
  index: number;
}

/** Holds all free texts. */
export class TextStore {
  private texts: MapText[] = [];
  private readonly listeners = new Set<() => void>();
  /** Increases on every change (used to detect unsaved changes). */
  revision = 0;

  all(): readonly MapText[] {
    return this.texts;
  }

  get(id: string): MapText | undefined {
    return this.texts.find((t) => t.id === id);
  }

  insert(text: MapText, index = this.texts.length): void {
    this.texts.splice(index, 0, text);
    this.emit();
  }

  remove(id: string): RemovedText | null {
    const index = this.texts.findIndex((t) => t.id === id);
    if (index === -1) return null;
    const [text] = this.texts.splice(index, 1);
    this.emit();
    return { text, index };
  }

  removeWhere(predicate: (text: MapText) => boolean): RemovedText[] {
    const removed: RemovedText[] = [];
    for (let i = this.texts.length - 1; i >= 0; i--) {
      if (predicate(this.texts[i])) {
        const [text] = this.texts.splice(i, 1);
        removed.push({ text, index: i });
      }
    }
    if (removed.length > 0) this.emit();
    return removed.reverse();
  }

  update(id: string, patch: TextPatch): void {
    const text = this.get(id);
    if (!text) return;
    Object.assign(text, patch);
    this.emit();
  }

  replaceAll(texts: MapText[]): void {
    this.texts = [...texts];
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
