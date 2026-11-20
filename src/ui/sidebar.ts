export interface Sidebar {
  element: HTMLElement;
  /** Container for the brush (pencil) controls. */
  brushSlot: HTMLElement;
  /** Container for the selected stroke controls. */
  selectionSlot: HTMLElement;
  /** Container for the "new marker" type picker. */
  markerToolSlot: HTMLElement;
  /** Container for the "new region" type picker. */
  regionToolSlot: HTMLElement;
  /** Container for the distance / travel time results. */
  travelSlot: HTMLElement;
  /** Container for the regions tree. */
  regionsSlot: HTMLElement;
  /** Container for the layers list. */
  layersSlot: HTMLElement;
  /** Container for the marker display settings. */
  markersSlot: HTMLElement;
  /** Container for the image layer controls. */
  backgroundSlot: HTMLElement;
  /** Shows/hides the Brush section (only useful with the Pencil). */
  setBrushVisible(visible: boolean): void;
  /** Shows/hides the Selected stroke section. */
  setSelectionVisible(visible: boolean): void;
  /** Shows/hides the New marker section (only with the Marker tool). */
  setMarkerToolVisible(visible: boolean): void;
  /** Shows/hides the New region section (only with the Region tool). */
  setRegionToolVisible(visible: boolean): void;
  /** Shows/hides the Distance section (only with the Distance tool). */
  setTravelVisible(visible: boolean): void;
  /** Shows an element in the Details section (null = empty message). */
  setDetails(content: HTMLElement | null, title?: string): void;
  /** Empties the Details section, but only if it's showing `content`. */
  clearDetails(content: HTMLElement): void;
  /** Shows a message in the status line at the bottom of the sidebar. */
  setStatus(text: string): void;
}

export function createSidebar(): Sidebar {
  const element = document.createElement('aside');
  element.className = 'sidebar';

  const brush = createSection('Brush');
  const selection = createSection('Selected stroke');
  const markerTool = createSection('New marker');
  const regionTool = createSection('New region');
  const travel = createSection('Distance & travel time');
  const regions = createSection('Regions');
  const layers = createSection('Layers');
  const markers = createSection('Markers');
  const background = createSection('Images');

  const details = createSection('Details');
  details.section.classList.add('sidebar__section--grow');
  const emptyDetails = document.createElement('p');
  emptyDetails.className = 'sidebar__empty';
  emptyDetails.textContent = 'Select a city or region to see its notes.';
  details.body.append(emptyDetails);

  const status = document.createElement('footer');
  status.className = 'sidebar__status';

  element.append(
    brush.section,
    selection.section,
    markerTool.section,
    regionTool.section,
    travel.section,
    details.section,
    layers.section,
    regions.section,
    markers.section,
    background.section,
    status,
  );

  function setBrushVisible(visible: boolean): void {
    brush.section.hidden = !visible;
  }

  function setSelectionVisible(visible: boolean): void {
    selection.section.hidden = !visible;
  }

  function setMarkerToolVisible(visible: boolean): void {
    markerTool.section.hidden = !visible;
  }

  function setRegionToolVisible(visible: boolean): void {
    regionTool.section.hidden = !visible;
  }

  function setTravelVisible(visible: boolean): void {
    travel.section.hidden = !visible;
  }

  function clearDetails(content: HTMLElement): void {
    if (details.body.firstChild === content) setDetails(null);
  }

  function setDetails(content: HTMLElement | null, title = 'Details'): void {
    details.heading.textContent = content ? title : 'Details';
    const next = content ?? emptyDetails;
    if (details.body.firstChild !== next) details.body.replaceChildren(next);
    // With nothing selected, the Details section stays small.
    details.section.classList.toggle('sidebar__section--grow', content !== null);
  }

  function setStatus(text: string): void {
    status.textContent = text;
  }

  setSelectionVisible(false);
  setMarkerToolVisible(false);
  setRegionToolVisible(false);
  setTravelVisible(false);
  setDetails(null);

  return {
    element,
    brushSlot: brush.body,
    selectionSlot: selection.body,
    markerToolSlot: markerTool.body,
    regionToolSlot: regionTool.body,
    travelSlot: travel.body,
    regionsSlot: regions.body,
    layersSlot: layers.body,
    markersSlot: markers.body,
    backgroundSlot: background.body,
    setBrushVisible,
    setSelectionVisible,
    setMarkerToolVisible,
    setRegionToolVisible,
    setTravelVisible,
    setDetails,
    clearDetails,
    setStatus,
  };
}

function createSection(title: string): {
  section: HTMLElement;
  heading: HTMLElement;
  body: HTMLElement;
} {
  const section = document.createElement('section');
  section.className = 'sidebar__section';

  const heading = document.createElement('h2');
  heading.className = 'sidebar__heading';
  heading.textContent = title;

  const body = document.createElement('div');
  body.className = 'sidebar__body';

  section.append(heading, body);
  return { section, heading, body };
}
