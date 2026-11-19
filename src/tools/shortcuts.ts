import { TOOLS, type ToolId } from './tool-ids';

export interface ShortcutHandlers {
  onTool: (id: ToolId) => void;
  onUndo: () => void;
  onRedo: () => void;
  onDelete: () => void;
  onEscape: () => void;
}

/**
 * Keyboard shortcuts:
 * - Tool letters (H, V, P, E, M, R)
 * - Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo
 * - Delete / Backspace: delete selection
 * - Esc: clear selection
 */
export function attachShortcuts(handlers: ShortcutHandlers): void {
  window.addEventListener('keydown', (e) => {
    if (isTypingTarget(e.target)) return;

    const key = e.key.toLowerCase();

    if (e.ctrlKey || e.metaKey) {
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        handlers.onUndo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        handlers.onRedo();
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
