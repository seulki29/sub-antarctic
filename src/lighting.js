import { VIEW_W, VIEW_H, TILE, LIGHT } from './constants.js';

export class Lighting {
  constructor() {
    this.c = document.createElement('canvas');
    this.c.width = VIEW_W; this.c.height = VIEW_H;
    this.g = this.c.getContext('2d');
  }

  begin(cam, world, forcedDark = false) {
    if (this.c.width !== VIEW_W || this.c.height !== VIEW_H) {
      this.c.width = VIEW_W; this.c.height = VIEW_H; // follow adaptive view
    }
    this.cam = cam;
    this.count = 0;
    const g = this.g;
    g.globalCompositeOperation = 'source-over';
    if (forcedDark) {
      g.fillStyle = '#0a0a12';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      const worldH = world.h * TILE;
      const aTop = ambientAt(cam.y, worldH), aBot = ambientAt(cam.y + VIEW_H, worldH);
      const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, ambColor(aTop));
      grad.addColorStop(1, ambColor(aBot));
      g.fillStyle = grad;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    g.globalCompositeOperation = 'lighter';
  }

  addPoint(wx, wy, r, color = '#ffffff', a = 1) {
    if (this.count >= LIGHT.MAX) return;
    const x = wx - this.cam.x, y = wy - this.cam.y;
    if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) return;
    this.count++;
    const g = this.g;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a;
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }

  addCone(wx, wy, angle, spread, reach, color = '#ffeec2') {
    if (this.count >= LIGHT.MAX) return;
    this.count++;
    const g = this.g, x = wx - this.cam.x, y = wy - this.cam.y;
    g.save();
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, reach, angle - spread, angle + spread);
    g.closePath();
    g.clip();
    const grad = g.createRadialGradient(x, y, 4, x, y, reach);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - reach, y - reach, reach * 2, reach * 2);
    g.restore();
  }

  apply(ctx) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.c, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function ambientAt(worldY, worldH) {
  const t = Math.max(0, Math.min(1, worldY / worldH));
  return 0.75 - 0.63 * t; // 0.75 top → 0.12 bottom
}
function ambColor(a) {
  const r = Math.round(190 * a), g = Math.round(215 * a), b = Math.round(255 * a);
  return `rgb(${r},${g},${b})`;
}

export function glow(ctx, cam, wx, wy, r, color, a = 0.8) {
  const x = wx - cam.x, y = wy - cam.y;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
