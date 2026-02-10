export interface SliderConfig {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  unit?: string;
  onChange?: (value: number) => void;
}

export interface ReadoutConfig {
  id: string;
  label: string;
  unit?: string;
}

export class BasePanel {
  protected container: HTMLElement;
  protected canvas: HTMLCanvasElement;
  protected ctx: CanvasRenderingContext2D;
  protected controlsEl: HTMLElement;
  protected readoutsEl: HTMLElement;
  protected width = 0;
  protected height = 0;
  private resizeObserver: ResizeObserver;
  private rafId: number | null = null;
  private resizeTimer: number | null = null;

  constructor(container: HTMLElement) {
    this.container = container;
    const canvasHost = container.querySelector<HTMLElement>('[data-canvas]');
    const controlsHost = container.querySelector<HTMLElement>('[data-controls]');
    const readoutsHost = container.querySelector<HTMLElement>('[data-readouts]');
    if (!canvasHost || !controlsHost || !readoutsHost) {
      throw new Error('Panel container missing required elements');
    }
    this.controlsEl = controlsHost;
    this.readoutsEl = readoutsHost;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-label', 'Optics visualization');
    canvasHost.appendChild(this.canvas);
    const ctx = this.canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas context unavailable');
    }
    this.ctx = ctx;
    this.resizeObserver = new ResizeObserver(() => this.scheduleResize());
    this.resizeObserver.observe(canvasHost);
    this.resize();
  }

  private scheduleResize(): void {
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
    }
    this.resizeTimer = window.setTimeout(() => {
      this.resizeTimer = null;
      this.resize();
    }, 120);
  }

  protected resize(): void {
    const host = this.canvas.parentElement;
    if (!host) return;
    const styles = window.getComputedStyle(host);
    const paddingX =
      Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
    const paddingY =
      Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom);
    const contentWidth = Math.max(0, host.clientWidth - paddingX);
    const contentHeight = Math.max(0, host.clientHeight - paddingY);
    if (contentWidth === this.width && contentHeight === this.height) {
      return;
    }
    const scale = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(contentWidth * scale);
    this.canvas.height = Math.floor(contentHeight * scale);
    this.canvas.style.width = `${contentWidth}px`;
    this.canvas.style.height = `${contentHeight}px`;
    this.width = contentWidth;
    this.height = contentHeight;
    this.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    this.requestDraw();
  }

  protected requestDraw(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
    }
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null;
      this.render();
    });
  }

  protected addSlider(config: SliderConfig): HTMLInputElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'control-row';
    const label = document.createElement('label');
    label.htmlFor = config.id;
    label.textContent = config.label;
    const value = document.createElement('div');
    value.className = 'value';
    const input = document.createElement('input');
    input.id = config.id;
    input.type = 'range';
    input.min = String(config.min);
    input.max = String(config.max);
    input.step = String(config.step);
    input.value = String(config.value);
    const updateValue = (raw: string) => {
      const numeric = Number(raw);
      value.textContent = `${numeric}${config.unit ?? ''}`;
      config.onChange?.(numeric);
      this.requestDraw();
    };
    input.addEventListener('input', () => updateValue(input.value));
    updateValue(input.value);
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    wrapper.appendChild(value);
    this.controlsEl.appendChild(wrapper);
    return input;
  }

  protected addReadout(config: ReadoutConfig): HTMLElement {
    const readout = document.createElement('div');
    readout.className = 'readout';
    readout.dataset.readout = config.id;
    const label = document.createElement('span');
    label.textContent = config.label;
    const value = document.createElement('span');
    value.textContent = `--${config.unit ?? ''}`;
    readout.appendChild(label);
    readout.appendChild(value);
    this.readoutsEl.appendChild(readout);
    return value;
  }

  protected setReadout(id: string, value: string): void {
    const readout = this.readoutsEl.querySelector<HTMLElement>(
      `[data-readout="${id}"] span:last-child`
    );
    if (readout) {
      readout.textContent = value;
    }
  }

  protected clear(): void {
    this.ctx.clearRect(0, 0, this.width, this.height);
  }

  render(): void {
    this.clear();
    const { width, height } = this;
    this.ctx.fillStyle = '#101424';
    this.ctx.fillRect(0, 0, width, height);
    this.ctx.fillStyle = '#eaeaea';
    this.ctx.font = '14px "Space Grotesk", system-ui, sans-serif';
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText('Panel rendering...', width / 2, height / 2);
  }

  dispose(): void {
    this.resizeObserver.disconnect();
    if (this.resizeTimer !== null) {
      window.clearTimeout(this.resizeTimer);
      this.resizeTimer = null;
    }
  }
}
