import { PLAYER as P } from './constants.js';
import { rectHitsSolid } from './world.js';

export class Harpoons {
  constructor() { this.list = []; }

  tryFire(x, y, aim, speed, dmg, cdRef) {
    if (cdRef.fireCd > 0) return false;
    cdRef.fireCd = P.FIRE_CD;
    this.list.push({ x, y, vx: aim.x * speed, vy: aim.y * speed, dmg, dead: false, stuck: 0 });
    return true;
  }

  update(dt, world) {
    for (const h of this.list) {
      if (h.stuck > 0) {
        h.stuck -= dt;
        if (h.stuck <= 0) h.dead = true;
        continue;
      }
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (rectHitsSolid(world, h.x - 1, h.y - 1, 2, 2)) {
        h.stuck = 0.3; h.vx = h.vy = 0;
      }
    }
    this.list = this.list.filter(h => !h.dead);
  }

  hitTest(r) {
    for (const h of this.list) {
      if (h.dead || h.stuck > 0) continue;
      if (h.x > r.x && h.x < r.x + r.w && h.y > r.y && h.y < r.y + r.h) return h;
    }
    return null;
  }

  draw(ctx, cam) {
    for (const h of this.list) {
      const x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y);
      const a = Math.atan2(h.vy, h.vx);
      ctx.strokeStyle = '#aab8c6';
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = '#e0e8ee';
      ctx.fillRect(x, y, 2, 1);
    }
  }
}
