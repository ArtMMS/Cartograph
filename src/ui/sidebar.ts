export interface Sidebar {
  element: HTMLElement;
  /** Container for the brush (pencil) controls. */
  brushSlot: HTMLElement;
  /** Container for the selected stroke controls. */
  selectionSlot: HTMLElement;
  /** Container for the layers list. */
  layersSlot: HTMLElement;
  /** Container for the image layer controls. */
  backgroundSlot: HTMLElement;
  /** Shows/hides the Brush section (only useful with the Pencil). */
  setBrushVisible(visible: boolean): void;
  /** Shows/hides the Selected stroke section. */
  setSelectionVisible(visible: boolean): void;
  /** Shows a message in the status line at the bottom of the sidebar. */
  setStatus(text: string): void;
}

export function createSidebar(): Sidebar {
  const element = document.createElement('aside');
  element.className = 'sidebar';

  const brush = createSection('Brush');
  const selection = createSection('Selected stroke');

  const layers = createSection('Layers');

  const background = createSection('Images');

  const details = createSection('Details');
  details.section.classList.add('sidebar__section--grow');
  details.body.innerHTML =
    '<p class="sidebar__empty">Select a region or city to see its notes.</p>';

  const status = document.createElement('footer');
  status.className = 'sidebar__status';

  element.append(
    brush.section,
    selection.section,
    layers.section,
    background.section,
    details.section,
    status,
  );

  function setBrushVisible(visible: boolean): void {
    brush.section.hidden = !visible;
  }

  function setSelectionVisible(visible: boolean): void {
    selection.section.hidden = !visible;
  }

  function setStatus(text: string): void {
    status.textContent = text;
  }

  setSelectionVisible(false);

  return {
    element,
    brushSlot: brush.body,
    selectionSlot: selection.body,
    layersSlot: layers.body,
    backgroundSlot: background.body,
    setBrushVisible,
    setSelectionVisible,
    setStatus,
  };
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
