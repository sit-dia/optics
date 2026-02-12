import './styles/main.css';
import './styles/panels.css';
import { ThinLensPanel } from './panels/thin-lens';

const container = document.querySelector<HTMLElement>('[data-panel="thin-lens"]');
if (container) {
  new ThinLensPanel(container);
}
