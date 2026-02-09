import './styles/main.css';
import './styles/panels.css';
import { DistortionPanel } from './panels/distortion';
import { KeyParamsPanel } from './panels/key-params';
import { LightPathPanel } from './panels/light-path';
import { ThinLensPanel } from './panels/thin-lens';
import { VacPanel } from './panels/vac';
import { ViewFrustumPanel } from './panels/view-frustum';

const panelMap = new Map<string, (container: HTMLElement) => void>([
  ['thin-lens', (container) => new ThinLensPanel(container)],
  ['light-path', (container) => new LightPathPanel(container)],
  ['params', (container) => new KeyParamsPanel(container)],
  ['frustum', (container) => new ViewFrustumPanel(container)],
  ['distortion', (container) => new DistortionPanel(container)],
  ['vac', (container) => new VacPanel(container)],
]);

function initPanels(): void {
  document.querySelectorAll<HTMLElement>('[data-panel]').forEach((panel) => {
    const key = panel.dataset.panel;
    if (!key) return;
    const init = panelMap.get(key);
    if (!init) return;
    init(panel);
  });
}

function scrollToHash(): void {
  const hash = window.location.hash;
  if (!hash) return;
  const target = document.querySelector<HTMLElement>(hash);
  if (target) {
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

window.addEventListener('hashchange', scrollToHash);

initPanels();
setTimeout(scrollToHash, 50);
