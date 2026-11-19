import type { BackgroundImage } from '../core/background';
import { createSvg } from '../core/svg';

export interface BackgroundLayer {
  render(bg: BackgroundImage | null): void;
}

/** Draws the background image inside the given SVG group. */
export function createBackgroundLayer(group: SVGGElement): BackgroundLayer {
  const image = createSvg('image', {
    class: 'background-image',
    preserveAspectRatio: 'none',
  });

  let currentSrc = '';

  function render(bg: BackgroundImage | null): void {
    if (!bg) {
      image.remove();
      currentSrc = '';
      return;
    }

    if (!image.isConnected) group.append(image);

    if (bg.src !== currentSrc) {
      image.setAttribute('href', bg.src);
      currentSrc = bg.src;
    }

    image.setAttribute('x', String(bg.x));
    image.setAttribute('y', String(bg.y));
    image.setAttribute('width', String(bg.naturalWidth * bg.scale));
    image.setAttribute('height', String(bg.naturalHeight * bg.scale));
    image.setAttribute('opacity', String(bg.opacity));
  }

  return { render };
}
