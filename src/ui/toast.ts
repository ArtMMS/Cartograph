export type ToastKind = 'success' | 'error' | 'info';

/** Small notification at the bottom of the screen that disappears by itself. */
export function createToaster(parent: HTMLElement): (message: string, kind?: ToastKind) => void {
  const container = document.createElement('div');
  container.className = 'toasts';
  parent.append(container);

  return (message, kind = 'info') => {
    const toast = document.createElement('div');
    toast.className = `toast toast--${kind}`;
    toast.textContent = message;
    container.append(toast);

    // Next frame → CSS transition in.
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    setTimeout(() => {
      toast.classList.remove('is-visible');
      setTimeout(() => toast.remove(), 300);
    }, kind === 'error' ? 4500 : 2500);
  };
}
