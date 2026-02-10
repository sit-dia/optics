import { drawArrow, drawGrid, drawLabel } from '../canvas-utils';
import { DEFAULT_DISTORTION } from '../constants';
import { applyDistortion } from '../optics-math';
import { BasePanel } from '../ui-controls';

export class DistortionPanel extends BasePanel {
  private k1Input: HTMLInputElement;
  private k2Input: HTMLInputElement;
  private gridInput: HTMLInputElement;
  private preToggle: HTMLInputElement;

  constructor(container: HTMLElement) {
    super(container);
    this.k1Input = this.addSlider({
      id: 'distortion-k1',
      label: 'k1',
      min: -1,
      max: 1,
      step: 0.01,
      value: DEFAULT_DISTORTION.k1,
    });
    this.k2Input = this.addSlider({
      id: 'distortion-k2',
      label: 'k2',
      min: -1,
      max: 1,
      step: 0.01,
      value: DEFAULT_DISTORTION.k2,
    });
    this.gridInput = this.addSlider({
      id: 'distortion-grid',
      label: 'Grid Density',
      min: 4,
      max: 20,
      step: 1,
      value: 8,
    });

    const toggleRow = document.createElement('div');
    toggleRow.className = 'control-row';
    const toggleLabel = document.createElement('label');
    toggleLabel.htmlFor = 'distortion-pre-toggle';
    toggleLabel.textContent = 'Pre-correction';
    this.preToggle = document.createElement('input');
    this.preToggle.id = 'distortion-pre-toggle';
    this.preToggle.name = 'distortion-pre-toggle';
    this.preToggle.type = 'checkbox';
    this.preToggle.checked = false;
    this.preToggle.addEventListener('change', () => this.requestDraw());
    toggleRow.appendChild(toggleLabel);
    toggleRow.appendChild(this.preToggle);
    this.controlsEl.appendChild(toggleRow);
  }

  render(): void {
    this.clear();
    const ctx = this.ctx;
    ctx.fillStyle = '#0f1324';
    ctx.fillRect(0, 0, this.width, this.height);

    const k1 = Number(this.k1Input.value);
    const k2 = Number(this.k2Input.value);
    const grid = Number(this.gridInput.value);

    const padding = 16;
    const gap = 18;
    const regionHeight = (this.height - padding * 2 - gap * 2) / 3;
    const regionWidth = this.width - padding * 2;

    const regions = [
      { x: padding, y: padding, width: regionWidth, height: regionHeight },
      {
        x: padding,
        y: padding + regionHeight + gap,
        width: regionWidth,
        height: regionHeight,
      },
      {
        x: padding,
        y: padding + (regionHeight + gap) * 2,
        width: regionWidth,
        height: regionHeight,
      },
    ];

    const drawGridRegion = (
      region: { x: number; y: number; width: number; height: number },
      rows: number,
      cols: number,
      k1Value = 0,
      k2Value = 0
    ) => {
      ctx.save();
      ctx.beginPath();
      ctx.rect(region.x, region.y, region.width, region.height);
      ctx.clip();
      ctx.translate(region.x, region.y);
      ctx.scale(region.width / ctx.canvas.width, region.height / ctx.canvas.height);
      const baseWidth = ctx.canvas.width;
      const baseHeight = ctx.canvas.height;
      const cx = baseWidth / 2;
      const cy = baseHeight / 2;
      const radius = Math.min(baseWidth, baseHeight) / 2;
      const transform = (x: number, y: number) => {
        const nx = (x - cx) / radius;
        const ny = (y - cy) / radius;
        const distorted = applyDistortion(nx, ny, 0, 0, k1Value, k2Value);
        return {
          x: cx + distorted.x * radius,
          y: cy + distorted.y * radius,
        };
      };
      drawGrid(ctx, rows, cols, k1Value !== 0 || k2Value !== 0 ? transform : undefined);
      ctx.restore();
    };

    const topRegion = regions[0];
    const midRegion = regions[1];
    const bottomRegion = regions[2];

    const halfWidth = (topRegion.width - gap) / 2;
    const barrelRegion = {
      x: topRegion.x,
      y: topRegion.y,
      width: halfWidth,
      height: topRegion.height,
    };
    const pincushionRegion = {
      x: topRegion.x + halfWidth + gap,
      y: topRegion.y,
      width: halfWidth,
      height: topRegion.height,
    };
    drawGridRegion(barrelRegion, grid, grid, DEFAULT_DISTORTION.k1, DEFAULT_DISTORTION.k2);
    drawGridRegion(
      pincushionRegion,
      grid,
      grid,
      -DEFAULT_DISTORTION.k1,
      -DEFAULT_DISTORTION.k2
    );
    drawLabel(ctx, 'Barrel distortion', barrelRegion.x + 90, barrelRegion.y + 18, {
      background: 'rgba(233, 69, 96, 0.25)',
    });
    drawLabel(ctx, 'Pincushion distortion', pincushionRegion.x + 100, pincushionRegion.y + 18, {
      background: 'rgba(15, 52, 96, 0.4)',
    });

    const stepGap = 12;
    const stepCount = 4;
    const stepWidth = (midRegion.width - stepGap * (stepCount - 1)) / stepCount;
    const stepHeight = midRegion.height;
    const stepRegions = Array.from({ length: stepCount }, (_, idx) => ({
      x: midRegion.x + idx * (stepWidth + stepGap),
      y: midRegion.y,
      width: stepWidth,
      height: stepHeight,
    }));

    drawGridRegion(stepRegions[0], 8, 8);
    drawLabel(ctx, 'Original', stepRegions[0].x + 40, stepRegions[0].y + 18, {
      background: 'rgba(255, 255, 255, 0.08)',
    });
    drawGridRegion(stepRegions[1], 8, 8, -k1, -k2);
    drawLabel(ctx, 'Pre-distort', stepRegions[1].x + 46, stepRegions[1].y + 18, {
      background: 'rgba(15, 52, 96, 0.4)',
    });
    drawGridRegion(stepRegions[2], 8, 8, k1, k2);
    drawLabel(ctx, 'Lens barrel', stepRegions[2].x + 46, stepRegions[2].y + 18, {
      background: 'rgba(233, 69, 96, 0.25)',
    });
    drawGridRegion(stepRegions[3], 8, 8, 0, 0);
    drawLabel(ctx, 'Straight', stepRegions[3].x + 42, stepRegions[3].y + 18, {
      background: 'rgba(76, 175, 80, 0.2)',
    });

    for (let i = 0; i < stepRegions.length - 1; i += 1) {
      const from = stepRegions[i];
      const to = stepRegions[i + 1];
      drawArrow(
        ctx,
        from.x + from.width + 4,
        from.y + from.height / 2,
        to.x - 4,
        to.y + to.height / 2,
        { color: '#eaeaea', width: 1.5, headSize: 6 }
      );
    }

    const interactiveLabel = this.preToggle.checked
      ? 'Pre-correction ON → canceling barrel'
      : 'Interactive distortion playground';
    drawLabel(ctx, interactiveLabel, bottomRegion.x + 120, bottomRegion.y + 18, {
      background: 'rgba(255, 255, 255, 0.08)',
    });

    if (this.preToggle.checked) {
      const compositeTransform = (x: number, y: number) => {
        const cx = ctx.canvas.width / 2;
        const cy = ctx.canvas.height / 2;
        const radius = Math.min(ctx.canvas.width, ctx.canvas.height) / 2;
        const nx = (x - cx) / radius;
        const ny = (y - cy) / radius;
        const pre = applyDistortion(nx, ny, 0, 0, -k1, -k2);
        const post = applyDistortion(pre.x, pre.y, 0, 0, k1, k2);
        return { x: cx + post.x * radius, y: cy + post.y * radius };
      };
      ctx.save();
      ctx.beginPath();
      ctx.rect(bottomRegion.x, bottomRegion.y, bottomRegion.width, bottomRegion.height);
      ctx.clip();
      ctx.translate(bottomRegion.x, bottomRegion.y);
      ctx.scale(bottomRegion.width / ctx.canvas.width, bottomRegion.height / ctx.canvas.height);
      drawGrid(ctx, grid, grid, compositeTransform);
      ctx.restore();
    } else {
      drawGridRegion(bottomRegion, grid, grid, k1, k2);
    }
  }
}
