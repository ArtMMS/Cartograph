export interface FileBarHandlers {
  onNew(): void;
  onOpen(): void;
  onSave(): void;
  onSaveAs(): void;
}

export interface FileBar {
  element: HTMLElement;
  /** Shows the map/file name and whether there are unsaved changes. */
  render(name: string, dirty: boolean): void;
}

/** File buttons at the top-left of the map: New, Open, Save, Save as. */
export function createFileBar(handlers: FileBarHandlers): FileBar {
  const element = document.createElement('div');
  element.className = 'file-bar';

  element.innerHTML = `
    <span class="file-bar__name"></span>
    <span class="file-bar__dirty" title="Unsaved changes">●</span>
    <span class="file-bar__sep"></span>
    <button type="button" class="file-bar__button" data-action="new" title="New map">✨ New</button>
    <button type="button" class="file-bar__button" data-action="open" title="Open (Ctrl+O)">📂 Open</button>
    <button type="button" class="file-bar__button" data-action="save" title="Save (Ctrl+S)">💾 Save</button>
    <button type="button" class="file-bar__button" data-action="save-as" title="Save as (Ctrl+Shift+S)">Save as…</button>
  `;

  const name = element.querySelector<HTMLSpanElement>('.file-bar__name')!;
  const dirtyMark = element.querySelector<HTMLSpanElement>('.file-bar__dirty')!;

  const actions: Record<string, () => void> = {
    new: handlers.onNew,
    open: handlers.onOpen,
    save: handlers.onSave,
    'save-as': handlers.onSaveAs,
  };

  element.addEventListener('click', (e) => {
    const button = (e.target as Element).closest<HTMLButtonElement>('[data-action]');
    if (button) actions[button.dataset.action ?? '']?.();
  });

  function render(fileName: string, dirty: boolean): void {
    name.textContent = fileName;
    name.title = fileName;
    dirtyMark.hidden = !dirty;
  }

  return { element, render };
}
