/**
 * Lets the user drop a file onto `target`. Shows a hint while dragging
 * and stops the browser from opening files dropped anywhere else.
 */
export function attachFileDrop(target: HTMLElement, message: string, onFile: (file: File) => void): void {
  const hint = document.createElement('div');
  hint.className = 'drop-hint';
  hint.textContent = message;
  target.append(hint);

  // dragenter/dragleave fire for every child element, so count them.
  let depth = 0;

  const hasFiles = (e: DragEvent): boolean => e.dataTransfer?.types.includes('Files') ?? false;

  const setActive = (active: boolean): void => {
    target.classList.toggle('is-drop-target', active);
  };

  target.addEventListener('dragenter', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth++;
    setActive(true);
  });

  target.addEventListener('dragover', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
  });

  target.addEventListener('dragleave', (e) => {
    if (!hasFiles(e)) return;
    depth = Math.max(0, depth - 1);
    if (depth === 0) setActive(false);
  });

  target.addEventListener('drop', (e) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth = 0;
    setActive(false);

    const file = e.dataTransfer?.files[0];
    if (file) onFile(file);
  });

  // Dropping outside the map shouldn't open the file in the browser tab.
  window.addEventListener('dragover', (e) => e.preventDefault());
  window.addEventListener('drop', (e) => e.preventDefault());
}
