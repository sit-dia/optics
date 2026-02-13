import {
  drawArrow,
  drawDashedLine,
  drawDisplay,
  drawEdgeGlow,
  drawEdgeLabel,
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

/**
 * Label placement helper: tracks placed label bounding boxes and nudges
 * new labels so they don't overlap previous ones.
 */
interface LabelRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

class LabelPlacer {
  private placed: LabelRect[] = [];

  /** Register a label and return adjusted (x,y) that avoids collisions. */
  place(x: number, y: number, w: number, h: number): { x: number; y: number } {
    const candidate: LabelRect = { x: x - w / 2, y: y - h / 2, w, h };
    let bestX = candidate.x;
    let bestY = candidate.y;
    // Try shifts: original, then progressively further up/down/left/right
    const shifts = [
      [0, 0], [0, -h - 2], [0, h + 2],
      [-w - 4, 0], [w + 4, 0],
      [0, -h * 2 - 4], [0, h * 2 + 4],
      [-w - 4, -h - 2], [w + 4, -h - 2],
    ];
    for (const [dx, dy] of shifts) {
      const cx = candidate.x + dx;
      const cy = candidate.y + dy;
      let overlap = false;
      for (const p of this.placed) {
        if (
          cx < p.x + p.w &&
          cx + w > p.x &&
          cy < p.y + p.h &&
          cy + h > p.y
        ) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        bestX = cx;
        bestY = cy;
        break;
      }
    }
    this.placed.push({ x: bestX, y: bestY, w, h });
    return { x: bestX + w / 2, y: bestY + h / 2 };
  }
}

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
    // Widen the near-infinity zone so the singularity is handled gracefully.
    // Use a relative threshold: within 5% of f, or absolute 3mm, whichever is larger.
    const nearInfinityThreshold = Math.max(3, f * 0.05);
    const nearInfinity = Math.abs(doDistance - f) < nearInfinityThreshold;
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
    const displayHalfH = 50;

    // --- Eye position adapts to regime ---
    // In HMD mode, place eye further right so the HMD outline has room
    const eyeWorldX = doDistance < f ? Math.max(80, f * 0.6) : 60;

    const tipWorld = { x: -doDistance, y: objectHeight };
    const lensWorld = { x: 0, y: 0 };

    // --- Compute ray 3's intersection with the lens plane ---
    // Ray 3 aims from the object tip toward the front focal point (-f, 0).
    // When d_o is close to f, slope3 diverges and yAtLens becomes huge.
    // Only clamp when in the near-infinity zone (singularity); in normal
    // HMD/projector regimes let the true value through so backward extensions
    // and the virtual-image arrow stay consistent with forward rays.
    const maxYAtLens = objectHeight * 5;
    let ray3YAtLens = tipWorld.y; // fallback
    if (imgType !== 'infinity') {
      const denom = -f - tipWorld.x; // = -f + d_o = d_o - f
      if (Math.abs(denom) > 0.01) {
        const slope3 = (0 - tipWorld.y) / denom;
        ray3YAtLens = tipWorld.y + slope3 * (0 - tipWorld.x);
        // Only clamp near the singularity zone to keep the diagram readable
        ray3YAtLens = Math.max(-maxYAtLens, Math.min(maxYAtLens, ray3YAtLens));
      }
    }

    // Collect y-values where rays cross the lens plane (x=0)
    const rayYsAtLens: number[] = [];

    if (imgType === 'infinity') {
      rayYsAtLens.push(tipWorld.y);
      rayYsAtLens.push(0);
      rayYsAtLens.push(tipWorld.y);
    } else {
      rayYsAtLens.push(tipWorld.y);
      rayYsAtLens.push(lensWorld.y);
      rayYsAtLens.push(ray3YAtLens);
    }

    // Lens height: encompass ray intersections but CAP to prevent giant lens
    const maxRayY = Math.max(...rayYsAtLens.map(Math.abs));
    // Cap lens half-height: minimum 40, grows with rays but max ~80 world units
    const lensHalfHeight = Math.min(Math.max(maxRayY + 12, 40), 80);
    const lensHeight = lensHalfHeight * 2;

    // --- Clamp magnification for drawing purposes ---
    // Near singularity, mag can be huge. Cap to keep image arrow reasonable.
    const maxDrawMag = 6;
    const drawMag = Math.max(-maxDrawMag, Math.min(maxDrawMag, mag));
    const drawImageHeight = objectHeight * drawMag;

    // --- FIXED viewport: never chase the image position ---
    // Viewport is determined ONLY by display position, eye position, and focal points.
    // Image distance (diRaw) is NEVER included in bounds.
    const anchorMinX = -doDistance - 40; // display + margin
    const anchorMaxX = Math.max(eyeWorldX + 40, f + 20); // eye/focal point + margin

    // Include focal points
    let effectiveMinX = Math.min(anchorMinX, -f - 10);
    let effectiveMaxX = Math.max(anchorMaxX, f + 10);

    // Y bounds: based on display, lens, object arrow only
    const sceneHalfY = Math.max(displayHalfH + 20, lensHalfHeight + 10, objectHeight + 20, 80);

    let worldMinX = effectiveMinX;
    let worldMaxX = effectiveMaxX;
    let worldMinY = -sceneHalfY;
    let worldMaxY = sceneHalfY;

    // Add padding
    const worldW = worldMaxX - worldMinX;
    const worldH = worldMaxY - worldMinY;
    const padFractionX = 0.08;
    const padFractionY = 0.12;
    worldMinX -= worldW * padFractionX;
    worldMaxX += worldW * padFractionX;
    worldMinY -= worldH * padFractionY;
    worldMaxY += worldH * padFractionY;

    // Enforce minimum viewport size
    const minWorldW = 300;
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

    // Maintain aspect ratio
    const canvasAspect = this.width / this.height;
    const worldAspect = (worldMaxX - worldMinX) / (worldMaxY - worldMinY);
    if (worldAspect > canvasAspect) {
      const targetH = (worldMaxX - worldMinX) / canvasAspect;
      const expandY = (targetH - (worldMaxY - worldMinY)) / 2;
      worldMinY -= expandY;
      worldMaxY += expandY;
    } else {
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

    // Label placer to avoid overlaps
    const labels = new LabelPlacer();
    const measureLabel = (text: string, font?: string): { w: number; h: number } => {
      ctx.save();
      ctx.font = font ?? '12px "Space Grotesk", system-ui, sans-serif';
      const m = ctx.measureText(text);
      ctx.restore();
      return { w: m.width + 8, h: 20 };
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
      // Projector outline
      const pLeft = worldToCanvas(-doDistance - 20, 0);
      const pRight = worldToCanvas(0, 0);
      const bodyW = pRight.x - pLeft.x;
      const wideEnd = displayHalfH * 2 * scaleY + 30;
      const lensCanvasH = lensHeight * scaleY;
      const narrowEnd = lensCanvasH + 10;
      drawProjector(ctx, pLeft.x, lensPos.y, wideEnd, narrowEnd, bodyW);
    } else if (doDistance < f) {
      // HMD outline: use fixed canvas-pixel proportions so it doesn't blow up
      // when the viewport expands for large virtual image distances.
      // The HMD should enclose: display (left), lens (center), eye (right).
      const hmdLeftWorld = -doDistance - 15;
      const hmdRightWorld = eyeWorldX + 20;
      const hmdTopWorld = Math.max(displayHalfH, lensHalfHeight) + 10;
      const hmdLeft = worldToCanvas(hmdLeftWorld, hmdTopWorld);
      const hmdRight = worldToCanvas(hmdRightWorld, -hmdTopWorld);
      let hmdW = hmdRight.x - hmdLeft.x;
      let hmdH = hmdRight.y - hmdLeft.y; // canvas y is inverted
      // Enforce minimum HMD outline size (at least 120x80 canvas pixels)
      const minHmdW = 120;
      const minHmdH = 80;
      let hmdX = hmdLeft.x;
      let hmdY = hmdLeft.y;
      if (hmdW < minHmdW) {
        const expand = (minHmdW - hmdW) / 2;
        hmdX -= expand;
        hmdW = minHmdW;
      }
      if (hmdH < minHmdH) {
        const expand = (minHmdH - hmdH) / 2;
        hmdY -= expand;
        hmdH = minHmdH;
      }
      drawHMD(ctx, hmdX, hmdY, hmdW, hmdH);
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
    // Cap lens canvas size to at most 80% of canvas height to prevent domination
    const maxLensCanvasH = this.height * 0.8;
    const effectiveLensH = Math.min(lensCanvasHeight, maxLensCanvasH);
    drawLens(ctx, lensPos.x, lensPos.y, effectiveLensH, {
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

    // Focal point labels via placer
    const fLabelSize = measureLabel('f', focalFont);
    const fPos = labels.place(focalLeft.x, focalLeft.y + focalTickHalf + 12, fLabelSize.w, fLabelSize.h);
    drawLabel(ctx, 'f', fPos.x, fPos.y, {
      color: COLORS.lens,
      font: focalFont,
      background: 'rgba(0,0,0,0.5)',
    });
    const fpLabelSize = measureLabel("f\u2032", focalFont);
    const fpPos = labels.place(focalRight.x, focalRight.y + focalTickHalf + 12, fpLabelSize.w, fpLabelSize.h);
    drawLabel(ctx, "f\u2032", fpPos.x, fpPos.y, {
      color: COLORS.lens,
      font: focalFont,
      background: 'rgba(0,0,0,0.5)',
    });

    // --- Display rectangle at object position ---
    const displayTop = worldToCanvas(-doDistance, displayHalfH);
    const displayBot = worldToCanvas(-doDistance, -displayHalfH);
    const dispW = 6;
    drawDisplay(ctx, displayTop.x - dispW / 2, displayTop.y, dispW, displayBot.y - displayTop.y);
    const dispLabelSize = measureLabel('Display');
    const dispLabelPos = labels.place(displayTop.x, displayTop.y - 16, dispLabelSize.w, dispLabelSize.h);
    drawLabel(ctx, 'Display', dispLabelPos.x, dispLabelPos.y, {
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
    // With the fixed viewport, we check if the image position is within the
    // visible world bounds. If off-screen, show edge glow instead of drawing
    // the image arrow.
    const imageOffScreenLeft = imgType === 'virtual' && diRaw < worldMinX;
    const imageOffScreenRight = imgType === 'real' && diRaw > worldMaxX;
    const imageOffScreen = imageOffScreenLeft || imageOffScreenRight;

    // Check if image arrow tip exceeds Y bounds
    const imageTipY = drawImageHeight;
    const imageOffScreenTop = imgType !== 'infinity' && !imageOffScreen && imageTipY > worldMaxY;
    const imageOffScreenBottom = imgType !== 'infinity' && !imageOffScreen && imageTipY < worldMinY;

    if (imgType !== 'infinity') {
      if (!imageOffScreen) {
        // Image is within viewport: draw it at its true position
        const imageBase = worldToCanvas(diRaw, 0);
        const imageTip = worldToCanvas(diRaw, drawImageHeight);
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
        const imgLS = measureLabel(imgLabelText);
        const imgLP = labels.place(imageTip.x, imageTip.y - 16, imgLS.w, imgLS.h);
        drawLabel(
          ctx,
          imgLabelText,
          imgLP.x,
          imgLP.y,
          {
            background:
              imgType === 'virtual'
                ? 'rgba(168, 85, 247, 0.25)'
                : 'rgba(76, 175, 80, 0.2)',
          }
        );
      }
      // Edge glow and labels are drawn AFTER all other scene elements (see below)
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
      // Ray 1: parallel to axis, then through back focal point f'
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

      // Ray 2: through lens center, continues undeviated
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

      // Ray 3: through front focal point, exits parallel to axis
      // Uses the pre-clamped ray3YAtLens computed earlier
      const ray3End = { x: farX, y: ray3YAtLens };
      drawWorldRay(
        [
          { x: tipWorld.x, y: tipWorld.y },
          { x: 0, y: ray3YAtLens },
          { x: ray3End.x, y: ray3End.y },
        ],
        undefined,
        COLORS.rayGreen
      );

      // Virtual image backward extensions: trace each refracted ray backward
      // along its TRUE physical slope from the lens exit point. This ensures
      // convergence at the correct virtual image position even when the drawn
      // image arrow is clamped for viewport reasons.
      if (imgType === 'virtual') {
        // Compute each refracted ray's slope after the lens, then trace backward.
        // Ray 1: enters at (0, objectHeight), refracted slope = -objectHeight/f
        const ray1Slope = -tipWorld.y / f;
        // Ray 2: through center, undeviated slope = tipWorld.y / (-tipWorld.x) = objectHeight / doDistance
        const ray2Slope = (lensWorld.y - tipWorld.y) / (lensWorld.x - tipWorld.x);

        // Extend each backward from lens exit to left viewport edge
        const extentX = xMin;

        // Ray 1: from (0, objectHeight) backward
        const ray1ExtY = tipWorld.y + ray1Slope * extentX;
        drawWorldRay([
          { x: 0, y: tipWorld.y },
          { x: extentX, y: ray1ExtY },
        ], [6, 6], COLORS.virtualImage);

        // Ray 2: from (0, 0) backward
        const ray2ExtY = lensWorld.y + ray2Slope * extentX;
        drawWorldRay([
          { x: 0, y: lensWorld.y },
          { x: extentX, y: ray2ExtY },
        ], [6, 6], COLORS.virtualImage);

        // Ray 3: exits parallel to axis at y = ray3YAtLens.
        // Backward extension is horizontal at the SAME y used for the forward ray,
        // ensuring visual continuity at the lens plane.
        drawWorldRay([
          { x: 0, y: ray3YAtLens },
          { x: extentX, y: ray3YAtLens },
        ], [6, 6], COLORS.virtualImage);
      }
    }

    // --- Eye (always on right) ---
    const eyePos = worldToCanvas(eyeWorldX, 0);
    const eyeRotation = doDistance < f ? Math.PI : 0;
    drawEye(ctx, eyePos.x, eyePos.y, 14, eyeRotation);
    const eyeLS = measureLabel('Eye');
    const eyeLP = labels.place(eyePos.x, eyePos.y - 26, eyeLS.w, eyeLS.h);
    drawLabel(ctx, 'Eye', eyeLP.x, eyeLP.y, {
      color: COLORS.text,
      background: 'rgba(255,255,255,0.08)',
    });

    // --- Device label (drawn after rays so it's on top, placed via label placer) ---
    if (doDistance > f && !nearInfinity) {
      const pLeft = worldToCanvas(-doDistance - 20, 0);
      const pRight = worldToCanvas(0, 0);
      const bodyW = pRight.x - pLeft.x;
      const projLS = measureLabel('PROJECTOR');
      const projLP = labels.place(pLeft.x + bodyW / 2, lensPos.y - displayHalfH * scaleY - 28, projLS.w, projLS.h);
      drawLabel(ctx, 'PROJECTOR', projLP.x, projLP.y, {
        color: '#4da6ff',
        background: 'rgba(77,166,255,0.18)',
      });
    } else if (doDistance < f) {
      const hmdLeftWorld = -doDistance - 15;
      const hmdRightWorld = eyeWorldX + 20;
      const hmdTopWorld = Math.max(displayHalfH, lensHalfHeight) + 10;
      const hmdLabelLeft = worldToCanvas(hmdLeftWorld, hmdTopWorld);
      const hmdLabelRight = worldToCanvas(hmdRightWorld, -hmdTopWorld);
      const hmdLS = measureLabel('HMD');
      const hmdLP = labels.place((hmdLabelLeft.x + hmdLabelRight.x) / 2, hmdLabelLeft.y - 12, hmdLS.w, hmdLS.h);
      drawLabel(ctx, 'HMD', hmdLP.x, hmdLP.y, {
        color: '#e94560',
        background: 'rgba(233,69,96,0.18)',
      });
    }

    // --- Regime label ---
    const regimeLabel =
      imgType === 'infinity'
        ? 'd_o = f \u2192 image at \u221e'
        : doDistance < f
          ? 'HMD regime: d_o < f \u2192 virtual image'
          : 'Projector regime: d_o > f \u2192 real image';
    const regLS = measureLabel(regimeLabel);
    const regLP = labels.place(lensPos.x, lensPos.y + 70, regLS.w, regLS.h);
    drawLabel(ctx, regimeLabel, regLP.x, regLP.y, {
      background:
        doDistance < f
          ? 'rgba(233, 69, 96, 0.2)'
          : doDistance > f
            ? 'rgba(77,166,255,0.15)'
            : 'rgba(255, 255, 255, 0.08)',
    });

    // --- Red glow edge indicators for off-screen content ---
    if (imgType !== 'infinity') {
      if (imageOffScreenLeft) {
        drawEdgeGlow(ctx, 'left', this.width, this.height);
        const dist = Math.abs(diRaw).toFixed(0);
        drawEdgeLabel(ctx, 'left', this.width, this.height,
          '\u2190 Virtual Image ' + dist + 'mm',
          { color: COLORS.virtualImage, yPos: lensPos.y - 20 }
        );
      }
      if (imageOffScreenRight) {
        drawEdgeGlow(ctx, 'right', this.width, this.height);
        const dist = diRaw.toFixed(0);
        drawEdgeLabel(ctx, 'right', this.width, this.height,
          'Real Image ' + dist + 'mm \u2192',
          { color: COLORS.rayGreen, yPos: lensPos.y - 20 }
        );
      }
      if (imageOffScreenTop) {
        drawEdgeGlow(ctx, 'top', this.width, this.height);
      }
      if (imageOffScreenBottom) {
        drawEdgeGlow(ctx, 'bottom', this.width, this.height);
      }
    }

    // --- Equation on-canvas at bottom ---
    const eqText = `1/f = 1/d_o + 1/d_i  \u2192  1/${f} = 1/${doDistance} + 1/${diText}`;
    drawLabel(ctx, eqText, this.width / 2, this.height - 16, {
      color: 'rgba(255,255,255,0.6)',
      background: 'rgba(0,0,0,0.5)',
      font: '11px "Space Grotesk", system-ui, sans-serif',
    });
  }
}
