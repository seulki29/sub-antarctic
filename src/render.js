import { VIEW_W, VIEW_H, TILE } from './constants.js';
import { T } from './world.js';

export class Camera {
  constructor() { this.x = 0; this.y = 0; }
  update(dt, tx, ty, world) {
    const gx = tx - VIEW_W / 2, gy = ty - VIEW_H / 2;
    const k = 1 - Math.exp(-8 * dt);
    this.x += (gx - this.x) * k;
    this.y += (gy - this.y) * k;
    this.x = Math.max(0, Math.min(world.w * TILE - VIEW_W, this.x));
    this.y = Math.max(0, Math.min(world.h * TILE - VIEW_H, this.y));
  }
}

const RAMP = ['#1c3464', '#12244c', '#0d1838', '#080e24', '#060918', '#04050e'];

export function drawBackground(ctx, cam, world) {
  const worldH = world.h * TILE;
  const grad = ctx.createLinearGradient(0, -cam.y, 0, worldH - cam.y);
  RAMP.forEach((c, i) => grad.addColorStop(i / (RAMP.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawParallax(ctx, cam, worldH);
}

let ridgeFar = null, ridgeMid = null;
function bakeRidge(seed, amp, color) {
  const c = document.createElement('canvas');
  c.width = 960; c.height = 120;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, 120);
  for (let x = 0; x <= 960; x += 4) {
    const y = 60 + Math.sin(x * 0.011 + seed) * amp + Math.sin(x * 0.037 + seed * 2) * amp * 0.4;
    g.lineTo(x, y);
  }
  g.lineTo(960, 120); g.closePath(); g.fill();
  return c;
}

function drawParallax(ctx, cam, worldH) {
  ridgeFar ??= bakeRidge(1.7, 22, 'rgba(14,22,48,0.55)');
  ridgeMid ??= bakeRidge(4.2, 30, 'rgba(9,14,32,0.7)');
  for (const [img, fx, fy, yoff] of [[ridgeFar, 0.25, 0.1, 110], [ridgeMid, 0.5, 0.2, 170]]) {
    const ox = -((cam.x * fx) % img.width);
    const oy = yoff - cam.y * fy;
    ctx.drawImage(img, ox, oy);
    ctx.drawImage(img, ox + img.width, oy);
  }
}

export function drawTiles(ctx, cam, world, S) {
  const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + VIEW_W) / TILE);
  const y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + VIEW_H) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) continue;
      const t = world.tiles[ty * world.w + tx];
      const sx = Math.round(tx * TILE - cam.x), sy = Math.round(ty * TILE - cam.y);
      if (t === T.ROCK || t === T.HOLE)
        ctx.drawImage(S.rock[(tx * 7 + ty * 13) % 4], sx, sy);
      else if (t === T.GATE && world.gateClosed) {
        ctx.fillStyle = '#28425a';
        ctx.fillRect(sx + 5, sy, 6, TILE);
      }
      if (t === T.HOLE) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(sx + 3, sy + 3, 10, 10);
      }
    }
  }
}

export function drawDecor(ctx, cam, world, time) {
  for (const d of world.decor) {
    const sx = Math.round(d.x - cam.x), sy = Math.round(d.y - cam.y);
    if (sx < -8 || sx > VIEW_W + 8 || sy < -40 || sy > VIEW_H + 8) continue;
    if (d.type === 'kelp') {
      ctx.strokeStyle = '#16424e';
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const h = 14 + (d.x % 12);
      const swayX = sx + Math.sin(time * 1.3 + d.x) * 2;
      ctx.quadraticCurveTo(sx, sy - h / 2, swayX, sy - h);
      ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.fillRect(Math.round(swayX), Math.round(sy - h) - 1, 1, 1);
    } else {
      ctx.fillStyle = '#1c2a3a';
      ctx.fillRect(sx - 1, sy - 3, 3, 3);
      ctx.fillStyle = d.color;
      ctx.fillRect(sx, sy - 4, 1, 1);
    }
  }
}
