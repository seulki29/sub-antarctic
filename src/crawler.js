import { CRAWLER as C, STEAM } from './constants.js';
import { moveAndCollide } from './world.js';

// floor-crawling hydrothermal midboss
export class Crawler {
  constructor(x, y) {
    this.spawnX = x; this.spawnY = y;
    this.w = C.W; this.h = C.H;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = 0; this.vy = 0;
    this.hp = C.HP; this.dead = false;
    this.state = 'patrol'; this.timer = 0;
    this.dir = 1; this.facing = 1;
    this.steamCd = C.STEAM_CD_MIN;
    this.steamT = 0;
    this._lungeDir = 1;
  }

  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  reset() {
    this.hp = C.HP; this.dead = false;
    this.state = 'patrol'; this.timer = 0;
    this.vx = this.vy = 0;
    this.x = this.spawnX - this.w / 2; this.y = this.spawnY - this.h / 2;
    this.steamT = 0; this.steamCd = C.STEAM_CD_MIN;
  }

  steamRect() {
    if (this.steamT <= 0) return null;
    return { x: this.x + this.w / 2 - STEAM.COLUMN_W / 2, y: this.y - STEAM.COLUMN_H, w: STEAM.COLUMN_W, h: STEAM.COLUMN_H };
  }

  update(dt, world, player) {
    if (this.dead) return;
    this.timer -= dt;
    this.steamCd -= dt;
    this.steamT = Math.max(0, this.steamT - dt);
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    this.facing = pcx < cx ? -1 : 1;
    this.vy += C.GRAVITY * dt; // stick to the floor

    switch (this.state) {
      case 'patrol': {
        this.vx = this.dir * C.PATROL_SPD;
        const near = !player.dead && Math.abs(pcx - cx) < 120 &&
          (cy - pcy) < 80 && (cy - pcy) > -40;
        if (near) {
          this.state = 'telegraph'; this.timer = C.TELEGRAPH;
          this._lungeDir = Math.sign(pcx - cx) || 1;
        } else if (this.steamCd <= 0) {
          this.steamT = STEAM.ERUPT;
          this.steamCd = C.STEAM_CD_MIN + Math.random() * (C.STEAM_CD_MAX - C.STEAM_CD_MIN);
        }
        break;
      }
      case 'telegraph': {
        this.vx = 0;
        if (this.timer <= 0) { this.state = 'lunge'; this.timer = C.LUNGE_TIME; }
        break;
      }
      case 'lunge': {
        this.vx = this._lungeDir * C.LUNGE_SPD;
        if (this.timer <= 0) this.state = 'patrol';
        break;
      }
    }

    const r = moveAndCollide(world, this, dt);
    if (r.hitX) {
      this.dir *= -1;
      if (this.state === 'lunge') this.state = 'patrol';
    }

    const overlaps = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const prect = { x: player.x, y: player.y, w: player.w, h: player.h };
    if (!player.dead && overlaps(this.rect(), prect)) player.damage(C.CONTACT_DMG, cx);
    const s = this.steamRect();
    if (s && !player.dead && overlaps(s, prect)) player.damage(1, cx);
  }
}
