import {
  drawDashedLine,
  drawDimension,
  drawDisplay,
  drawEye,
  drawLabel,
  drawLens,
  drawRay,
} from '../canvas-utils';
import { COLORS, DEFAULT_HMD } from '../constants';
import { calcHMDOptics } from '../optics-math';
import type { Point } from '../types';
import { BasePanel } from '../ui-controls';

export class KeyParamsPanel extends BasePanel {
  private ipdInput: HTMLInputElement;
  private eyeReliefInput: HTMLInputElement;
  private fInput: HTMLInputElement;
  private doInput: HTMLInputElement;
  private fovToggle: HTMLInputElement;
  private warningEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    super(container);
    this.ipdInput = this.addSlider({
      id: 'params-ipd',
      label: 'IPD (mm)',
      min: 52,
      max: 78,
      step: 1,
      value: 63,
      unit: 'mm',
    });
    this.eyeReliefInput = this.addSlider({
      id: 'params-eye-relief',
      label: 'Eye Relief (mm)',
      min: 8,
      max: 25,
      step: 1,
      value: 18,
      unit: 'mm',
    });
    this.fInput = this.addSlider({
      id: 'params-f',
      label: 'Focal Length (mm)',
      min: 30,
      max: 60,
      step: 1,
      value: 43,
      unit: 'mm',
    });
    this.doInput = this.addSlider({
      id: 'params-do',
      label: 'Lens to Display (mm)',
      min: 30,
      max: 55,
      step: 1,
      value: 42,
      unit: 'mm',
    });

    const toggleRow = document.createElement('div');
    toggleRow.className = 'control-row';
    const toggleLabel = document.createElement('label');
    toggleLabel.htmlFor = 'params-fov-toggle';
    toggleLabel.textContent = 'Show FOV breakdown';
    this.fovToggle = document.createElement('input');
    this.fovToggle.id = 'params-fov-toggle';
    this.fovToggle.name = 'params-fov-toggle';
    this.fovToggle.type = 'checkbox';
    this.fovToggle.checked = true;
    this.fovToggle.addEventListener('change', () => this.requestDraw());
    toggleRow.appendChild(toggleLabel);
    toggleRow.appendChild(this.fovToggle);
    this.controlsEl.appendChild(toggleRow);

    this.addReadout({ id: 'params-mag', label: 'Magnification', unit: 'x' });
    this.addReadout({ id: 'params-img', label: 'Virtual Image Dist', unit: 'mm' });
    this.addReadout({ id: 'params-eye-img', label: 'Eye-to-Image', unit: 'mm' });
    this.addReadout({ id: 'params-fov-v', label: 'FOV Vertical', unit: 'deg' });
    this.addReadout({ id: 'params-fov-nasal', label: 'FOV H-Nasal', unit: 'deg' });
    this.addReadout({
      id: 'params-fov-temporal',
      label: 'FOV H-Temporal',
      unit: 'deg',
    });
    this.addReadout({ id: 'params-fov', label: 'FOV H-Total', unit: 'deg' });
    this.addReadout({ id: 'params-near', label: 'Near Plane', unit: 'mm' });

    this.warningEl = document.createElement('div');
    this.warningEl.className = 'callout';
    this.warningEl.textContent = 'Extreme IPD values can reduce comfort.';
    this.controlsEl.appendChild(this.warningEl);
  }

  render(): void {
    this.clear();
    const ctx = this.ctx;
    ctx.fillStyle = '#0f1324';
    ctx.fillRect(0, 0, this.width, this.height);

    const ipdMm = Number(this.ipdInput.value);
    const eyeReliefMm = Number(this.eyeReliefInput.value);
    const fMm = Number(this.fInput.value);
    const doMm = Number(this.doInput.value);

    const optics = calcHMDOptics({
      ...DEFAULT_HMD,
      ipd: ipdMm / 1000,
      eyeRelief: eyeReliefMm / 1000,
      f: fMm / 1000,
      distLens2Display: doMm / 1000,
    });

    this.setReadout('params-mag', optics.magnification.toFixed(2));
    this.setReadout('params-img', (optics.distLens2Img * 1000).toFixed(0));
    this.setReadout('params-eye-img', (optics.distEye2Img * 1000).toFixed(0));
    this.setReadout('params-fov-v', optics.fovVertical.toFixed(1));
    this.setReadout('params-fov-nasal', optics.fovHNasal.toFixed(1));
    this.setReadout('params-fov-temporal', optics.fovHTemporal.toFixed(1));
    this.setReadout('params-fov', optics.fovHorizontal.toFixed(1));
    this.setReadout('params-near', (optics.near * 1000).toFixed(0));

    const showWarning = ipdMm < 56 || ipdMm > 72;
    this.warningEl.style.display = showWarning ? 'block' : 'none';

    const padding = 20;
    const xMin = -120;
    const xMax = 120;
    const yMin = -140;
    const yMax = 80;
    const scaleX = (this.width - padding * 2) / (xMax - xMin);
    const scaleY = (this.height - padding * 2) / (yMax - yMin);
    const worldToCanvas = (x: number, y: number): Point => ({
      x: padding + (x - xMin) * scaleX,
      y: this.height - padding - (y - yMin) * scaleY,
    });
    const drawWorldRay = (points: Point[], color: string, dash?: number[]) => {
      drawRay(
        ctx,
        points.map((pt) => worldToCanvas(pt.x, pt.y)),
        { color, dash }
      );
    };

    const displayWidthMm = DEFAULT_HMD.displayWidth * 1000;
    const displayHeightMm = 14;
    const displayY = -doMm;
    const eyeY = eyeReliefMm;
    const lensY = 0;

    const displayTopLeft = worldToCanvas(-displayWidthMm / 2, displayY + displayHeightMm / 2);
    drawDisplay(
      ctx,
      displayTopLeft.x,
      displayTopLeft.y,
      displayWidthMm * scaleX,
      displayHeightMm * scaleY
    );
    drawLabel(ctx, 'Display', displayTopLeft.x + 42, displayTopLeft.y - 12, {
      background: 'rgba(179, 157, 219, 0.2)',
    });

    const leftEyeX = -ipdMm / 2;
    const rightEyeX = ipdMm / 2;
    const leftEye = worldToCanvas(leftEyeX, eyeY);
    const rightEye = worldToCanvas(rightEyeX, eyeY);
    drawEye(ctx, leftEye.x, leftEye.y, 12, 0);
    drawEye(ctx, rightEye.x, rightEye.y, 12, 0);

    const leftLens = worldToCanvas(leftEyeX, lensY);
    const rightLens = worldToCanvas(rightEyeX, lensY);
    drawLens(ctx, leftLens.x, leftLens.y, 32, { color: COLORS.lens });
    drawLens(ctx, rightLens.x, rightLens.y, 32, { color: COLORS.lens });

    const virtualY = eyeReliefMm + optics.distLens2Img * 1000;
    const virtualWidth = optics.magnification * DEFAULT_HMD.displayWidth * 1000;
    const virtualTopLeft = worldToCanvas(-virtualWidth / 2, virtualY + 8);
    drawDashedLine(
      ctx,
      virtualTopLeft.x,
      virtualTopLeft.y,
      virtualTopLeft.x + virtualWidth * scaleX,
      virtualTopLeft.y,
      { color: COLORS.virtualImage, dash: [6, 6], width: 1.5 }
    );
    drawLabel(ctx, 'Virtual image', virtualTopLeft.x + 50, virtualTopLeft.y - 14, {
      background: 'rgba(168, 85, 247, 0.25)',
    });

    const imgNasalMm = optics.imgWidthNasal * 1000;
    const imgTemporalMm = optics.imgWidthTemporal * 1000;
    const leftNasal = { x: leftEyeX + imgNasalMm, y: virtualY };
    const leftTemporal = { x: leftEyeX - imgTemporalMm, y: virtualY };
    const rightNasal = { x: rightEyeX - imgNasalMm, y: virtualY };
    const rightTemporal = { x: rightEyeX + imgTemporalMm, y: virtualY };

    drawWorldRay(
      [
        { x: leftEyeX, y: eyeY },
        { x: leftNasal.x, y: leftNasal.y },
      ],
      COLORS.rayLeft
    );
    drawWorldRay(
      [
        { x: leftEyeX, y: eyeY },
        { x: leftTemporal.x, y: leftTemporal.y },
      ],
      COLORS.rayLeft
    );
    drawWorldRay(
      [
        { x: rightEyeX, y: eyeY },
        { x: rightNasal.x, y: rightNasal.y },
      ],
      COLORS.rayRight
    );
    drawWorldRay(
      [
        { x: rightEyeX, y: eyeY },
        { x: rightTemporal.x, y: rightTemporal.y },
      ],
      COLORS.rayRight
    );

    if (this.fovToggle.checked) {
      if (leftNasal.x < rightNasal.x) {
        const leftEyeCanvas = worldToCanvas(leftEyeX, eyeY);
        const rightEyeCanvas = worldToCanvas(rightEyeX, eyeY);
        const leftNasalCanvas = worldToCanvas(leftNasal.x, leftNasal.y);
        const rightNasalCanvas = worldToCanvas(rightNasal.x, rightNasal.y);
        ctx.save();
        ctx.fillStyle = COLORS.overlap;
        ctx.beginPath();
        ctx.moveTo(leftEyeCanvas.x, leftEyeCanvas.y);
        ctx.lineTo(rightEyeCanvas.x, rightEyeCanvas.y);
        ctx.lineTo(rightNasalCanvas.x, rightNasalCanvas.y);
        ctx.lineTo(leftNasalCanvas.x, leftNasalCanvas.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      drawLabel(
        ctx,
        'Nasal',
        worldToCanvas(leftNasal.x, leftNasal.y).x + 12,
        worldToCanvas(leftNasal.x, leftNasal.y).y - 12,
        { background: 'rgba(255, 255, 255, 0.08)' }
      );
      drawLabel(
        ctx,
        'Temporal',
        worldToCanvas(leftTemporal.x, leftTemporal.y).x - 12,
        worldToCanvas(leftTemporal.x, leftTemporal.y).y - 12,
        { background: 'rgba(255, 255, 255, 0.08)' }
      );
    }

    drawDimension(
      ctx,
      worldToCanvas(leftEyeX, eyeY).x,
      worldToCanvas(leftEyeX, eyeY).y + 22,
      worldToCanvas(rightEyeX, eyeY).x,
      worldToCanvas(rightEyeX, eyeY).y + 22,
      `IPD ${ipdMm.toFixed(0)}mm`,
      10
    );

    drawDimension(
      ctx,
      worldToCanvas(rightEyeX + 18, lensY).x,
      worldToCanvas(rightEyeX + 18, lensY).y,
      worldToCanvas(rightEyeX + 18, eyeY).x,
      worldToCanvas(rightEyeX + 18, eyeY).y,
      `Eye relief ${eyeReliefMm.toFixed(0)}mm`,
      8
    );

    drawLabel(ctx, 'Top-down HMD cross-section', worldToCanvas(0, yMax - 10).x, 28, {
      background: 'rgba(15, 52, 96, 0.4)',
    });
  }
}
