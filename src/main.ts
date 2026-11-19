import './style.css';
import { applyTheme, loadTheme } from './core/theme';
import { createLayout } from './ui/layout';

// Apply the theme before building the UI to avoid a light/dark flash.
applyTheme(loadTheme());

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root element #app not found');
}

createLayout(app);
