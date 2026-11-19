import type { AutosaveInfo } from '../core/autosave';
import { SCALE_PRESETS, formatDistance, type ScalePresetId } from '../core/map-scale';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../core/world';

export interface StartMenuHandlers {
  onCreate(preset: ScalePresetId): void;
  onOpen(): void;
  onRestore(): void;
}

export interface StartMenu {
  /** Opens the menu. `step: 'new'` jumps straight to the size presets. */
  open(options: { step?: 'home' | 'new'; autosave: AutosaveInfo | null; closable: boolean }): void;
  close(): void;
}

/** Full-screen menu: "Create new" (choose a size preset) or "Open file". */
export function createStartMenu(parent: HTMLElement, handlers: StartMenuHandlers): StartMenu {
  const overlay = document.createElement('div');
  overlay.className = 'start-menu';
  overlay.hidden = true;

  const card = document.createElement('div');
  card.className = 'start-menu__card';
  overlay.append(card);
  parent.append(overlay);

  let closable = false;

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && closable) close();
  });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.hidden && closable) close();
  });

  function renderHome(autosave: AutosaveInfo | null): void {
    card.innerHTML = `
      <h1 class="start-menu__title">🗺️ Cartograph</h1>
      <p class="start-menu__subtitle">RPG map editor</p>
      <div class="start-menu__actions">
        <button type="button" class="start-menu__big" data-action="new">
          <span class="start-menu__icon">✨</span>
          <span><strong>Create new</strong><small>Start a blank map</small></span>
        </button>
        <button type="button" class="start-menu__big" data-action="open">
          <span class="start-menu__icon">📂</span>
          <span><strong>Open file</strong><small>Load a .json map from your PC</small></span>
        </button>
      </div>
    `;

    if (autosave) {
      const when = new Date(autosave.savedAt).toLocaleString();
      const restore = document.createElement('button');
      restore.type = 'button';
      restore.className = 'start-menu__restore';
      restore.dataset.action = 'restore';
      restore.innerHTML = `♻️ Restore last session: <strong></strong> <small>(${when}${
        autosave.hasImages ? '' : ' · without images'
      })</small>`;
      restore.querySelector('strong')!.textContent = autosave.name;
      card.append(restore);
    }

    card.querySelector('[data-action="new"]')!.addEventListener('click', renderPresets);
    card.querySelector('[data-action="open"]')!.addEventListener('click', handlers.onOpen);
    card.querySelector('[data-action="restore"]')?.addEventListener('click', handlers.onRestore);
  }

  function renderPresets(): void {
    card.innerHTML = `
      <h2 class="start-menu__heading">How big is this map?</h2>
      <p class="start-menu__subtitle">Sets the hex size and km scale — you can change it later in the bottom bar.</p>
      <div class="start-menu__presets"></div>
      <button type="button" class="start-menu__back">← Back</button>
    `;

    const list = card.querySelector('.start-menu__presets')!;
    for (const preset of SCALE_PRESETS) {
      const w = formatDistance(WORLD_WIDTH * preset.kmPerUnit);
      const h = formatDistance(WORLD_HEIGHT * preset.kmPerUnit);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'start-menu__preset';
      button.innerHTML = `
        <span class="start-menu__preset-icon">${preset.icon}</span>
        <strong>${preset.name}</strong>
        <span class="start-menu__preset-size">${w} × ${h}</span>
        <span class="start-menu__preset-hex">1 hex = ${formatDistance(preset.hexSizeKm)}</span>
        <small>${preset.description}</small>
      `;
      button.addEventListener('click', () => handlers.onCreate(preset.id));
      list.append(button);
    }

    card.querySelector('.start-menu__back')!.addEventListener('click', () => renderHome(lastAutosave));
  }

  let lastAutosave: AutosaveInfo | null = null;

  function open(options: {
    step?: 'home' | 'new';
    autosave: AutosaveInfo | null;
    closable: boolean;
  }): void {
    lastAutosave = options.autosave;
    closable = options.closable;
    overlay.classList.toggle('is-closable', closable);
    if (options.step === 'new') renderPresets();
    else renderHome(options.autosave);
    overlay.hidden = false;
  }

  function close(): void {
    overlay.hidden = true;
  }

  return { open, close };
}
