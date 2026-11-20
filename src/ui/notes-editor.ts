import { renderMarkdown } from '../core/markdown';

export interface NotesEditor {
  element: HTMLElement;
  /** Shows the notes (doesn't overwrite while the user is typing). */
  setValue(value: string): void;
  /** Leaves the text field (e.g. when another item is selected). */
  blur(): void;
}

/** Notes field with an Edit / Preview switch. Notes can be plain text or Markdown. */
export function createNotesEditor(onInput: (value: string) => void): NotesEditor {
  const element = document.createElement('div');
  element.className = 'notes';

  element.innerHTML = `
    <div class="notes__tabs">
      <button type="button" class="notes__tab is-active" data-mode="edit">✏️ Edit</button>
      <button type="button" class="notes__tab" data-mode="preview">👁 Preview</button>
      <span class="notes__help" title="**bold**  *italic*  # Heading  - list  > quote  [link](https://…)">Markdown ⓘ</span>
    </div>
    <textarea class="notes__input" rows="9"
      placeholder="Notes: history, NPCs, rumors… (Markdown works: **bold**, # Heading, - list)"></textarea>
    <div class="notes__preview" hidden></div>
  `;

  const input = element.querySelector<HTMLTextAreaElement>('.notes__input')!;
  const preview = element.querySelector<HTMLDivElement>('.notes__preview')!;
  const tabs = [...element.querySelectorAll<HTMLButtonElement>('.notes__tab')];
  let mode: 'edit' | 'preview' = 'edit';

  input.addEventListener('input', () => onInput(input.value));

  for (const tab of tabs) {
    tab.addEventListener('click', () => setMode(tab.dataset.mode === 'preview' ? 'preview' : 'edit'));
  }

  // Double-click the preview to go back to editing.
  preview.addEventListener('dblclick', () => {
    setMode('edit');
    input.focus();
  });

  function setMode(next: 'edit' | 'preview'): void {
    mode = next;
    for (const tab of tabs) tab.classList.toggle('is-active', tab.dataset.mode === next);
    input.hidden = next !== 'edit';
    preview.hidden = next !== 'preview';
    if (next === 'preview') renderPreview();
  }

  function renderPreview(): void {
    preview.innerHTML = input.value.trim()
      ? renderMarkdown(input.value)
      : '<p class="notes__empty">No notes yet.</p>';
  }

  function setValue(value: string): void {
    if (document.activeElement !== input) input.value = value;
    if (mode === 'preview') renderPreview();
  }

  return { element, setValue, blur: () => input.blur() };
}
