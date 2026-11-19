import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Root element #app not found');
}

app.innerHTML = `
  <h1>Map Editor</h1>
  <p>Project is running. Next step: editor layout.</p>
`;
