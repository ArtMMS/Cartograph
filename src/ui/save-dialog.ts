import { RESOLUTIONS, exportSize, type BorderStyle } from '../core/export';
import type { Box } from '../core/terrain';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';

export type SaveFormat = 'json' | 'png' | 'svg';

export interface SaveChoice {
  format: SaveFormat;
  labels: boolean;
  compass: boolean;
  hex: boolean;
  crop: Box;
  longSide: number;
  border: BorderStyle;
  title: string;
}

export interface SaveDialogDefaults {
  compass: boolean;
  hex: boolean;
  title: string;
  /** Part of the map visible on screen (for the "Current view" button). */
  visible: Box;
  /** Returns an image URL of the whole map, for the crop preview. */
  preview: () => string;
}

/** Smallest crop allowed (world units). */
const MIN_CROP = 40;

/**
 * "Save as" dialog: map file (.json) or image (.png / .svg). For images:
 * crop selector on a preview, resolution (1K/2K/4K), names, compass, hex grid,
 * border style and title.
 */
export function createSaveDialog(parent: HTMLElement): {
  open(defaults: SaveDialogDefaults): Promise<SaveChoice | null>;
} {
  const overlay = document.createElement('div');
  overlay.className = 'start-menu save-dialog';
  overlay.hidden = true;
  overlay.innerHTML = `
    <form class="start-menu__card save-dialog__card">
      <h2 class="start-menu__heading">Save as…</h2>
      <div class="save-dialog__formats">
        <label class="save-dialog__format">
          <input type="radio" name="format" value="json" checked />
          <span>🗺️ <strong>Map file</strong> <small>.json — open and edit again</small></span>
        </label>
        <label class="save-dialog__format">
          <input type="radio" name="format" value="png" />
          <span>🖼️ <strong>Image</strong> <small>.png — to share or print</small></span>
        </label>
        <label class="save-dialog__format">
          <input type="radio" name="format" value="svg" />
          <span>✒️ <strong>Vector</strong> <small>.svg — sharp at any size</small></span>
        </label>
      </div>

      <div class="save-dialog__image">
        <div class="save-dialog__preview-col">
          <div class="crop">
            <img class="crop__image" alt="Map preview" />
            <div class="crop__shade"></div>
            <div class="crop__box">
              <span class="crop__handle" data-corner="nw"></span>
              <span class="crop__handle" data-corner="ne"></span>
              <span class="crop__handle" data-corner="sw"></span>
              <span class="crop__handle" data-corner="se"></span>
            </div>
          </div>
          <div class="save-dialog__crop-buttons">
            <button type="button" class="panel-button" data-crop="full">Whole map</button>
            <button type="button" class="panel-button" data-crop="view">Current view</button>
            <span class="save-dialog__hint">Drag the box to crop</span>
          </div>
          <p class="save-dialog__size"></p>
        </div>

        <div class="save-dialog__options">
          <div class="save-dialog__group">
            <span class="save-dialog__label">Resolution</span>
            <div class="save-dialog__segmented">
              ${RESOLUTIONS.map(
                (r, i) =>
                  `<label><input type="radio" name="res" value="${r.longSide}" ${i === 1 ? 'checked' : ''}/><span>${r.name}</span></label>`,
              ).join('')}
            </div>
          </div>
          <div class="save-dialog__group">
            <span class="save-dialog__label">Border</span>
            <div class="save-dialog__segmented">
              <label><input type="radio" name="border" value="none" checked /><span>None</span></label>
              <label><input type="radio" name="border" value="classic" /><span>Classic</span></label>
              <label><input type="radio" name="border" value="royal" /><span>Royal</span></label>
            </div>
          </div>
          <label class="save-dialog__title">
            <span class="save-dialog__label">Title (on the border)</span>
            <input type="text" name="title" maxlength="60" />
          </label>
          <label><input type="checkbox" name="labels" checked /> Names (cities, regions)</label>
          <label><input type="checkbox" name="compass" /> Compass rose and scale</label>
          <label><input type="checkbox" name="hex" /> Hex grid</label>
        </div>
      </div>

      <div class="save-dialog__buttons">
        <button type="button" class="panel-button" data-action="cancel">Cancel</button>
        <button type="submit" class="panel-button save-dialog__save">💾 Save</button>
      </div>
    </form>
  `;
  parent.append(overlay);

  const form = overlay.querySelector<HTMLFormElement>('form')!;
  const imageOptions = overlay.querySelector<HTMLDivElement>('.save-dialog__image')!;
  const cropEl = overlay.querySelector<HTMLDivElement>('.crop')!;
  const cropImage = overlay.querySelector<HTMLImageElement>('.crop__image')!;
  const cropBox = overlay.querySelector<HTMLDivElement>('.crop__box')!;
  const sizeText = overlay.querySelector<HTMLParagraphElement>('.save-dialog__size')!;
  const titleField = overlay.querySelector<HTMLLabelElement>('.save-dialog__title')!;

  let crop: Box = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
  let visible: Box = crop;
  let resolve: ((choice: SaveChoice | null) => void) | null = null;
  let previewUrl = '';

  const value = (name: string): string =>
    (form.elements.namedItem(name) as RadioNodeList | HTMLInputElement).value;
  const checked = (name: string): boolean => (form.elements.namedItem(name) as HTMLInputElement).checked;

  // ---------- Crop box ----------

  function renderCrop(): void {
    cropBox.style.left = `${(crop.x / WORLD_WIDTH) * 100}%`;
    cropBox.style.top = `${(crop.y / WORLD_HEIGHT) * 100}%`;
    cropBox.style.width = `${(crop.width / WORLD_WIDTH) * 100}%`;
    cropBox.style.height = `${(crop.height / WORLD_HEIGHT) * 100}%`;
    renderSize();
  }

  function renderSize(): void {
    const border = value('border') as BorderStyle;
    const size = exportSize({ crop, longSide: Number(value('res')), border });
    sizeText.textContent = `Final image: ${size.width} × ${size.height} px`;
    titleField.classList.toggle('is-disabled', border === 'none');
  }

  function clampCrop(c: Box): Box {
    const width = Math.min(WORLD_WIDTH, Math.max(MIN_CROP, c.width));
    const height = Math.min(WORLD_HEIGHT, Math.max(MIN_CROP, c.height));
    return {
      x: Math.min(WORLD_WIDTH - width, Math.max(0, c.x)),
      y: Math.min(WORLD_HEIGHT - height, Math.max(0, c.y)),
      width,
      height,
    };
  }

  let drag: {
    pointerId: number;
    corner: string | null;
    startX: number;
    startY: number;
    start: Box;
  } | null = null;

  cropBox.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const corner = (e.target as HTMLElement).dataset.corner ?? null;
    cropBox.setPointerCapture(e.pointerId);
    drag = { pointerId: e.pointerId, corner, startX: e.clientX, startY: e.clientY, start: { ...crop } };
  });

  cropBox.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const rect = cropEl.getBoundingClientRect();
    const dx = ((e.clientX - drag.startX) / rect.width) * WORLD_WIDTH;
    const dy = ((e.clientY - drag.startY) / rect.height) * WORLD_HEIGHT;
    const s = drag.start;

    if (!drag.corner) {
      crop = clampCrop({ ...s, x: s.x + dx, y: s.y + dy });
    } else {
      let { x, y, width, height } = s;
      if (drag.corner.includes('w')) {
        x = Math.min(s.x + dx, s.x + s.width - MIN_CROP);
        x = Math.max(0, x);
        width = s.x + s.width - x;
      } else {
        width = Math.min(WORLD_WIDTH - s.x, Math.max(MIN_CROP, s.width + dx));
      }
      if (drag.corner.includes('n')) {
        y = Math.min(s.y + dy, s.y + s.height - MIN_CROP);
        y = Math.max(0, y);
        height = s.y + s.height - y;
      } else {
        height = Math.min(WORLD_HEIGHT - s.y, Math.max(MIN_CROP, s.height + dy));
      }
      crop = { x, y, width, height };
    }
    renderCrop();
  });

  const endDrag = (e: PointerEvent): void => {
    if (drag && e.pointerId === drag.pointerId) drag = null;
  };
  cropBox.addEventListener('pointerup', endDrag);
  cropBox.addEventListener('pointercancel', endDrag);

  overlay.querySelector('[data-crop="full"]')!.addEventListener('click', () => {
    crop = { x: 0, y: 0, width: WORLD_WIDTH, height: WORLD_HEIGHT };
    renderCrop();
  });
  overlay.querySelector('[data-crop="view"]')!.addEventListener('click', () => {
    // Intersect the visible area with the world.
    const x1 = Math.max(0, visible.x);
    const y1 = Math.max(0, visible.y);
    const x2 = Math.min(WORLD_WIDTH, visible.x + visible.width);
    const y2 = Math.min(WORLD_HEIGHT, visible.y + visible.height);
    crop = clampCrop({ x: x1, y: y1, width: x2 - x1, height: y2 - y1 });
    renderCrop();
  });

  // ---------- Form ----------

  const updateFormat = (): void => {
    imageOptions.classList.toggle('is-disabled', value('format') === 'json');
    renderSize();
  };
  form.addEventListener('change', updateFormat);

  function close(choice: SaveChoice | null): void {
    overlay.hidden = true;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = '';
    resolve?.(choice);
    resolve = null;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    close({
      format: value('format') as SaveFormat,
      labels: checked('labels'),
      compass: checked('compass'),
      hex: checked('hex'),
      crop: { ...crop },
      longSide: Number(value('res')),
      border: value('border') as BorderStyle,
      title: value('title'),
    });
  });
  overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(null));
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) close(null);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close(null);
  });

  function open(defaults: SaveDialogDefaults): Promise<SaveChoice | null> {
    (form.elements.namedItem('compass') as HTMLInputElement).checked = defaults.compass;
    (form.elements.namedItem('hex') as HTMLInputElement).checked = defaults.hex;
    (form.elements.namedItem('title') as HTMLInputElement).value = defaults.title;
    visible = defaults.visible;
    previewUrl = defaults.preview();
    cropImage.src = previewUrl;
    updateFormat();
    renderCrop();
    overlay.hidden = false;
    overlay.querySelector<HTMLButtonElement>('.save-dialog__save')!.focus();
    return new Promise((r) => {
      resolve = r;
    });
  }

  return { open };
}
