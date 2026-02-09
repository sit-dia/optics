import { drawLabel } from '../canvas-utils';
import { BasePanel } from '../ui-controls';

export class LightPathPanel extends BasePanel {
  constructor(container: HTMLElement) {
    super(container);
    this.addSlider({
      id: 'light-path-f',
      label: 'Focal Length (mm)',
      min: 20,
      max: 100,
      step: 1,
      value: 43,
      unit: 'mm',
    });
    this.addSlider({
      id: 'light-path-do',
      label: 'Object Distance (mm)',
      min: 10,
      max: 120,
      step: 1,
      value: 42,
      unit: 'mm',
    });
  }

  render(): void {
    super.render();
    drawLabel(this.ctx, 'Projection vs HMD panel', this.canvas.width / 2, 40);
  }
}
