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

    const diText = imgType === 'infinity' ? '\u221e' : diRaw.toFixed(0);
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

    const objectHeight = 40;
    const eyeWorldX = 60;
    const displayHalfH = 50;

    // --- Compute all ray intersection y-values at the lens (x=0) ---
    // These are needed to size the lens to encompass all rays
    const tipWorld = { x: -doDistance, y: objectHeight };
    const lensWorld = { x: 0, y: 0 };

    // Collect y-values where rays cross the lens plane (x=0)
    const rayYsAtLens: number[] = [];

    if (imgType === 'infinity') {
      // Ray 1: horizontal from tip -> hits lens at tip.y
      rayYsAtLens.push(tipWorld.y);
      // Ray 2: through centre -> hits lens at 0
      rayYsAtLens.push(0);
      // Ray 3: parallel (same as ray 1 for infinity case) -> hits lens at tip.y
      rayYsAtLens.push(tipWorld.y);
    } else {
      // Ray 1: horizontal from tip, hits lens at y = tipWorld.y
      rayYsAtLens.push(tipWorld.y);
      // Ray 2: through centre, hits lens at y = 0
      rayYsAtLens.push(lensWorld.y);
      // Ray 3: aimed at focal-point-on-left (-f, 0), arrives at lens
      const slope3 = (0 - tipWorld.y) / (-f - tipWorld.x);
      const yAtLens = tipWorld.y + slope3 * (0 - tipWorld.x);
      rayYsAtLens.push(yAtLens);
    }

    // Lens height: encompass all ray intersections plus margin
    const maxRayY = Math.max(...rayYsAtLens.map(Math.abs));
    const lensHalfHeight = Math.max(maxRayY + 12, 40); // at least 40 world units half-height
    const lensHeight = lensHalfHeight * 2;

    // --- Compute bounding box for auto-zoom ---
    // Collect all important world-space points
    const scenePoints: Point[] = [];

    // Display
    scenePoints.push({ x: -doDistance, y: displayHalfH });
    scenePoints.push({ x: -doDistance, y: -displayHalfH });

    // Object tip
    scenePoints.push({ x: -doDistance, y: objectHeight });

    // Lens bounds
    scenePoints.push({ x: 0, y: lensHalfHeight });
    scenePoints.push({ x: 0, y: -lensHalfHeight });

    // Focal points
    scenePoints.push({ x: -f, y: 0 });
    scenePoints.push({ x: f, y: 0 });

    // Eye
    scenePoints.push({ x: eyeWorldX + 20, y: 30 });
    scenePoints.push({ x: eyeWorldX + 20, y: -30 });

    // Image (if not at infinity and within reasonable bounds)
    if (imgType !== 'infinity') {
      const imageHeight = objectHeight * mag;
      const imageX = diRaw;
      // Clamp image position for viewport calculation to avoid extreme zoom-out
      const clampedImageX = Math.max(-2000, Math.min(2000, imageX));
      const clampedImageH = Math.max(-400, Math.min(400, imageHeight));
      scenePoints.push({ x: clampedImageX, y: 0 });
      scenePoints.push({ x: clampedImageX, y: clampedImageH });
    }

    // Ray endpoints (where rays reach on the right side)
    // Use a reasonable initial farX to bound the rays
    const initialFarX = 280;

    if (imgType === 'infinity') {
      // Rays go horizontal or diverge
      scenePoints.push({ x: initialFarX, y: tipWorld.y });
      scenePoints.push({ x: initialFarX, y: (tipWorld.y / doDistance) * initialFarX * -1 });
    } else {
      const slope1 = -tipWorld.y / f;
      const ray1EndY = tipWorld.y + slope1 * initialFarX;
      scenePoints.push({ x: initialFarX, y: ray1EndY });

      const slope2 = (lensWorld.y - tipWorld.y) / (lensWorld.x - tipWorld.x);
      const ray2EndY = lensWorld.y + slope2 * initialFarX;
      scenePoints.push({ x: initialFarX, y: ray2EndY });

      const slope3 = (0 - tipWorld.y) / (-f - tipWorld.x);
      const yAtLens = tipWorld.y + slope3 * (0 - tipWorld.x);
      scenePoints.push({ x: initialFarX, y: yAtLens });
    }

    // Calculate world bounding box
    let worldMinX = Infinity, worldMaxX = -Infinity;
    let worldMinY = Infinity, worldMaxY = -Infinity;
    for (const p of scenePoints) {
      if (p.x < worldMinX) worldMinX = p.x;
      if (p.x > worldMaxX) worldMaxX = p.x;
      if (p.y < worldMinY) worldMinY = p.y;
      if (p.y > worldMaxY) worldMaxY = p.y;
    }

    // Add padding (percentage on each side)
    const worldW = worldMaxX - worldMinX;
    const worldH = worldMaxY - worldMinY;
    const padFractionX = 0.12;
    const padFractionY = 0.18;
    worldMinX -= worldW * padFractionX;
    worldMaxX += worldW * padFractionX;
    worldMinY -= worldH * padFractionY;
    worldMaxY += worldH * padFractionY;

    // Enforce minimum viewport size so scene doesn't zoom in too much
    const minWorldW = 400;
    const minWorldH = 180;
    const currentW = worldMaxX - worldMinX;
    const currentH = worldMaxY - worldMinY;
    if (currentW < minWorldW) {
      const expand = (minWorldW - currentW) / 2;
      worldMinX -= expand;
      worldMaxX += expand;
    }
    if (currentH < minWorldH) {
      const expand = (minWorldH - currentH) / 2;
      worldMinY -= expand;
      worldMaxY += expand;
    }

    // Maintain aspect ratio to prevent distortion
    const canvasAspect = this.width / this.height;
    const worldAspect = (worldMaxX - worldMinX) / (worldMaxY - worldMinY);
    if (worldAspect > canvasAspect) {
      // World is wider than canvas: expand Y
      const targetH = (worldMaxX - worldMinX) / canvasAspect;
      const expandY = (targetH - (worldMaxY - worldMinY)) / 2;
      worldMinY -= expandY;
      worldMaxY += expandY;
    } else {
      // World is taller than canvas: expand X
      const targetW = (worldMaxY - worldMinY) * canvasAspect;
      const expandX = (targetW - (worldMaxX - worldMinX)) / 2;
      worldMinX -= expandX;
      worldMaxX += expandX;
    }

    const xMin = worldMinX;
    const xMax = worldMaxX;
    const yMin = worldMinY;
    const yMax = worldMaxY;

    const padding = 24;
    const scaleX = (this.width - padding * 2) / (xMax - xMin);
    const scaleY = (this.height - padding * 2) / (yMax - yMin);

    const worldToCanvas = (x: number, y: number): Point => ({
      x: padding + (x - xMin) * scaleX,
      y: this.height - padding - (y - yMin) * scaleY,
    });

    // farX for drawing rays: extend to right edge of viewport
    const farX = xMax;

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
    const arrowLeft = worldToCanvas(xMin + (xMax - xMin) * 0.05, yMax - (yMax - yMin) * 0.08);
    const arrowRight = worldToCanvas(xMax - (xMax - xMin) * 0.05, yMax - (yMax - yMin) * 0.08);
    drawArrow(ctx, arrowLeft.x, arrowLeft.y, arrowRight.x, arrowRight.y, {
      color: 'rgba(255,255,255,0.18)',
      width: 1.5,
      headSize: 8,
    });
    drawLabel(ctx, 'light direction \u2192', (arrowLeft.x + arrowRight.x) / 2, arrowLeft.y - 10, {
      color: 'rgba(255,255,255,0.35)',
      background: 'transparent',
    });

    // --- Device outlines (drawn early so rays overlay) ---
    const lensPos = worldToCanvas(0, 0);

    if (doDistance > f && !nearInfinity) {
      // Projector outline: trapezoid on left side around display->lens
      const pLeft = worldToCanvas(-doDistance - 20, 0);
      const pRight = worldToCanvas(0, 0);
      const bodyW = pRight.x - pLeft.x;
      const wideEnd = displayHalfH * 2 * scaleY + 30;
      const lensCanvasH = lensHeight * scaleY;
      const narrowEnd = lensCanvasH + 10; // lens height + margin
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

    // --- Lens (dynamic height, convexity reflects focal length) ---
    const lensCanvasHeight = lensHeight * scaleY;
    drawLens(ctx, lensPos.x, lensPos.y, lensCanvasHeight, {
      color: COLORS.lens,
      focalLength: f,
      fMin: Number(this.fInput.min),
      fMax: Number(this.fInput.max),
    });

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
    // Labels below axis to avoid clashing with Display/PROJECTOR labels above
    drawLabel(ctx, 'f', focalLeft.x, focalLeft.y + focalTickHalf + 12, {
      color: COLORS.lens,
      font: focalFont,
      background: 'rgba(0,0,0,0.5)',
    });
    drawLabel(ctx, "f\u2032", focalRight.x, focalRight.y + focalTickHalf + 12, {
      color: COLORS.lens,
      font: focalFont,
      background: 'rgba(0,0,0,0.5)',
    });

    // --- Display rectangle at object position ---
    const displayTop = worldToCanvas(-doDistance, displayHalfH);
    const displayBot = worldToCanvas(-doDistance, -displayHalfH);
    const dispW = 6;
    drawDisplay(ctx, displayTop.x - dispW / 2, displayTop.y, dispW, displayBot.y - displayTop.y);
    drawLabel(ctx, 'Display', displayTop.x, displayTop.y - 16, {
      background: 'rgba(179, 157, 219, 0.25)',
    });

    // --- Object arrow (light-emitting point on display) ---
    const objectBase = worldToCanvas(-doDistance, 0);
    const objectTip = worldToCanvas(-doDistance, objectHeight);
    drawArrow(ctx, objectBase.x, objectBase.y, objectTip.x, objectTip.y, {
      color: COLORS.accent,
      width: 2.5,
    });

    // --- Image ---
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
      const imgLabelText = imgType === 'virtual' ? 'Virtual Image' : 'Real Image';
      // Nudge image label when it would overlap the Eye label
      const eyeCanvasX = worldToCanvas(eyeWorldX, 0).x;
      const tooCloseToEye = Math.abs(imageTip.x - eyeCanvasX) < 60;
      const imgLabelX = tooCloseToEye ? imageTip.x - 50 : imageTip.x;
      const imgLabelY = tooCloseToEye ? imageTip.y + 16 : imageTip.y - 16;
      drawLabel(
        ctx,
        imgLabelText,
        imgLabelX,
        imgLabelY,
        {
          background:
            imgType === 'virtual'
              ? 'rgba(168, 85, 247, 0.25)'
              : 'rgba(76, 175, 80, 0.2)',
        }
      );
    } else {
      drawLabel(ctx, 'Image at \u221e', lensPos.x + 90, lensPos.y - 40, {
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
    drawLabel(ctx, 'Eye', eyePos.x, eyePos.y - 26, {
      color: COLORS.text,
      background: 'rgba(255,255,255,0.08)',
    });

    // --- Regime label ---
    const regimeLabel =
      imgType === 'infinity'
        ? 'd_o = f \u2192 image at \u221e'
        : doDistance < f
          ? 'HMD regime: d_o < f \u2192 virtual image'
          : 'Projector regime: d_o > f \u2192 real image';
    drawLabel(ctx, regimeLabel, lensPos.x, lensPos.y + 70, {
      background:
        doDistance < f
          ? 'rgba(233, 69, 96, 0.2)'
          : doDistance > f
            ? 'rgba(77,166,255,0.15)'
            : 'rgba(255, 255, 255, 0.08)',
    });

    // --- Equation on-canvas at bottom ---
    const eqText = `1/f = 1/d_o + 1/d_i  \u2192  1/${f} = 1/${doDistance} + 1/${diText}`;
    drawLabel(ctx, eqText, this.width / 2, this.height - 16, {
      color: 'rgba(255,255,255,0.6)',
      background: 'rgba(0,0,0,0.5)',
      font: '11px "Space Grotesk", system-ui, sans-serif',
    });
  }
}
