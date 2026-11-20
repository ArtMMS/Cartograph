import { TOOLS, type ToolId } from './tool-ids';

export interface ShortcutHandlers {
  onTool: (id: ToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onEscape: () => void;
  onSave: () => void;
  onSaveAs: () => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onSearch: () => void;
  /** False in View mode: editing shortcuts are ignored. */
  canEdit: () => boolean;
}

/**
 * Keyboard shortcuts:
 * - Tool letters (H, V, P, E, M, R)
 * - Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
 * - Ctrl+D: duplicate selection
 * - Delete / Backspace: delete selection
 * - Esc: clear selection
 * - Ctrl+S save, Ctrl+Shift+S save as, Ctrl+O open, Ctrl+F search
 */
export function attachShortcuts(handlers: ShortcutHandlers): void {
  window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();

    // File shortcuts work even while typing in a field.
    if ((e.ctrlKey || e.metaKey) && key === 's') {
      e.preventDefault();
      if (e.shiftKey) handlers.onSaveAs();
      else handlers.onSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'o') {
      e.preventDefault();
      handlers.onOpen();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && key === 'f') {
      e.preventDefault();
      handlers.onSearch();
      return;
    }

    if (isTypingTarget(e.target)) return;

    if (e.key === 'Escape') {
      handlers.onEscape();
      return;
    }
    if (!handlers.canEdit()) return;

    if (e.ctrlKey || e.metaKey) {
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handlers.onUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handlers.onRedo();
      } else if (key === 'd') {
        e.preventDefault(); // stops the browser's "bookmark page"
        handlers.onDuplicate();
      }
      return;
    }

    if (e.altKey) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      handlers.onDelete();
      return;
    }

    if (e.key === 'Escape') {
      handlers.onEscape();
      return;
    }

    if (e.repeat) return;
    const tool = TOOLS.find((t) => t.shortcut.toLowerCase() === key);
    if (tool) handlers.onTool(tool.id);
  });
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}
