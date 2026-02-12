import {
  drawArrow,
  drawDashedLine,
  drawDisplay,
  drawEye,
  drawHMD,
  drawLabel,
  drawLens,
  drawProjector,
  drawRay,
} from '../canvas-utils';
import { COLORS } from '../constants';
import { imageDistance, imageType, magnification } from '../optics-math';
import type { Point } from '../types';
import { BasePanel } from '../ui-controls';

export class ThinLensPanel extends BasePanel {
  private fInput: HTMLInputElement;
  private doInput: HTMLInputElement;

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
      label: 'Lens-to-Display Distance (mm)',
      min: 5,
      max: 500,
      step: 1,
      value: 100,
      unit: 'mm',
    });
    this.addReadout({ id: 'thin-lens-di', label: 'Image Distance', unit: 'mm' });
    this.addReadout({ id: 'thin-lens-m', label: 'Magnification', unit: 'x' });
    this.addReadout({ id: 'thin-lens-regime', label: 'Regime', unit: '' });
  }

  render(): void {
    this.clear();
    const ctx = this.ctx;
    ctx.fillStyle = '#111122';
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

    const regimeText =
      imgType === 'infinity'
        ? 'At focal point'
        : doDistance < f
          ? 'HMD (virtual image)'
          : 'Projector (real image)';
    this.setReadout('thin-lens-regime', regimeText);

    const padding = 24;
    const xMin = -280;
    const xMax = 280;
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

    // --- Background: optical axis ---
    const axisStart = worldToCanvas(xMin, 0);
    const axisEnd = worldToCanvas(xMax, 0);
    drawDashedLine(ctx, axisStart.x, axisStart.y, axisEnd.x, axisEnd.y, {
      color: COLORS.axis,
      dash: [6, 6],
    });

    // --- Light direction arrow across top ---
    const arrowLeft = worldToCanvas(xMin + 20, yMax - 14);
    const arrowRight = worldToCanvas(xMax - 20, yMax - 14);
    drawArrow(ctx, arrowLeft.x, arrowLeft.y, arrowRight.x, arrowRight.y, {
      color: 'rgba(255,255,255,0.18)',
      width: 1.5,
      headSize: 8,
    });
    drawLabel(ctx, 'light direction →', (arrowLeft.x + arrowRight.x) / 2, arrowLeft.y - 10, {
      color: 'rgba(255,255,255,0.35)',
      background: 'transparent',
    });

    // --- Device outlines (drawn early so rays overlay) ---
    const lensPos = worldToCanvas(0, 0);
    const eyeWorldX = 60;
    const displayHalfH = 50;

    if (doDistance > f && !nearInfinity) {
      // Projector outline: trapezoid on left side around display→lens
      const pLeft = worldToCanvas(-doDistance - 20, 0);
      const pRight = worldToCanvas(0, 0);
      const bodyW = pRight.x - pLeft.x;
      const wideEnd = displayHalfH * 2 * scaleY + 30;
      const narrowEnd = 140 + 10; // lens height + margin
      drawProjector(ctx, pLeft.x, lensPos.y, wideEnd, narrowEnd, bodyW);
      drawLabel(ctx, 'PROJECTOR', pLeft.x + bodyW / 2, lensPos.y - displayHalfH * scaleY - 28, {
        color: '#4da6ff',
        background: 'rgba(77,166,255,0.18)',
      });
    } else if (doDistance < f) {
      // HMD outline: goggles encompassing display+lens+eye on right
      const hmdLeft = worldToCanvas(-doDistance - 20, displayHalfH + 20);
      const hmdRight = worldToCanvas(eyeWorldX + 30, -(displayHalfH + 20));
      const hmdW = hmdRight.x - hmdLeft.x;
      const hmdH = hmdRight.y - hmdLeft.y; // canvas y is inverted
      drawHMD(ctx, hmdLeft.x, hmdLeft.y, hmdW, hmdH);
      drawLabel(ctx, 'HMD', (hmdLeft.x + hmdRight.x) / 2, hmdLeft.y - 12, {
        color: '#e94560',
        background: 'rgba(233,69,96,0.18)',
      });
    }

    // --- Lens centre vertical line (full canvas height, faint yellow) ---
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 215, 0, 0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(lensPos.x, 0);
    ctx.lineTo(lensPos.x, this.height);
    ctx.stroke();
    ctx.restore();

    // --- Lens ---
    drawLens(ctx, lensPos.x, lensPos.y, 140, { color: COLORS.lens });

    // --- Focal points: solid tick marks + small italic labels ---
    const focalLeft = worldToCanvas(-f, 0);
    const focalRight = worldToCanvas(f, 0);
    const focalTickHalf = 10;
    const focalFont = 'italic 11px "Space Grotesk", system-ui, sans-serif';
    // Solid tick marks
    ctx.save();
    ctx.strokeStyle = COLORS.lens;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(focalLeft.x, focalLeft.y - focalTickHalf);
    ctx.lineTo(focalLeft.x, focalLeft.y + focalTickHalf);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(focalRight.x, focalRight.y - focalTickHalf);
    ctx.lineTo(focalRight.x, focalRight.y + focalTickHalf);
    ctx.stroke();
    ctx.restore();
    // Labels
    drawLabel(ctx, 'f', focalLeft.x, focalLeft.y - focalTickHalf - 10, {
      color: COLORS.lens,
      font: focalFont,
      background: 'rgba(0,0,0,0.5)',
    });
    drawLabel(ctx, "f\u2032", focalRight.x, focalRight.y - focalTickHalf - 10, {
      color: COLORS.lens,
      font: focalFont,
      background: 'rgba(0,0,0,0.5)',
    });

    // --- Display rectangle at object position ---
    const displayTop = worldToCanvas(-doDistance, displayHalfH);
    const displayBot = worldToCanvas(-doDistance, -displayHalfH);
    const dispW = 6;
    drawDisplay(ctx, displayTop.x - dispW / 2, displayTop.y, dispW, displayBot.y - displayTop.y);
    drawLabel(ctx, 'Display', displayTop.x, displayTop.y - 14, {
      background: 'rgba(179, 157, 219, 0.25)',
    });

    // --- Object arrow (light-emitting point on display) ---
    const objectHeight = 40;
    const objectBase = worldToCanvas(-doDistance, 0);
    const objectTip = worldToCanvas(-doDistance, objectHeight);
    drawArrow(ctx, objectBase.x, objectBase.y, objectTip.x, objectTip.y, {
      color: COLORS.accent,
      width: 2.5,
    });

    // --- Image ---
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
      drawLabel(ctx, 'Image at ∞', lensPos.x + 90, lensPos.y - 40, {
        background: 'rgba(255, 255, 255, 0.08)',
      });
    }

    // --- Principal rays ---
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

    // --- Eye (always on right) ---
    // Projector: eye looks right toward real image; HMD: eye looks left into lens
    const eyePos = worldToCanvas(eyeWorldX, 0);
    const eyeRotation = doDistance < f ? Math.PI : 0;
    drawEye(ctx, eyePos.x, eyePos.y, 14, eyeRotation);
    drawLabel(ctx, 'Eye', eyePos.x, eyePos.y - 22, {
      color: COLORS.text,
      background: 'rgba(255,255,255,0.08)',
    });

    // --- Regime label ---
    const regimeLabel =
      imgType === 'infinity'
        ? 'd_o = f → image at ∞'
        : doDistance < f
          ? 'HMD regime: d_o < f → virtual image'
          : 'Projector regime: d_o > f → real image';
    drawLabel(ctx, regimeLabel, lensPos.x, lensPos.y + 90, {
      background:
        doDistance < f
          ? 'rgba(233, 69, 96, 0.2)'
          : doDistance > f
            ? 'rgba(77,166,255,0.15)'
            : 'rgba(255, 255, 255, 0.08)',
    });

    // --- Equation on-canvas at bottom ---
    const eqText = `1/f = 1/d_o + 1/d_i  →  1/${f} = 1/${doDistance} + 1/${diText}`;
    drawLabel(ctx, eqText, this.width / 2, this.height - 16, {
      color: 'rgba(255,255,255,0.6)',
      background: 'rgba(0,0,0,0.5)',
      font: '11px "Space Grotesk", system-ui, sans-serif',
    });
  }
}
