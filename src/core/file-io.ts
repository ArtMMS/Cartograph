const FILE_TYPES: FilePickerAcceptType[] = [
  { description: 'Cartograph map', accept: { 'application/json': ['.json'] } },
];

/** True in Chrome/Edge, where we can save directly to a file on the PC. */
export function hasFileSystemAccess(): boolean {
  return typeof window.showSaveFilePicker === 'function';
}

/** True when the user closed the file picker (not an error). */
export function isCancel(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError';
}

export interface OpenedFile {
  text: string;
  name: string;
  /** Present when opened with the File System Access API (allows "Save" to overwrite). */
  handle?: FileSystemFileHandle;
}

/** Asks the user for a .json file and reads it. */
export async function openFile(): Promise<OpenedFile> {
  if (typeof window.showOpenFilePicker === 'function') {
    const [handle] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
    const file = await handle.getFile();
    return { text: await file.text(), name: file.name, handle };
  }

  // Fallback: classic file input.
  const file = await pickFileWithInput('.json,application/json');
  return { text: await file.text(), name: file.name };
}

/** Writes to an existing file (the one opened or saved before). */
export async function writeFile(handle: FileSystemFileHandle, text: string): Promise<void> {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

/**
 * "Save as": asks where to save and writes the file.
 * Returns the new handle (or undefined when the browser only supports downloading).
 */
export async function saveFileAs(
  text: string,
  suggestedName: string,
): Promise<FileSystemFileHandle | undefined> {
  if (typeof window.showSaveFilePicker === 'function') {
    const handle = await window.showSaveFilePicker({ suggestedName, types: FILE_TYPES });
    await writeFile(handle, text);
    return handle;
  }

  // Fallback: download the file.
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return undefined;
}

function pickFileWithInput(accept: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) resolve(file);
      else reject(new DOMException('No file chosen', 'AbortError'));
    });
    input.addEventListener('cancel', () => reject(new DOMException('Cancelled', 'AbortError')));
    input.click();
  });
}
