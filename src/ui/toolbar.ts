import { TOOLS, type ToolId } from '../tools/tool-ids';

export interface Toolbar {
  element: HTMLElement;
  setActive(id: ToolId): void;
}

export function createToolbar(onSelect: (id: ToolId) => void): Toolbar {
  const element = document.createElement('nav');
  element.className = 'toolbar';

  const title = document.createElement('div');
  title.className = 'toolbar__title';
  title.textContent = 'Cartograph';
  element.append(title);

  const buttons = new Map<ToolId, HTMLButtonElement>();

  for (const tool of TOOLS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'toolbar__button';
    button.title = `${tool.label} (${tool.shortcut})`;
    button.innerHTML = `<span class="toolbar__icon">${tool.icon}</span><span class="toolbar__label">${tool.label}</span>`;
    button.addEventListener('click', () => onSelect(tool.id));
    buttons.set(tool.id, button);
    element.append(button);
  }

  function setActive(id: ToolId): void {
    for (const [toolId, button] of buttons) {
      button.classList.toggle('is-active', toolId === id);
    }
  }

  return { element, setActive };
}
