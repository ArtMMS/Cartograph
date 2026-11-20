import { renderMarkdown } from '../core/markdown';

export interface InfoContent {
  icon: string;
  title: string;
  subtitle: string;
  /** e.g. "Farawen › Terras Selvagens" */
  path: string;
  notes: string;
}

export interface InfoBox {
  show(content: InfoContent): void;
  hide(): void;
}

/** Read-only note box for View mode (resizable by dragging its corner). */
export function createInfoBox(parent: HTMLElement, onClose: () => void): InfoBox {
  const element = document.createElement('div');
  element.className = 'info-box';
  element.hidden = true;
  element.innerHTML = `
    <header class="info-box__header">
      <span class="info-box__icon"></span>
      <div class="info-box__titles">
        <strong class="info-box__title"></strong>
        <small class="info-box__subtitle"></small>
      </div>
      <button type="button" class="info-box__close" title="Close">×</button>
    </header>
    <p class="info-box__path"></p>
    <div class="info-box__body notes__preview"></div>
  `;
  parent.append(element);

  const q = <T extends HTMLElement>(s: string): T => element.querySelector<T>(s)!;
  q('.info-box__close').addEventListener('click', () => {
    hide();
    onClose();
  });

  // Clicks inside the box shouldn't reach the map.
  element.addEventListener('pointerdown', (e) => e.stopPropagation());
  element.addEventListener('wheel', (e) => e.stopPropagation());

  function show(content: InfoContent): void {
    q('.info-box__icon').textContent = content.icon;
    q('.info-box__title').textContent = content.title || '(no name)';
    q('.info-box__subtitle').textContent = content.subtitle;
    const path = q<HTMLParagraphElement>('.info-box__path');
    path.textContent = content.path ? `📍 ${content.path}` : '';
    path.hidden = !content.path;
    q('.info-box__body').innerHTML = content.notes.trim()
      ? renderMarkdown(content.notes)
      : '<p class="notes__empty">No notes.</p>';
    element.hidden = false;
  }

  function hide(): void {
    element.hidden = true;
  }

  return { show, hide };
}
