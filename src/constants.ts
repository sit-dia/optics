import type { HMDParams } from './types';

// Google Cardboard V2 defaults (matching HMD simulator)
export const DEFAULT_HMD: HMDParams = {
  f: 0.043,
  distLens2Display: 0.042,
  eyeRelief: 0.018,
  ipd: 0.065,
  displayWidth: 0.12096,
  displayHeight: 0.068,
};

export const DEFAULT_DISTORTION = { k1: 0.34, k2: 0.55 };

export const COLORS = {
  background: '#1a1a2e',
  panel: '#16213e',
  accent: '#e94560',
  accentBlue: '#0f3460',
  text: '#eaeaea',
  textDim: '#888888',
  rayLeft: '#4da6ff',
  rayRight: '#ff6b6b',
  rayGreen: '#4caf50',
  rayYellow: '#ffc107',
  virtualImage: '#a855f7',
  overlap: 'rgba(128, 0, 255, 0.15)',
  grid: '#444444',
  lens: '#ffd700',
  display: '#b39ddb',
  axis: '#555555',
};

export const VAC_COMFORT = 0.3;
export const VAC_MILD = 0.5;
