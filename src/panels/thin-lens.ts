import {
  drawArrow,
  drawDashedLine,
  drawLabel,
  drawLens,
  drawRay,
} from '../canvas-utils';
import { COLORS } from '../constants';
import { imageDistance, imageType, magnification } from '../optics-math';
import type { Point } from '../types';
import { BasePanel } from '../ui-controls';

export class ThinLensPanel extends BasePanel {
  private fInput: HTMLInputElement;
  private doInput: HTMLInputElement;
  private calloutEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    super(container);
    this.fInput = this.addSlider({
      id: 'thin-lens-f',
      label: 'Focal Length (mm)',
      min: 10,
      max: 200,
      step: 1,
      value: 40,
      unit: 'mm',
    });
    this.doInput = this.addSlider({
      id: 'thin-lens-do',
      label: 'Object Distance (mm)',
      min: 5,
      max: 500,
      step: 1,
      value: 80,
      unit: 'mm',
    });
    this.addReadout({ id: 'thin-lens-di', label: 'Image Distance', unit: 'mm' });
    this.addReadout({ id: 'thin-lens-m', label: 'Magnification', unit: 'x' });
    this.addReadout({ id: 'thin-lens-eq', label: 'Lens Equation', unit: '' });

    this.calloutEl = document.createElement('div');
    this.calloutEl.className = 'callout';
    this.calloutEl.textContent =
      'This is how HMD lenses work — display closer than f creates a magnified virtual image.';
    this.controlsEl.appendChild(this.calloutEl);
  }

  render(): void {
    this.clear();
    const ctx = this.ctx;
    ctx.fillStyle = '#0f1324';
    ctx.fillRect(0, 0, this.width, this.height);

    const f = Number(this.fInput.value);
    const doDistance = Number(this.doInput.value);
    const diRaw = imageDistance(f, doDistance);
    const nearInfinity = Math.abs(doDistance - f) < 1;
    const di = nearInfinity ? Number.POSITIVE_INFINITY : diRaw;
    const imgType = nearInfinity ? 'infinity' : imageType(di);
    const mag = magnification(diRaw, doDistance);

    const diText = imgType === 'infinity' ? '∞' : diRaw.toFixed(0);
    const magText = Number.isFinite(mag) ? mag.toFixed(2) : '--';
    this.setReadout('thin-lens-di', diText);
    this.setReadout('thin-lens-m', magText);
    this.setReadout(
      'thin-lens-eq',
      `1/${f.toFixed(0)} = 1/${doDistance.toFixed(0)} + 1/${diText}`
    );

    this.calloutEl.style.display = doDistance < f ? 'block' : 'none';

    const padding = 24;
    const xMin = -220;
    const xMax = 220;
    const yMin = -120;
    const yMax = 120;
    const scaleX = (this.width - padding * 2) / (xMax - xMin);
    const scaleY = (this.height - padding * 2) / (yMax - yMin);

    const worldToCanvas = (x: number, y: number): Point => ({
      x: padding + (x - xMin) * scaleX,
      y: this.height - padding - (y - yMin) * scaleY,
    });

    const drawWorldRay = (points: Point[], dash?: number[], color?: string) => {
      drawRay(
        ctx,
        points.map((pt) => worldToCanvas(pt.x, pt.y)),
        {
          color: color ?? COLORS.rayLeft,
          dash,
        }
      );
    };

    const axisStart = worldToCanvas(xMin, 0);
    const axisEnd = worldToCanvas(xMax, 0);
    drawDashedLine(ctx, axisStart.x, axisStart.y, axisEnd.x, axisEnd.y, {
      color: COLORS.axis,
      dash: [6, 6],
    });

    const lensPos = worldToCanvas(0, 0);
    drawLens(ctx, lensPos.x, lensPos.y, 140, { color: COLORS.lens });

    const focalLeft = worldToCanvas(-f, 0);
    const focalRight = worldToCanvas(f, 0);
    drawLabel(ctx, 'F', focalLeft.x, focalLeft.y - 16, { color: COLORS.text });
    drawLabel(ctx, "F'", focalRight.x, focalRight.y - 16, { color: COLORS.text });
    drawDashedLine(ctx, focalLeft.x, focalLeft.y - 6, focalLeft.x, focalLeft.y + 6, {
      color: COLORS.axis,
      dash: [3, 4],
    });
    drawDashedLine(
      ctx,
      focalRight.x,
      focalRight.y - 6,
      focalRight.x,
      focalRight.y + 6,
      { color: COLORS.axis, dash: [3, 4] }
    );

    const objectHeight = 40;
    const objectBase = worldToCanvas(-doDistance, 0);
    const objectTip = worldToCanvas(-doDistance, objectHeight);
    drawArrow(ctx, objectBase.x, objectBase.y, objectTip.x, objectTip.y, {
      color: COLORS.accent,
      width: 2.5,
    });
    drawLabel(ctx, 'Object', objectTip.x, objectTip.y - 14, {
      background: 'rgba(233, 69, 96, 0.2)',
    });

    const lensWorld = { x: 0, y: 0 };
    const tipWorld = { x: -doDistance, y: objectHeight };
    const farX = xMax;

    if (imgType !== 'infinity') {
      const imageHeight = objectHeight * mag;
      const imageX = diRaw;
      const imageBase = worldToCanvas(imageX, 0);
      const imageTip = worldToCanvas(imageX, imageHeight);
      if (imgType === 'virtual') {
        drawDashedLine(
          ctx,
          imageBase.x,
          imageBase.y,
          imageTip.x,
          imageTip.y,
          { color: COLORS.virtualImage, dash: [6, 6], width: 2 }
        );
        drawArrow(ctx, imageBase.x, imageBase.y, imageTip.x, imageTip.y, {
          color: COLORS.virtualImage,
          width: 2,
          headSize: 6,
        });
      } else {
        drawArrow(ctx, imageBase.x, imageBase.y, imageTip.x, imageTip.y, {
          color: COLORS.rayGreen,
          width: 2.5,
        });
      }
      drawLabel(
        ctx,
        imgType === 'virtual' ? 'Virtual Image' : 'Real Image',
        imageTip.x,
        imageTip.y - 16,
        {
          background:
            imgType === 'virtual'
              ? 'rgba(168, 85, 247, 0.25)'
              : 'rgba(76, 175, 80, 0.2)',
        }
      );
    } else {
      drawLabel(ctx, 'Image at infinity', lensPos.x + 90, lensPos.y - 40, {
        background: 'rgba(255, 255, 255, 0.08)',
      });
    }

    if (imgType === 'infinity') {
      drawWorldRay(
        [
          { x: tipWorld.x, y: tipWorld.y },
          { x: lensWorld.x, y: tipWorld.y },
          { x: farX, y: tipWorld.y },
        ],
        undefined,
        COLORS.rayLeft
      );
      drawWorldRay(
        [
          { x: tipWorld.x, y: tipWorld.y },
          { x: lensWorld.x, y: 0 },
          { x: farX, y: (tipWorld.y / doDistance) * farX * -1 },
        ],
        undefined,
        COLORS.rayYellow
      );
      drawWorldRay(
        [
          { x: tipWorld.x, y: tipWorld.y },
          { x: 0, y: tipWorld.y },
          { x: farX, y: tipWorld.y },
        ],
        undefined,
        COLORS.rayGreen
      );
    } else {
      const slope1 = -tipWorld.y / f;
      const ray1End = { x: farX, y: tipWorld.y + slope1 * farX };
      drawWorldRay(
        [
          { x: tipWorld.x, y: tipWorld.y },
          { x: 0, y: tipWorld.y },
          { x: ray1End.x, y: ray1End.y },
        ],
        undefined,
        COLORS.rayLeft
      );

      const slope2 = (lensWorld.y - tipWorld.y) / (lensWorld.x - tipWorld.x);
      const ray2End = { x: farX, y: lensWorld.y + slope2 * farX };
      drawWorldRay(
        [
          { x: tipWorld.x, y: tipWorld.y },
          { x: lensWorld.x, y: lensWorld.y },
          { x: ray2End.x, y: ray2End.y },
        ],
        undefined,
        COLORS.rayYellow
      );

      const slope3 = (0 - tipWorld.y) / (-f - tipWorld.x);
      const yAtLens = tipWorld.y + slope3 * (0 - tipWorld.x);
      const ray3End = { x: farX, y: yAtLens };
      drawWorldRay(
        [
          { x: tipWorld.x, y: tipWorld.y },
          { x: 0, y: yAtLens },
          { x: ray3End.x, y: ray3End.y },
        ],
        undefined,
        COLORS.rayGreen
      );

      if (imgType === 'virtual') {
        const imagePoint = { x: diRaw, y: objectHeight * mag };
        drawWorldRay([
          { x: 0, y: tipWorld.y },
          imagePoint,
        ], [6, 6], COLORS.virtualImage);
        drawWorldRay([
          { x: 0, y: lensWorld.y },
          imagePoint,
        ], [6, 6], COLORS.virtualImage);
        drawWorldRay([
          { x: 0, y: yAtLens },
          imagePoint,
        ], [6, 6], COLORS.virtualImage);
      }
    }

    const regimeText =
      imgType === 'infinity'
        ? 'Object at f → image at infinity'
        : doDistance < f
        ? 'HMD regime: virtual image'
        : 'Projector regime: real image';
    drawLabel(ctx, regimeText, lensPos.x, lensPos.y + 90, {
      background:
        doDistance < f
          ? 'rgba(233, 69, 96, 0.2)'
          : 'rgba(255, 255, 255, 0.08)',
    });
  }
}
