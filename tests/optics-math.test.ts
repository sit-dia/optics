import { describe, expect, it } from 'vitest';
import { DEFAULT_HMD } from '../src/constants';
import { calcHMDOptics } from '../src/optics-math';

describe('calcHMDOptics', () => {
  it('matches Cardboard V2 magnification and FOV values', () => {
    const result = calcHMDOptics(DEFAULT_HMD);
    expect(result.magnification).toBeCloseTo(43, 6);
    expect(result.fovVertical).toBeCloseTo(77.4268, 3);
    expect(result.fovHNasal).toBeCloseTo(37.4584, 3);
    expect(result.fovHTemporal).toBeCloseTo(33.4095, 3);
    expect(result.fovHorizontal).toBeCloseTo(70.8679, 3);
  });
});
