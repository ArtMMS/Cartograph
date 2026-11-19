export interface Sidebar {
  element: HTMLElement;
  /** Container for the background image controls. */
  backgroundSlot: HTMLElement;
  /** Shows a message in the status line at the bottom of the sidebar. */
  setStatus(text: string): void;
}

export function createSidebar(): Sidebar {
  const element = document.createElement('aside');
  element.className = 'sidebar';

  const layers = createSection('Layers');
  layers.body.innerHTML = '<p class="sidebar__empty">No layers yet.</p>';

  const background = createSection('Background');

  const details = createSection('Details');
  details.section.classList.add('sidebar__section--grow');
  details.body.innerHTML =
    '<p class="sidebar__empty">Select a region or city to see its notes.</p>';

  const status = document.createElement('footer');
  status.className = 'sidebar__status';

  element.append(layers.section, background.section, details.section, status);

  function setStatus(text: string): void {
    status.textContent = text;
  }

  return { element, backgroundSlot: background.body, setStatus };
}

function createSection(title: string): { section: HTMLElement; body: HTMLElement } {
  const section = document.createElement('section');
  section.className = 'sidebar__section';

  const heading = document.createElement('h2');
  heading.className = 'sidebar__heading';
  heading.textContent = title;

  const body = document.createElement('div');
  body.className = 'sidebar__body';

  section.append(heading, body);
  return { section, body };
}
