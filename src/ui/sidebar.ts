export interface Sidebar {
  element: HTMLElement;
  /** Shows a message in the status line at the bottom of the sidebar. */
  setStatus(text: string): void;
}

export function createSidebar(): Sidebar {
  const element = document.createElement('aside');
  element.className = 'sidebar';

  element.innerHTML = `
    <section class="sidebar__section">
      <h2 class="sidebar__heading">Layers</h2>
      <p class="sidebar__empty">No layers yet.</p>
    </section>

    <section class="sidebar__section">
      <h2 class="sidebar__heading">Background</h2>
      <p class="sidebar__empty">No background image.</p>
    </section>

    <section class="sidebar__section sidebar__section--grow">
      <h2 class="sidebar__heading">Details</h2>
      <p class="sidebar__empty">Select a region or city to see its notes.</p>
    </section>

    <footer class="sidebar__status"></footer>
  `;

  const status = element.querySelector<HTMLElement>('.sidebar__status')!;

  function setStatus(text: string): void {
    status.textContent = text;
  }

  return { element, setStatus };
}
