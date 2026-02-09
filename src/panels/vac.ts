import { drawEye, drawLabel } from '../canvas-utils';
import { COLORS, VAC_COMFORT, VAC_MILD } from '../constants';
import { vacMismatch } from '../optics-math';
import { BasePanel } from '../ui-controls';

export class VacPanel extends BasePanel {
  private depthInput: HTMLInputElement;
  private displayReadout: HTMLElement;
  private infoEl: HTMLDivElement;

  constructor(container: HTMLElement) {
    super(container);
    this.depthInput = this.addSlider({
      id: 'vac-depth',
      label: 'Virtual Object Depth (m)',
      min: 0.3,
      max: 10,
      step: 0.1,
      value: 2,
      unit: 'm',
    });
    this.addReadout({ id: 'vac-mismatch', label: 'Mismatch', unit: 'D' });
    this.displayReadout = this.addReadout({
      id: 'vac-display',
      label: 'Display Distance',
      unit: 'm',
    });

    this.infoEl = document.createElement('div');
    this.infoEl.className = 'callout';
    this.infoEl.innerHTML =
      'Industry solutions: varifocal displays, light field displays, foveated rendering.';
    this.controlsEl.appendChild(this.infoEl);
  }

  render(): void {
    this.clear();
    const ctx = this.ctx;
    ctx.fillStyle = '#0f1324';
    ctx.fillRect(0, 0, this.width, this.height);

    const virtualDepth = Number(this.depthInput.value);
    const displayDistance = 1.8;
    const mismatch = vacMismatch(displayDistance, virtualDepth);
    this.setReadout('vac-mismatch', mismatch.toFixed(2));
    this.displayReadout.textContent = displayDistance.toFixed(1);

    let status = 'Comfortable';
    let statusColor = COLORS.rayGreen;
    if (mismatch > VAC_MILD) {
      status = 'Eye strain likely';
      statusColor = COLORS.rayRight;
    } else if (mismatch > VAC_COMFORT) {
      status = 'Mild discomfort';
      statusColor = COLORS.rayYellow;
    }

    const padding = 18;
    const gap = 20;
    const regionWidth = (this.width - padding * 2 - gap) / 2;
    const regionHeight = this.height - padding * 2;
    const regions = [
      { x: padding, y: padding, width: regionWidth, height: regionHeight },
      {
        x: padding + regionWidth + gap,
        y: padding,
        width: regionWidth,
        height: regionHeight,
      },
    ];

    const drawScene = (
      region: { x: number; y: number; width: number; height: number },
      title: string,
      vergenceDepth: number,
      accommodationDepth: number,
      coupled: boolean
    ) => {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(region.x, region.y, region.width, region.height);

      const centerY = region.y + region.height * 0.55;
      const eyeOffset = region.width * 0.18;
      const eyeRadius = region.width * 0.08;
      const leftEyeX = region.x + region.width * 0.4;
      const rightEyeX = region.x + region.width * 0.6;

      const ipdM = 0.065;
      const vergenceAngle = Math.atan((ipdM / 2) / vergenceDepth);
      const leftRotation = coupled ? -vergenceAngle : -vergenceAngle;
      const rightRotation = coupled ? vergenceAngle : vergenceAngle;

      drawEye(ctx, leftEyeX - eyeOffset, centerY, eyeRadius, leftRotation);
      drawEye(ctx, rightEyeX + eyeOffset, centerY, eyeRadius, rightRotation);

      const lensFactor = Math.max(0.2, Math.min(1, 1 - (accommodationDepth - 0.3) / 9.7));
      const lensWidth = eyeRadius * (0.4 + 0.4 * lensFactor);
      const lensHeight = eyeRadius * (0.9 + 0.2 * lensFactor);
      ctx.fillStyle = coupled ? 'rgba(76, 175, 80, 0.4)' : 'rgba(255, 107, 107, 0.3)';
      ctx.beginPath();
      ctx.ellipse(
        leftEyeX - eyeOffset + eyeRadius * 0.3,
        centerY,
        lensWidth,
        lensHeight,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(
        rightEyeX + eyeOffset - eyeRadius * 0.3,
        centerY,
        lensWidth,
        lensHeight,
        0,
        0,
        Math.PI * 2
      );
      ctx.fill();

      const objectY = region.y + region.height * 0.2;
      ctx.strokeStyle = coupled ? COLORS.rayGreen : COLORS.rayRight;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(leftEyeX - eyeOffset, centerY);
      ctx.lineTo(region.x + region.width * 0.5 - 20, objectY);
      ctx.moveTo(rightEyeX + eyeOffset, centerY);
      ctx.lineTo(region.x + region.width * 0.5 + 20, objectY);
      ctx.stroke();

      drawLabel(ctx, title, region.x + region.width / 2, region.y + 18, {
        background: 'rgba(15, 52, 96, 0.4)',
      });

      drawLabel(
        ctx,
        coupled ? 'Vergence = Accommodation' : 'Vergence ≠ Accommodation',
        region.x + region.width / 2,
        region.y + region.height - 24,
        {
          background: coupled ? 'rgba(76, 175, 80, 0.2)' : 'rgba(255, 107, 107, 0.25)',
        }
      );

      ctx.restore();
    };

    drawScene(regions[0], 'Natural Vision', virtualDepth, virtualDepth, true);
    drawScene(regions[1], 'VR Vision', virtualDepth, displayDistance, false);

    const gaugeX = regions[1].x + 18;
    const gaugeY = regions[1].y + regions[1].height * 0.75;
    const gaugeWidth = regions[1].width - 36;
    ctx.save();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.fillRect(gaugeX, gaugeY, gaugeWidth, 10);
    ctx.fillStyle = statusColor;
    const fill = Math.min(1, mismatch / 1.0);
    ctx.fillRect(gaugeX, gaugeY, gaugeWidth * fill, 10);
    ctx.restore();

    drawLabel(ctx, status, gaugeX + gaugeWidth / 2, gaugeY + 22, {
      background: 'rgba(0, 0, 0, 0.4)',
      color: statusColor,
    });
  }
}
