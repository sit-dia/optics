export interface Point {
  x: number;
  y: number;
}

export interface ArrowOpts {
  color?: string;
  width?: number;
  headSize?: number;
}

export interface LineOpts {
  color?: string;
  width?: number;
  dash?: number[];
}

export interface RayOpts extends LineOpts {
  glow?: boolean;
}

export interface LensOpts {
  color?: string;
  width?: number;
}

export interface LabelOpts {
  color?: string;
  background?: string;
  padding?: number;
  font?: string;
}

export interface HMDParams {
  f: number;
  distLens2Display: number;
  eyeRelief: number;
  ipd: number;
  displayWidth: number;
  displayHeight: number;
}

export interface HMDCalculated {
  distEye2Display: number;
  magnification: number;
  imgHeight: number;
  distLens2Img: number;
  distEye2Img: number;
  near: number;
  fovVertical: number;
  fovHNasal: number;
  fovHTemporal: number;
  fovHorizontal: number;
  top: number;
  bottom: number;
  imgWidthNasal: number;
  imgWidthTemporal: number;
  leftForLeftEye: number;
  rightForLeftEye: number;
  leftForRightEye: number;
  rightForRightEye: number;
}
