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

const PANEL_IDS = ['thin-lens', 'light-path', 'params', 'frustum', 'distortion', 'vac'];

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

/** Scroll-spy: highlight sidebar + header nav links for visible panel */
function initScrollSpy(): void {
  const sidebarLinks = document.querySelectorAll<HTMLAnchorElement>('.sidebar-nav a');
  const headerLinks = document.querySelectorAll<HTMLAnchorElement>('.site-nav a[href^="#"]');

  const setActive = (id: string) => {
    sidebarLinks.forEach((a) => {
      a.classList.toggle('active', a.getAttribute('data-sidebar') === id);
    });
    headerLinks.forEach((a) => {
      const href = a.getAttribute('href');
      a.classList.toggle('active', href === `#${id}`);
    });
  };

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setActive(entry.target.id);
        }
      }
    },
    { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
  );

  PANEL_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

window.addEventListener('hashchange', scrollToHash);

initPanels();
initScrollSpy();
setTimeout(scrollToHash, 50);
