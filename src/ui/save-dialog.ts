export type SaveFormat = 'json' | 'png' | 'svg';

export interface SaveChoice {
  format: SaveFormat;
  labels: boolean;
  compass: boolean;
}

/** "Save as" dialog: map file (.json) or image (.png / .svg), with options for images. */
export function createSaveDialog(parent: HTMLElement): {
  open(defaults: { compass: boolean }): Promise<SaveChoice | null>;
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
          <span>🗺️ <strong>Map file</strong> <small>.json — can be opened and edited again</small></span>
        </label>
        <label class="save-dialog__format">
          <input type="radio" name="format" value="png" />
          <span>🖼️ <strong>Image</strong> <small>.png — 4000 × 3000 picture to share</small></span>
        </label>
        <label class="save-dialog__format">
          <input type="radio" name="format" value="svg" />
          <span>✒️ <strong>Vector image</strong> <small>.svg — sharp at any size</small></span>
        </label>
      </div>
      <div class="save-dialog__options">
        <label><input type="checkbox" name="labels" checked /> Include names (cities and regions)</label>
        <label><input type="checkbox" name="compass" /> Include compass rose and scale</label>
      </div>
      <div class="save-dialog__buttons">
        <button type="button" class="panel-button" data-action="cancel">Cancel</button>
        <button type="submit" class="panel-button save-dialog__save">💾 Save</button>
      </div>
    </form>
  `;
  parent.append(overlay);

  const form = overlay.querySelector<HTMLFormElement>('form')!;
  const options = overlay.querySelector<HTMLDivElement>('.save-dialog__options')!;
  let resolve: ((choice: SaveChoice | null) => void) | null = null;

  const updateOptions = (): void => {
    const format = (form.elements.namedItem('format') as RadioNodeList).value;
    options.classList.toggle('is-disabled', format === 'json');
  };
  form.addEventListener('change', updateOptions);

  function close(choice: SaveChoice | null): void {
    overlay.hidden = true;
    resolve?.(choice);
    resolve = null;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    close({
      format: (data.get('format') as SaveFormat) ?? 'json',
      labels: data.get('labels') === 'on',
      compass: data.get('compass') === 'on',
    });
  });
  overlay.querySelector('[data-action="cancel"]')!.addEventListener('click', () => close(null));
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close(null);
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden) close(null);
  });

  function open(defaults: { compass: boolean }): Promise<SaveChoice | null> {
    (form.elements.namedItem('compass') as HTMLInputElement).checked = defaults.compass;
    updateOptions();
    overlay.hidden = false;
    overlay.querySelector<HTMLButtonElement>('.save-dialog__save')!.focus();
    return new Promise((r) => {
      resolve = r;
    });
  }

  return { open };
}
