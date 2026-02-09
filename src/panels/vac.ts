import { drawLabel } from '../canvas-utils';
import { BasePanel } from '../ui-controls';

export class VacPanel extends BasePanel {
  constructor(container: HTMLElement) {
    super(container);
    this.addSlider({
      id: 'vac-depth',
      label: 'Virtual Object Depth (m)',
      min: 0.3,
      max: 10,
      step: 0.1,
      value: 2,
      unit: 'm',
    });
    this.addReadout({ id: 'vac-mismatch', label: 'Mismatch', unit: 'D' });
  }

  render(): void {
    super.render();
    drawLabel(this.ctx, 'VAC panel', this.canvas.width / 2, 40);
  }
}
