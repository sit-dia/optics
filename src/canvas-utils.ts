import type { ArrowOpts, LabelOpts, LensOpts, LineOpts, Point, RayOpts } from './types';

const DEFAULT_FONT = '12px "Space Grotesk", system-ui, sans-serif';

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: ArrowOpts = {}
): void {
  const { color = '#eaeaea', width = 2, headSize = 8 } = opts;
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(
    x2 - headSize * Math.cos(angle - Math.PI / 6),
    y2 - headSize * Math.sin(angle - Math.PI / 6)
  );
  ctx.lineTo(
    x2 - headSize * Math.cos(angle + Math.PI / 6),
    y2 - headSize * Math.sin(angle + Math.PI / 6)
  );
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
}

export function drawLens(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  height: number,
  opts: LensOpts = {}
): void {
  const { color = '#ffd700', width = 2 } = opts;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(cx, cy - height / 2);
  ctx.lineTo(cx, cy + height / 2);
  ctx.stroke();
  drawArrow(ctx, cx, cy - height / 2, cx, cy - height / 2 - 12, {
    color,
    width,
    headSize: 6,
  });
  drawArrow(ctx, cx, cy + height / 2, cx, cy + height / 2 + 12, {
    color,
    width,
    headSize: 6,
  });
  ctx.restore();
}

export function drawDashedLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  opts: LineOpts = {}
): void {
  const { color = '#888888', width = 1, dash = [6, 6] } = opts;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

export function drawAngleArc(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  label: string,
  color = '#eaeaea'
): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, startAngle, endAngle);
  ctx.stroke();
  const mid = (startAngle + endAngle) / 2;
  drawLabel(
    ctx,
    label,
    cx + Math.cos(mid) * (radius + 10),
    cy + Math.sin(mid) * (radius + 10)
  );
  ctx.restore();
}

export function drawEye(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  rotation = 0
): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);
  ctx.strokeStyle = '#eaeaea';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#11121d';
  ctx.beginPath();
  ctx.arc(radius * 0.2, 0, radius * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawDisplay(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number
): void {
  ctx.save();
  ctx.fillStyle = 'rgba(179, 157, 219, 0.35)';
  ctx.strokeStyle = '#b39ddb';
  ctx.lineWidth = 2;
  ctx.fillRect(x, y, width, height);
  ctx.strokeRect(x, y, width, height);
  ctx.restore();
}

export function drawDimension(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  label: string,
  offset = 12
): void {
  ctx.save();
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len === 0) return;
  const nx = -dy / len;
  const ny = dx / len;
  const ox = nx * offset;
  const oy = ny * offset;
  ctx.beginPath();
  ctx.moveTo(x1 + ox, y1 + oy);
  ctx.lineTo(x2 + ox, y2 + oy);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x1 + ox, y1 + oy);
  ctx.lineTo(x1 + ox + nx * 6, y1 + oy + ny * 6);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2 + ox, y2 + oy);
  ctx.lineTo(x2 + ox + nx * 6, y2 + oy + ny * 6);
  ctx.stroke();
  drawLabel(ctx, label, (x1 + x2) / 2 + ox, (y1 + y2) / 2 + oy);
  ctx.restore();
}

export function drawRay(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  opts: RayOpts = {}
): void {
  const { color = '#4da6ff', width = 2, dash, glow } = opts;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  if (dash) {
    ctx.setLineDash(dash);
  }
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = 8;
  }
  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) {
      ctx.moveTo(point.x, point.y);
    } else {
      ctx.lineTo(point.x, point.y);
    }
  });
  ctx.stroke();
  ctx.restore();
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  rows: number,
  cols: number,
  transform?: (x: number, y: number) => { x: number; y: number }
): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.strokeStyle = '#444444';
  ctx.lineWidth = 1;
  for (let r = 0; r <= rows; r += 1) {
    const y = (r / rows) * height;
    ctx.beginPath();
    for (let c = 0; c <= cols; c += 1) {
      const x = (c / cols) * width;
      const pt = transform ? transform(x, y) : { x, y };
      if (c === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
  }
  for (let c = 0; c <= cols; c += 1) {
    const x = (c / cols) * width;
    ctx.beginPath();
    for (let r = 0; r <= rows; r += 1) {
      const y = (r / rows) * height;
      const pt = transform ? transform(x, y) : { x, y };
      if (r === 0) {
        ctx.moveTo(pt.x, pt.y);
      } else {
        ctx.lineTo(pt.x, pt.y);
      }
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function drawLabel(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  opts: LabelOpts = {}
): void {
  const {
    color = '#eaeaea',
    background = 'rgba(0, 0, 0, 0.45)',
    padding = 4,
    font = DEFAULT_FONT,
  } = opts;
  ctx.save();
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const width = metrics.width + padding * 2;
  const height = 16 + padding;
  ctx.fillStyle = background;
  ctx.fillRect(x - width / 2, y - height / 2, width, height);
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1);
  ctx.restore();
}
