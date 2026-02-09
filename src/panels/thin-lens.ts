import { drawLabel } from '../canvas-utils';
import { BasePanel } from '../ui-controls';

export class ThinLensPanel extends BasePanel {
  constructor(container: HTMLElement) {
    super(container);
    this.addSlider({
      id: 'thin-lens-f',
      label: 'Focal Length (mm)',
      min: 10,
      max: 200,
      step: 1,
      value: 40,
      unit: 'mm',
    });
    this.addSlider({
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
  }

  render(): void {
    super.render();
    drawLabel(this.ctx, 'Thin Lens panel', this.canvas.width / 2, 40);
  }
}
