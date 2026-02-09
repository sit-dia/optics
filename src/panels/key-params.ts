import { drawLabel } from '../canvas-utils';
import { BasePanel } from '../ui-controls';

export class KeyParamsPanel extends BasePanel {
  constructor(container: HTMLElement) {
    super(container);
    this.addSlider({
      id: 'params-ipd',
      label: 'IPD (mm)',
      min: 52,
      max: 78,
      step: 1,
      value: 63,
      unit: 'mm',
    });
    this.addSlider({
      id: 'params-eye-relief',
      label: 'Eye Relief (mm)',
      min: 8,
      max: 25,
      step: 1,
      value: 18,
      unit: 'mm',
    });
    this.addSlider({
      id: 'params-f',
      label: 'Focal Length (mm)',
      min: 30,
      max: 60,
      step: 1,
      value: 43,
      unit: 'mm',
    });
    this.addSlider({
      id: 'params-do',
      label: 'Lens to Display (mm)',
      min: 30,
      max: 55,
      step: 1,
      value: 42,
      unit: 'mm',
    });
    this.addReadout({ id: 'params-mag', label: 'Magnification', unit: 'x' });
    this.addReadout({ id: 'params-fov', label: 'Horizontal FOV', unit: 'deg' });
  }

  render(): void {
    super.render();
    drawLabel(this.ctx, 'Key parameters panel', this.canvas.width / 2, 40);
  }
}
