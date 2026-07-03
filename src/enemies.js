import { ENEMY } from './constants.js';
import { moveAndCollide } from './world.js';

export function inCone(cone, x, y) {
  const dx = x - cone.x, dy = y - cone.y;
  const d = Math.hypot(dx, dy);
  if (d > cone.reach) return false;
  let da = Math.atan2(dy, dx) - cone.angle;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) <= cone.spread;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
const prect = p => ({ x: p.x, y: p.y, w: p.w, h: p.h });

export class Jellyfish {
  constructor(x, y) {
    this.x = x - 7; this.y = y - 8; this.w = 14; this.h = 12;
    this.hp = ENEMY.JELLY.HP; this.dead = false;
    this.oy = y; this.t = Math.random() * 6;
  }
  rect() { return this; }
  takeDamage(n) { this.hp -= n; if (this.hp <= 0) this.dead = true; }
  update(dt, world, player) {
    this.t += dt;
    this.y = this.oy - 8 + Math.sin(this.t * ENEMY.JELLY.SPD / 14) * 28;
    if (!player.dead && overlaps(this, prect(player))) {
      if (player.damage(ENEMY.JELLY.DMG, this.x)) player.slow = 0.8;
    }
  }
}

export class Moray {
  constructor(x, y, dir) {
    this.hx = x; this.hy = y; this.dir = dir;
    this.x = x - 6; this.y = y - 5; this.w = 22; this.h = 10;
    this.vx = 0; this.vy = 0;
    this.hp = ENEMY.MORAY.HP; this.dead = false;
    this.state = 'hidden'; this.timer = 0;
  }
  rect() { return this; }
  takeDamage(n) {
    if (this.state === 'hidden') return; // safe in hole
    this.hp -= n; if (this.hp <= 0) this.dead = true;
  }
  update(dt, world, player) {
    const E = ENEMY.MORAY;
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    if (this.state === 'hidden') {
      const cone = { x: this.hx, y: this.hy, angle: Math.atan2(this.dir.y, this.dir.x), spread: 1.05, reach: E.TRIGGER };
      if (!player.dead && inCone(cone, pcx, pcy)) {
        this.state = 'lunge'; this.timer = E.LUNGE_TIME;
        this.vx = this.dir.x * E.LUNGE_SPD; this.vy = this.dir.y * E.LUNGE_SPD;
      }
    } else if (this.state === 'lunge') {
      this.timer -= dt;
      // Amendment: direct position integration avoids moveAndCollide jamming the
      // moray on its own HOLE tile (which is solid) during the lunge.
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      if (!player.dead && overlaps(this, prect(player))) player.damage(E.DMG, this.x);
      if (this.timer <= 0) { this.state = 'recover'; this.timer = E.RECOVER; }
    } else { // recover: ease back to hole
      this.timer -= dt;
      this.x += (this.hx - 6 - this.x) * 3 * dt;
      this.y += (this.hy - 5 - this.y) * 3 * dt;
      if (this.timer <= 0) { this.state = 'hidden'; this.x = this.hx - 6; this.y = this.hy - 5; }
    }
  }
}

export class Fish {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 8; this.h = 5;
    this.vx = 0; this.vy = 0;
    this.hp = ENEMY.FISH.HP; this.dead = false;
    this.aggro = false; this.calm = 0; this.turn = 0;
    this.dir = Math.random() * Math.PI * 2;
  }
  rect() { return this; }
  takeDamage(n) { this.hp -= n; if (this.hp <= 0) this.dead = true; }
  update(dt, world, player, lampCone) {
    const E = ENEMY.FISH;
    const cx = this.x + 4, cy = this.y + 2;
    if (!player.dead && lampCone && inCone(lampCone, cx, cy)) {
      this.aggro = true; this.calm = E.CALM_TIME;
    } else if (this.aggro) {
      this.calm -= dt;
      if (this.calm <= 0) this.aggro = false;
    }
    if (this.aggro && !player.dead) {
      const a = Math.atan2(player.y + player.h / 2 - cy, player.x + player.w / 2 - cx);
      this.vx += (Math.cos(a) * E.CHASE_SPD - this.vx) * 4 * dt;
      this.vy += (Math.sin(a) * E.CHASE_SPD - this.vy) * 4 * dt;
    } else {
      this.turn -= dt;
      if (this.turn <= 0) { this.turn = 1 + Math.random() * 2; this.dir = Math.random() * Math.PI * 2; }
      this.vx += (Math.cos(this.dir) * E.WANDER_SPD - this.vx) * 2 * dt;
      this.vy += (Math.sin(this.dir) * E.WANDER_SPD - this.vy) * 2 * dt;
    }
    const r = moveAndCollide(world, this, dt);
    if (r.hitX || r.hitY) this.dir += Math.PI / 2 + Math.random();
    if (!player.dead && overlaps(this, prect(player))) player.damage(E.DMG, this.x);
  }
}
