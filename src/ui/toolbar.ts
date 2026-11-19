import type { Theme } from '../core/theme';
import { TOOLS, type ToolId } from '../tools/tool-ids';

export interface ToolbarOptions {
  onSelectTool: (id: ToolId) => void;
  onToggleTheme: () => void;
}

export interface Toolbar {
  element: HTMLElement;
  setActive(id: ToolId): void;
  /** Updates the theme button icon (☀️ light / 🌕 dark). */
  setTheme(theme: Theme): void;
}

export function createToolbar(options: ToolbarOptions): Toolbar {
  const element = document.createElement('nav');
  element.className = 'toolbar';

  const title = document.createElement('div');
  title.className = 'toolbar__title';
  title.textContent = 'Cartograph';
  element.append(title);

  const buttons = new Map<ToolId, HTMLButtonElement>();

  for (const tool of TOOLS) {
    const button = createButton(tool.icon, tool.label, `${tool.label} (${tool.shortcut})`);
    button.addEventListener('click', () => options.onSelectTool(tool.id));
    buttons.set(tool.id, button);
    element.append(button);
  }

  // Spacer pushes the theme button to the bottom.
  const spacer = document.createElement('div');
  spacer.className = 'toolbar__spacer';
  element.append(spacer);

  const themeButton = createButton('☀️', 'Light', 'Toggle light/dark mode');
  themeButton.addEventListener('click', options.onToggleTheme);
  element.append(themeButton);

  function setActive(id: ToolId): void {
    for (const [toolId, button] of buttons) {
      button.classList.toggle('is-active', toolId === id);
    }
  }

  function setTheme(theme: Theme): void {
    const icon = themeButton.querySelector('.toolbar__icon')!;
    const label = themeButton.querySelector('.toolbar__label')!;
    icon.textContent = theme === 'dark' ? '🌕' : '☀️';
    label.textContent = theme === 'dark' ? 'Dark' : 'Light';
  }

  return { element, setActive, setTheme };
}

function createButton(icon: string, label: string, title: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'toolbar__button';
  button.title = title;
  button.innerHTML = `<span class="toolbar__icon">${icon}</span><span class="toolbar__label">${label}</span>`;
  return button;
}
