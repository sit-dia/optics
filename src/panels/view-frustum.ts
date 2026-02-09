import { drawDashedLine, drawLabel } from '../canvas-utils';
import { COLORS, DEFAULT_HMD } from '../constants';
import { calcHMDOptics } from '../optics-math';
import type { Point } from '../types';
import { BasePanel } from '../ui-controls';

export class ViewFrustumPanel extends BasePanel {
  private ipdInput: HTMLInputElement;
  private nearInput: HTMLInputElement;
  private farInput: HTMLInputElement;
  private eyeReliefInput: HTMLInputElement;
  private calloutEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    super(container);
    this.ipdInput = this.addSlider({
      id: 'frustum-ipd',
      label: 'IPD (mm)',
      min: 52,
      max: 78,
      step: 1,
      value: 63,
      unit: 'mm',
    });
    this.nearInput = this.addSlider({
      id: 'frustum-near',
      label: 'Near Plane (m)',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      value: 0.06,
      unit: 'm',
    });
    this.farInput = this.addSlider({
      id: 'frustum-far',
      label: 'Far Plane (m)',
      min: 0.5,
      max: 100,
      step: 0.1,
      value: 1.56,
      unit: 'm',
    });
    this.eyeReliefInput = this.addSlider({
      id: 'frustum-eye-relief',
      label: 'Eye Relief (mm)',
      min: 8,
      max: 25,
      step: 1,
      value: 18,
      unit: 'mm',
    });

    this.addReadout({ id: 'frustum-left', label: 'Left Eye L/R', unit: 'm' });
    this.addReadout({ id: 'frustum-right', label: 'Right Eye L/R', unit: 'm' });
    this.addReadout({ id: 'frustum-v', label: 'Top/Bottom', unit: 'm' });

    this.calloutEl = document.createElement('div');
    this.calloutEl.className = 'callout';
    this.calloutEl.textContent =
      'Frustum culling removes objects outside the view; each eye needs a unique asymmetric projection matrix.';
    this.controlsEl.appendChild(this.calloutEl);
  }

  render(): void {
    this.clear();
    const ctx = this.ctx;
    ctx.fillStyle = '#0f1324';
    ctx.fillRect(0, 0, this.width, this.height);

    const ipdMm = Number(this.ipdInput.value);
    const nearM = Number(this.nearInput.value);
    const farM = Number(this.farInput.value);
    const eyeReliefMm = Number(this.eyeReliefInput.value);

    const optics = calcHMDOptics({
      ...DEFAULT_HMD,
      ipd: ipdMm / 1000,
      eyeRelief: eyeReliefMm / 1000,
    });

    const nearScale = nearM / optics.distEye2Display;
    const leftForLeftEye = optics.leftForLeftEye * nearScale;
    const rightForLeftEye = optics.rightForLeftEye * nearScale;
    const leftForRightEye = optics.leftForRightEye * nearScale;
    const rightForRightEye = optics.rightForRightEye * nearScale;
    const top = (nearM * optics.imgHeight) / (2 * optics.distEye2Img);
    const bottom = -top;

    this.setReadout(
      'frustum-left',
      `${leftForLeftEye.toFixed(3)}, ${rightForLeftEye.toFixed(3)}`
    );
    this.setReadout(
      'frustum-right',
      `${leftForRightEye.toFixed(3)}, ${rightForRightEye.toFixed(3)}`
    );
    this.setReadout('frustum-v', `${top.toFixed(3)}, ${bottom.toFixed(3)}`);

    const padding = 18;
    const gap = 24;
    const regionHeight = (this.height - padding * 2 - gap) / 2;
    const regionWidth = this.width - padding * 2;
    const regions = [
      { x: padding, y: padding, width: regionWidth, height: regionHeight },
      {
        x: padding,
        y: padding + regionHeight + gap,
        width: regionWidth,
        height: regionHeight,
      },
    ];

    const drawTopDown = (region: typeof regions[number]) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      const xMin = -200;
      const xMax = 200;
      const yMin = 0;
      const yMax = farM * 1000 * 1.1;
      const scaleX = region.width / (xMax - xMin);
      const scaleY = region.height / (yMax - yMin);
      const worldToCanvas = (x: number, y: number): Point => ({
        x: region.x + (x - xMin) * scaleX,
        y: region.y + region.height - (y - yMin) * scaleY,
      });

      const eyeLeftX = -ipdMm / 2;
      const eyeRightX = ipdMm / 2;
      const nearMm = nearM * 1000;
      const farMm = farM * 1000;
      const farScale = farM / nearM;

      const leftNearLeft = eyeLeftX + leftForLeftEye * 1000;
      const leftNearRight = eyeLeftX + rightForLeftEye * 1000;
      const leftFarLeft = eyeLeftX + leftForLeftEye * 1000 * farScale;
      const leftFarRight = eyeLeftX + rightForLeftEye * 1000 * farScale;

      const rightNearLeft = eyeRightX + leftForRightEye * 1000;
      const rightNearRight = eyeRightX + rightForRightEye * 1000;
      const rightFarLeft = eyeRightX + leftForRightEye * 1000 * farScale;
      const rightFarRight = eyeRightX + rightForRightEye * 1000 * farScale;

      const drawFrustum = (
        eyeX: number,
        nearLeft: number,
        nearRight: number,
        farLeft: number,
        farRight: number,
        color: string
      ) => {
        ctx.save();
        ctx.fillStyle = color;
        ctx.strokeStyle = color;
        ctx.beginPath();
        const eye = worldToCanvas(eyeX, 0);
        ctx.moveTo(eye.x, eye.y);
        const p1 = worldToCanvas(nearLeft, nearMm);
        const p2 = worldToCanvas(nearRight, nearMm);
        const p3 = worldToCanvas(farRight, farMm);
        const p4 = worldToCanvas(farLeft, farMm);
        ctx.lineTo(p1.x, p1.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.closePath();
        ctx.globalAlpha = 0.18;
        ctx.fill();
        ctx.globalAlpha = 0.8;
        ctx.stroke();
        ctx.restore();
      };

      drawFrustum(
        eyeLeftX,
        leftNearLeft,
        leftNearRight,
        leftFarLeft,
        leftFarRight,
        COLORS.rayLeft
      );
      drawFrustum(
        eyeRightX,
        rightNearLeft,
        rightNearRight,
        rightFarLeft,
        rightFarRight,
        COLORS.rayRight
      );

      const overlapNearLeft = Math.max(leftNearLeft, rightNearLeft);
      const overlapNearRight = Math.min(leftNearRight, rightNearRight);
      const overlapFarLeft = Math.max(leftFarLeft, rightFarLeft);
      const overlapFarRight = Math.min(leftFarRight, rightFarRight);
      if (overlapNearLeft < overlapNearRight) {
        ctx.save();
        ctx.fillStyle = COLORS.overlap;
        ctx.beginPath();
        const p1 = worldToCanvas(overlapNearLeft, nearMm);
        const p2 = worldToCanvas(overlapNearRight, nearMm);
        const p3 = worldToCanvas(overlapFarRight, farMm);
        const p4 = worldToCanvas(overlapFarLeft, farMm);
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.lineTo(p4.x, p4.y);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }

      const axisStart = worldToCanvas(xMin, 0);
      const axisEnd = worldToCanvas(xMax, 0);
      drawDashedLine(ctx, axisStart.x, axisStart.y, axisEnd.x, axisEnd.y, {
        color: COLORS.axis,
        dash: [5, 6],
      });
      drawLabel(ctx, 'Top-down frustum (horizontal)', region.x + 140, region.y + 18, {
        background: 'rgba(15, 52, 96, 0.4)',
      });

      ctx.restore();
    };

    const drawSideView = (region: typeof regions[number]) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      const xMin = -80;
      const xMax = 80;
      const yMin = 0;
      const yMax = farM * 1000 * 1.1;
      const scaleX = region.width / (xMax - xMin);
      const scaleY = region.height / (yMax - yMin);
      const worldToCanvas = (x: number, y: number): Point => ({
        x: region.x + (x - xMin) * scaleX,
        y: region.y + region.height - (y - yMin) * scaleY,
      });

      const nearMm = nearM * 1000;
      const farMm = farM * 1000;
      const farScale = farM / nearM;
      const topMm = top * 1000;
      const topFar = topMm * farScale;

      const points: Point[] = [
        { x: 0, y: 0 },
        { x: -topMm, y: nearMm },
        { x: -topFar, y: farMm },
        { x: topFar, y: farMm },
        { x: topMm, y: nearMm },
      ];
      ctx.save();
      ctx.strokeStyle = COLORS.rayGreen;
      ctx.globalAlpha = 0.8;
      ctx.beginPath();
      points.forEach((pt, idx) => {
        const canvasPt = worldToCanvas(pt.x, pt.y);
        if (idx === 0) {
          ctx.moveTo(canvasPt.x, canvasPt.y);
        } else {
          ctx.lineTo(canvasPt.x, canvasPt.y);
        }
      });
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      drawLabel(ctx, 'Side view (vertical symmetric)', region.x + 140, region.y + 18, {
        background: 'rgba(233, 69, 96, 0.25)',
      });

      ctx.restore();
    };

    drawTopDown(regions[0]);
    drawSideView(regions[1]);
  }
}
