export type ToolId = 'pan' | 'select' | 'pencil' | 'eraser' | 'marker' | 'region';

export interface ToolInfo {
  id: ToolId;
  label: string;
  icon: string;
  shortcut: string;
}

/** Tools shown in the toolbar, in display order. */
export const TOOLS: readonly ToolInfo[] = [
  { id: 'pan', label: 'Pan', icon: '✋', shortcut: 'H' },
  { id: 'select', label: 'Select', icon: '➤', shortcut: 'V' },
  { id: 'pencil', label: 'Pencil', icon: '✏️', shortcut: 'P' },
  { id: 'eraser', label: 'Eraser', icon: '🧽', shortcut: 'E' },
  { id: 'marker', label: 'City marker', icon: '📍', shortcut: 'M' },
  { id: 'region', label: 'Region', icon: '⬠', shortcut: 'R' },
];
