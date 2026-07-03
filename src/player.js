import { PLAYER as P, UPGRADES } from './constants.js';
import { moveAndCollide } from './world.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = P.W; this.h = P.H;
    this.vx = 0; this.vy = 0;
    this.hp = P.HP_MAX; this.o2 = P.O2_MAX;
    this.invuln = 0; this.slow = 0;
    this.boostT = 0; this.boostCd = 0; this.fireCd = 0;
    this.facing = 1;
    this.carried = 0; this.banked = 0;
    this.upgrades = { tank: false, damage: false };
    this.checkpoint = { x, y };
    this.hasRelic = false;
    this.dead = false;
    this._o2HpTimer = 0;
  }

  o2Max() { return P.O2_MAX * (this.upgrades.tank ? 1.5 : 1); }
  dmgValue() { return P.HARPOON_DMG * (this.upgrades.damage ? 1.5 : 1); }

  update(dt, input, world) {
    const events = [];
    if (this.dead) return events;

    for (const k of ['invuln', 'slow', 'boostCd', 'fireCd']) this[k] = Math.max(0, this[k] - dt);

    // boost trigger
    if (input.boost && this.boostCd <= 0 && this.boostT <= 0 &&
        (input.move.x || input.move.y)) {
      this.boostT = P.BOOST_TIME;
      this.boostCd = P.BOOST_CD;
      this.o2 = Math.max(0, this.o2 - P.BOOST_O2);
      const len = Math.hypot(input.move.x, input.move.y) || 1;
      this.vx = input.move.x / len * P.BOOST_SPD;
      this.vy = input.move.y / len * P.BOOST_SPD;
    }
    this.boostT = Math.max(0, this.boostT - dt);

    // swim with inertia
    const slowMul = this.slow > 0 ? 0.5 : 1;
    if (this.boostT <= 0) {
      this.vx += input.move.x * P.ACCEL * slowMul * dt;
      this.vy += input.move.y * P.ACCEL * slowMul * dt;
      const spd = Math.hypot(this.vx, this.vy);
      if (spd > P.MAX_SPD) { this.vx *= P.MAX_SPD / spd; this.vy *= P.MAX_SPD / spd; }
    }
    this.vx -= this.vx * P.DRAG * dt;
    this.vy -= this.vy * P.DRAG * dt;
    moveAndCollide(world, this, dt);

    if (input.aim.x !== 0) this.facing = input.aim.x > 0 ? 1 : -1;

    // O2
    this.o2 = Math.max(0, this.o2 - P.O2_DRAIN * dt);
    if (this.o2 <= 0) {
      this._o2HpTimer += dt;
      while (this._o2HpTimer >= P.O2_EMPTY_HP_PERIOD) {
        this._o2HpTimer -= P.O2_EMPTY_HP_PERIOD;
        this.hp -= 1;
      }
    } else this._o2HpTimer = 0;

    if (this.hp <= 0) { this.die(); events.push('died'); }
    return events;
  }

  addO2(perSec, dt) { this.o2 = Math.min(this.o2Max(), this.o2 + perSec * dt); }

  damage(n, fromX = this.x) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= n;
    this.invuln = P.INVULN;
    this.vx = Math.sign(this.x - fromX || 1) * P.KNOCKBACK_VX;
    this.vy = P.KNOCKBACK_VY;
    return true;
  }

  pickupCrystal(n) { this.carried += n; }

  bank() {
    const amt = this.carried;
    this.banked += amt;
    this.carried = 0;
    this.o2 = this.o2Max();
    this.hp = P.HP_MAX;
    return amt;
  }

  buyUpgrade(key) {
    const u = UPGRADES[key];
    if (!u || this.upgrades[key] || this.banked < u.cost) return false;
    this.banked -= u.cost;
    this.upgrades[key] = true;
    if (key === 'tank') this.o2 = this.o2Max();
    return true;
  }

  setCheckpoint(x, y) { this.checkpoint = { x, y }; }

  die() {
    this.carried = 0;
    this.dead = true;
  }

  respawn() {
    this.dead = false;
    this.x = this.checkpoint.x; this.y = this.checkpoint.y;
    this.vx = this.vy = 0;
    this.hp = P.HP_MAX;
    this.o2 = this.o2Max();
    this.invuln = P.RESPAWN_INVULN;
    this.slow = this.boostT = this.boostCd = this.fireCd = 0;
    this._o2HpTimer = 0;
  }
}
