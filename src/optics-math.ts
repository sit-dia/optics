import type { HMDCalculated, HMDParams } from './types';

export function imageDistance(f: number, doDistance: number): number {
  return 1 / (1 / f - 1 / doDistance);
}

export function magnification(di: number, doDistance: number): number {
  return -di / doDistance;
}

export function hmdMagnification(f: number, doDistance: number): number {
  return f / (f - doDistance);
}

export function imageType(di: number): 'real' | 'virtual' | 'infinity' {
  if (!Number.isFinite(di)) {
    return 'infinity';
  }

  if (Math.abs(di) > 1e6) {
    return 'infinity';
  }

  return di > 0 ? 'real' : 'virtual';
}

const RAD_TO_DEG = 180 / Math.PI;

export function calcHMDOptics(params: HMDParams): HMDCalculated {
  const { f, distLens2Display, eyeRelief, ipd, displayWidth, displayHeight } =
    params;
  const magnificationValue = f / (f - distLens2Display);
  const distLens2Img = Math.abs(1 / (1 / f - 1 / distLens2Display));
  const distEye2Img = distLens2Img + eyeRelief;
  const distEye2Display = eyeRelief + distLens2Display;
  const imgHeight = displayHeight * magnificationValue;
  const fovVertical = 2 * Math.atan(imgHeight / 2 / distEye2Img) * RAD_TO_DEG;
  const fovHNasal =
    Math.atan((magnificationValue * ipd / 2) / distEye2Img) * RAD_TO_DEG;
  const fovHTemporal =
    Math.atan(
      (magnificationValue * (displayWidth - ipd) / 2) / distEye2Img
    ) * RAD_TO_DEG;
  const fovHorizontal = fovHNasal + fovHTemporal;
  const near = eyeRelief + distLens2Display;
  const top = (near * imgHeight) / (2 * distEye2Img);
  const bottom = -top;
  const imgWidthNasal = (magnificationValue * ipd) / 2;
  const imgWidthTemporal = (magnificationValue * (displayWidth - ipd)) / 2;
  const rightForLeftEye = (distEye2Display * imgWidthNasal) / distEye2Img;
  const leftForLeftEye =
    -(distEye2Display * imgWidthTemporal) / distEye2Img;
  const rightForRightEye =
    (distEye2Display * imgWidthTemporal) / distEye2Img;
  const leftForRightEye =
    -(distEye2Display * imgWidthNasal) / distEye2Img;

  return {
    distEye2Display,
    magnification: magnificationValue,
    imgHeight,
    distLens2Img,
    distEye2Img,
    near,
    fovVertical,
    fovHNasal,
    fovHTemporal,
    fovHorizontal,
    top,
    bottom,
    imgWidthNasal,
    imgWidthTemporal,
    leftForLeftEye,
    rightForLeftEye,
    leftForRightEye,
    rightForRightEye,
  };
}

export function applyDistortion(
  x: number,
  y: number,
  cx: number,
  cy: number,
  k1: number,
  k2: number
): { x: number; y: number } {
  const dx = x - cx;
  const dy = y - cy;
  const r2 = dx * dx + dy * dy;
  const factor = 1 + k1 * r2 + k2 * r2 * r2;
  return { x: cx + dx * factor, y: cy + dy * factor };
}

export function toDiopters(distanceM: number): number {
  return 1 / distanceM;
}

export function vacMismatch(
  accommodationDistM: number,
  vergenceDistM: number
): number {
  return Math.abs(toDiopters(accommodationDistM) - toDiopters(vergenceDistM));
}
