import { VIEW_W, VIEW_H } from './constants.js';
import { rectHitsSolid } from './world.js';

export class Particles {
  constructor() { this.list = []; this.motes = []; }

  spawnBubble(x, y, vy = -18) {
    this.list.push({ t: 'bub', x, y, vx: 0, vy, life: 3, r: Math.random() < 0.3 ? 2 : 1 });
  }
  spawnSpark(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 60;
      this.list.push({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, color });
    }
  }
  burst(x, y, color, n = 10) { this.spawnSpark(x, y, color, n); }

  update(dt, world, cam) {
    while (this.motes.length < 50) {
      this.motes.push({
        x: cam.x + Math.random() * VIEW_W, y: cam.y + Math.random() * VIEW_H,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
      });
    }
    for (const m of this.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x < cam.x - 8) m.x += VIEW_W + 16;
      if (m.x > cam.x + VIEW_W + 8) m.x -= VIEW_W + 16;
      if (m.y < cam.y - 8) m.y += VIEW_H + 16;
      if (m.y > cam.y + VIEW_H + 8) m.y -= VIEW_H + 16;
    }
    this.list = this.list.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t === 'bub') {
        p.x += Math.sin(p.y * 0.1) * 6 * dt;
        if (rectHitsSolid(world, p.x, p.y, 1, 1)) return false;
      }
      return p.life > 0;
    });
  }

  draw(ctx, cam) {
    ctx.fillStyle = 'rgba(150,190,220,0.25)';
    for (const m of this.motes)
      ctx.fillRect(Math.round(m.x - cam.x), Math.round(m.y - cam.y), 1, 1);
    for (const p of this.list) {
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
      if (p.t === 'bub') {
        ctx.strokeStyle = 'rgba(180,220,240,0.5)';
        ctx.strokeRect(x - p.r, y - p.r, p.r * 2, p.r * 2);
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / 0.35);
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha = 1;
      }
    }
  }
}
