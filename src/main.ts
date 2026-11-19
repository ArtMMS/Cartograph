import './style.css';
import { createLayout } from './ui/layout';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root element #app not found');
}

createLayout(app);
