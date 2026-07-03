import { BOSS as B } from './constants.js';
import { moveAndCollide } from './world.js';

export class Angler {
  constructor(x, y) {
    this.w = B.W; this.h = B.H;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = 0; this.vy = 0;
    this.hp = B.HP; this.dead = false;
    this.state = 'idle'; this.timer = B.IDLE_TIME;
    this.facing = -1; // sprite faces left
    this.flash = false;
    this._chargeDir = { x: -1, y: 0 };
  }

  phase2() { return this.hp <= B.HP * B.PHASE2_AT; }
  rect() { return { x: this.x + 10, y: this.y + 8, w: this.w - 20, h: this.h - 16 }; }
  lure() {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    return { x: cx + this.facing * 42, y: cy - 34 };
  }
  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  update(dt, world, player, onSummon) {
    if (this.dead) return;
    const p2 = this.phase2();
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    this.facing = pcx < cx ? -1 : 1;
    this.timer -= dt;
    this.flash = false;

    switch (this.state) {
      case 'idle': {
        // drift toward player slowly
        this.vx += Math.sign(pcx - cx) * 20 * dt;
        this.vy += Math.sign(pcy - cy) * 20 * dt;
        this.vx *= 0.98; this.vy *= 0.98;
        moveAndCollide(world, this, dt);
        if (this.timer <= 0) {
          if (Math.random() < 0.35) { this.state = 'summon'; this.timer = 0.5; }
          else { this.state = 'telegraph'; this.timer = B.TELEGRAPH; }
        }
        break;
      }
      case 'telegraph': {
        this.flash = Math.floor(this.timer * 10) % 2 === 0;
        this.vx = this.vy = 0;
        if (this.timer <= 0) {
          const d = Math.hypot(pcx - cx, pcy - cy) || 1;
          this._chargeDir = { x: (pcx - cx) / d, y: (pcy - cy) / d };
          this.state = 'charge';
          this.timer = 2.5; // safety cap
        }
        break;
      }
      case 'charge': {
        const spd = B.CHARGE_SPD * (p2 ? 1.25 : 1);
        this.vx = this._chargeDir.x * spd;
        this.vy = this._chargeDir.y * spd;
        const r = moveAndCollide(world, this, dt);
        if (r.hitX || r.hitY || this.timer <= 0) { this.state = 'stun'; this.timer = B.STUN; }
        break;
      }
      case 'stun': {
        this.vx = this.vy = 0;
        if (this.timer <= 0) { this.state = 'idle'; this.timer = B.IDLE_TIME * (p2 ? 0.6 : 1); }
        break;
      }
      case 'summon': {
        if (this.timer <= 0) {
          for (let i = 0; i < B.SUMMON_COUNT + (p2 ? 1 : 0); i++)
            onSummon(cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 40);
          this.state = 'idle'; this.timer = B.IDLE_TIME * (p2 ? 0.6 : 1);
        }
        break;
      }
    }

    // contact damage
    const r = this.rect();
    if (!player.dead &&
        player.x < r.x + r.w && player.x + player.w > r.x &&
        player.y < r.y + r.h && player.y + player.h > r.y)
      player.damage(B.CONTACT_DMG, cx);
  }
}
