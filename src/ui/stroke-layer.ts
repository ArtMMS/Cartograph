import { getStrokePath, type Stroke } from '../core/stroke';
import { createSvg } from '../core/svg';

export interface StrokeLayer {
  /** Adds one finished stroke. */
  add(stroke: Stroke): void;
  /** Redraws all strokes from scratch (e.g. after opening a file). */
  renderAll(strokes: readonly Stroke[]): void;
  /** Shows the stroke being drawn (null hides it). */
  setPreview(stroke: Stroke | null): void;
}

/** Draws freehand strokes as filled SVG paths. */
export function createStrokeLayer(group: SVGGElement): StrokeLayer {
  const committed = createSvg('g', { class: 'strokes' });
  const preview = createSvg('path', { class: 'stroke stroke--preview' });
  group.append(committed, preview);

  const paths = new Map<string, SVGPathElement>();

  function add(stroke: Stroke): void {
    const path = createSvg('path', {
      class: 'stroke',
      'data-stroke-id': stroke.id,
      d: getStrokePath(stroke),
      fill: stroke.color,
    });
    paths.set(stroke.id, path);
    committed.append(path);
  }

  function renderAll(strokes: readonly Stroke[]): void {
    committed.replaceChildren();
    paths.clear();
    for (const stroke of strokes) add(stroke);
  }

  function setPreview(stroke: Stroke | null): void {
    if (!stroke) {
      preview.setAttribute('d', '');
      return;
    }
    preview.setAttribute('d', getStrokePath(stroke, false));
    preview.setAttribute('fill', stroke.color);
  }

  return { add, renderAll, setPreview };
}
