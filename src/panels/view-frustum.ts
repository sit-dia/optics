import { drawLabel } from '../canvas-utils';
import { BasePanel } from '../ui-controls';

export class ViewFrustumPanel extends BasePanel {
  constructor(container: HTMLElement) {
    super(container);
    this.addSlider({
      id: 'frustum-ipd',
      label: 'IPD (mm)',
      min: 52,
      max: 78,
      step: 1,
      value: 63,
      unit: 'mm',
    });
    this.addSlider({
      id: 'frustum-near',
      label: 'Near Plane (m)',
      min: 0.01,
      max: 0.5,
      step: 0.01,
      value: 0.06,
      unit: 'm',
    });
    this.addSlider({
      id: 'frustum-far',
      label: 'Far Plane (m)',
      min: 0.5,
      max: 100,
      step: 0.1,
      value: 1.56,
      unit: 'm',
    });
    this.addSlider({
      id: 'frustum-eye-relief',
      label: 'Eye Relief (mm)',
      min: 8,
      max: 25,
      step: 1,
      value: 18,
      unit: 'mm',
    });
  }

  render(): void {
    super.render();
    drawLabel(this.ctx, 'View frustum panel', this.canvas.width / 2, 40);
  }
}
