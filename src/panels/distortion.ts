import { drawLabel } from '../canvas-utils';
import { BasePanel } from '../ui-controls';

export class DistortionPanel extends BasePanel {
  constructor(container: HTMLElement) {
    super(container);
    this.addSlider({
      id: 'distortion-k1',
      label: 'k1',
      min: -1,
      max: 1,
      step: 0.01,
      value: 0.34,
    });
    this.addSlider({
      id: 'distortion-k2',
      label: 'k2',
      min: -1,
      max: 1,
      step: 0.01,
      value: 0.55,
    });
    this.addSlider({
      id: 'distortion-grid',
      label: 'Grid Density',
      min: 4,
      max: 20,
      step: 1,
      value: 8,
    });
  }

  render(): void {
    super.render();
    drawLabel(this.ctx, 'Distortion panel', this.canvas.width / 2, 40);
  }
}
