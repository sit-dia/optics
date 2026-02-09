import {
  drawArrow,
  drawDashedLine,
  drawLabel,
  drawLens,
  drawRay,
  drawEye,
  drawDisplay,
} from '../canvas-utils';
import { COLORS } from '../constants';
import { imageDistance, imageType } from '../optics-math';
import type { Point } from '../types';
import { BasePanel } from '../ui-controls';

export class LightPathPanel extends BasePanel {
  private fInput: HTMLInputElement;
  private doInput: HTMLInputElement;
  private calloutEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    super(container);
    this.fInput = this.addSlider({
      id: 'light-path-f',
      label: 'Focal Length (mm)',
      min: 20,
      max: 100,
      step: 1,
      value: 43,
      unit: 'mm',
    });
    this.doInput = this.addSlider({
      id: 'light-path-do',
      label: 'Object Distance (mm)',
      min: 10,
      max: 120,
      step: 1,
      value: 42,
      unit: 'mm',
    });
    this.addReadout({ id: 'light-path-di', label: 'Image Distance', unit: 'mm' });
    this.addReadout({ id: 'light-path-regime', label: 'Regime', unit: '' });

    this.calloutEl = document.createElement('div');
    this.calloutEl.className = 'callout';
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

    const diText = imgType === 'infinity' ? '∞' : diRaw.toFixed(0);
    this.setReadout('light-path-di', diText);
    this.setReadout(
      'light-path-regime',
      doDistance < f ? 'HMD (virtual image)' : 'Projection (real image)'
    );

    this.calloutEl.textContent =
      doDistance < f
        ? 'Display inside focal length → virtual, magnified image (HMD regime).'
        : 'Object beyond focal length → real inverted image (projection regime).';

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

    const drawDiagram = (
      region: { x: number; y: number; width: number; height: number },
      type: 'projection' | 'hmd'
    ) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      const xMin = -130;
      const xMax = 170;
      const yMin = -80;
      const yMax = 80;
      const scaleX = region.width / (xMax - xMin);
      const scaleY = region.height / (yMax - yMin);
      const worldToCanvas = (x: number, y: number): Point => ({
        x: region.x + (x - xMin) * scaleX,
        y: region.y + region.height - (y - yMin) * scaleY,
      });
      const drawWorldRay = (points: Point[], dash?: number[], color?: string) => {
        drawRay(
          ctx,
          points.map((pt) => worldToCanvas(pt.x, pt.y)),
          { color: color ?? COLORS.rayLeft, dash }
        );
      };

      const axisStart = worldToCanvas(xMin, 0);
      const axisEnd = worldToCanvas(xMax, 0);
      drawDashedLine(ctx, axisStart.x, axisStart.y, axisEnd.x, axisEnd.y, {
        color: COLORS.axis,
        dash: [6, 6],
      });

      const lensPos = worldToCanvas(0, 0);
      drawLens(ctx, lensPos.x, lensPos.y, 100, { color: COLORS.lens });

      if (type === 'projection') {
        const objectHeight = 28;
        const objectBase = worldToCanvas(-doDistance, 0);
        const objectTip = worldToCanvas(-doDistance, objectHeight);
        drawArrow(ctx, objectBase.x, objectBase.y, objectTip.x, objectTip.y, {
          color: COLORS.accent,
        });
        drawLabel(ctx, 'Light source', objectTip.x, objectTip.y - 12, {
          background: 'rgba(233, 69, 96, 0.2)',
        });

        if (imgType === 'real') {
          const imageHeight = -objectHeight * (diRaw / doDistance);
          const imageBase = worldToCanvas(diRaw, 0);
          const imageTip = worldToCanvas(diRaw, imageHeight);
          drawArrow(ctx, imageBase.x, imageBase.y, imageTip.x, imageTip.y, {
            color: COLORS.rayGreen,
          });
          drawDisplay(
            ctx,
            imageBase.x - 6,
            imageBase.y - 40,
            12,
            80
          );
          drawLabel(ctx, 'Screen', imageBase.x + 26, imageBase.y - 30, {
            background: 'rgba(179, 157, 219, 0.2)',
          });
        } else {
          drawLabel(ctx, 'No real focus', lensPos.x + 60, lensPos.y - 40, {
            background: 'rgba(255, 255, 255, 0.08)',
          });
        }

        const tipWorld = { x: -doDistance, y: objectHeight };
        const slope1 = -tipWorld.y / f;
        const ray1End = { x: xMax, y: tipWorld.y + slope1 * xMax };
        drawWorldRay(
          [
            { x: tipWorld.x, y: tipWorld.y },
            { x: 0, y: tipWorld.y },
            ray1End,
          ],
          undefined,
          COLORS.rayLeft
        );
        const slope2 = (0 - tipWorld.y) / (0 - tipWorld.x);
        const ray2End = { x: xMax, y: slope2 * xMax };
        drawWorldRay(
          [
            { x: tipWorld.x, y: tipWorld.y },
            { x: 0, y: 0 },
            ray2End,
          ],
          undefined,
          COLORS.rayYellow
        );

        if (imgType === 'virtual') {
          drawWorldRay(
            [
              { x: 0, y: tipWorld.y },
              { x: diRaw, y: tipWorld.y * (-diRaw / doDistance) },
            ],
            [6, 6],
            COLORS.virtualImage
          );
        }

        drawLabel(
          ctx,
          'Projection path',
          region.x + 80,
          region.y + 18,
          { background: 'rgba(15, 52, 96, 0.4)' }
        );
      } else {
        const displayHeight = 30;
        const display = worldToCanvas(-doDistance, 0);
        drawDisplay(
          ctx,
          display.x - 8,
          display.y - displayHeight,
          16,
          displayHeight * 2
        );
        drawLabel(ctx, 'Display', display.x - 32, display.y - 38, {
          background: 'rgba(179, 157, 219, 0.2)',
        });

        const eyePos = worldToCanvas(90, 0);
        drawEye(ctx, eyePos.x, eyePos.y, 16, 0);
        drawLabel(ctx, 'Eye', eyePos.x + 28, eyePos.y - 16, {
          background: 'rgba(255, 255, 255, 0.08)',
        });

        const tipWorldTop = { x: -doDistance, y: displayHeight };
        const tipWorldBottom = { x: -doDistance, y: -displayHeight };
        const eyeWorld = { x: 90, y: 0 };

        drawWorldRay(
          [
            { x: tipWorldTop.x, y: tipWorldTop.y },
            { x: 0, y: tipWorldTop.y },
            { x: eyeWorld.x, y: tipWorldTop.y * 0.3 },
          ],
          undefined,
          COLORS.rayLeft
        );
        drawWorldRay(
          [
            { x: tipWorldBottom.x, y: tipWorldBottom.y },
            { x: 0, y: tipWorldBottom.y },
            { x: eyeWorld.x, y: tipWorldBottom.y * 0.3 },
          ],
          undefined,
          COLORS.rayGreen
        );

        if (imgType === 'virtual') {
          const imagePoint = { x: diRaw, y: 0 };
          drawWorldRay([
            { x: 0, y: tipWorldTop.y },
            imagePoint,
          ], [6, 6], COLORS.virtualImage);
          drawWorldRay([
            { x: 0, y: tipWorldBottom.y },
            imagePoint,
          ], [6, 6], COLORS.virtualImage);
          drawLabel(ctx, 'Virtual image', worldToCanvas(diRaw, 0).x - 10, region.y + 24, {
            background: 'rgba(168, 85, 247, 0.25)',
          });
        }

        drawLabel(
          ctx,
          'HMD path',
          region.x + 60,
          region.y + 18,
          { background: 'rgba(233, 69, 96, 0.25)' }
        );
      }

      ctx.restore();
    };

    drawDiagram(regions[0], 'projection');
    drawDiagram(regions[1], 'hmd');
  }
}
