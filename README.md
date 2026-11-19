# Cartograph - RPG Map Editor

A simple, local web editor for drawing and organizing RPG world maps.

Sketch coastlines, rivers and borders freehand, place cities with labels you can hide, split the world into nations and regions, and keep notes on each of them. Use an image as a background reference with adjustable opacity and trace over it.

> Personal tool — runs locally in the browser, no server, maps are saved as `.json` files on your PC.

## Features (planned)

- Freehand drawing with smooth, sketch-style strokes
- Layers (coast, rivers, relief, borders…) that can be shown, hidden or locked
- Background image with adjustable opacity, position and scale
- City and point-of-interest markers with toggleable labels
- Regions and nations with hierarchy, colors and notes
- Snapping so strokes connect to each other
- Save and open maps as `.json` files
- Export to PNG/SVG

## Tech stack

- [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/)
- SVG rendering
- [perfect-freehand](https://github.com/steveruizok/perfect-freehand) for strokes
- File System Access API for saving (Chrome / Edge)

## Getting started

Requirements: [Node.js](https://nodejs.org/) 20.19+ or 22.12+.

```bash
npm install
npm run dev
```

Then open the URL shown in the terminal (usually `http://localhost:5173`).

### Other scripts

| Command           | Description                        |
| ----------------- | ---------------------------------- |
| `npm run dev`     | Start the dev server               |
| `npm run build`   | Type-check and build to `dist/`    |
| `npm run preview` | Preview the production build       |

## Browser support

Saving directly to files uses the File System Access API, available in Chromium-based browsers (Chrome, Edge, Opera). Other browsers will fall back to download/upload.

## License

Personal project. All rights reserved.
# Cartograph
