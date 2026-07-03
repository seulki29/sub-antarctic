import { VIEW_W, VIEW_H, LIGHT, PLAYER as P, CRYSTALS_PER_NODE, ENEMY, BOSS } from './constants.js';
import { Jellyfish, Moray, Fish } from './enemies.js';
import { Angler } from './boss.js';
import { Lighting, glow } from './lighting.js';
import { Particles } from './particles.js';
import { MAP_ROWS } from './map.js';
import { parseMap, setGate } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { bakeSprites } from './sprites.js';
import { Camera, drawBackground, drawTiles, drawDecor } from './render.js';
import { Harpoons } from './harpoon.js';
import { drawHud, drawBossBar, UpgradeMenu, drawText, textWidth, drawSticks } from './hud.js';
import { sfx } from './audio.js';

export class GameScene {
  constructor(canvas) {
    this.world = parseMap(MAP_ROWS);
    this.S = bakeSprites();
    this.player = new Player(this.world.base.x, this.world.base.y);
    this.input = new Input();
    this.input.attach(canvas);
    this.cam = new Camera();
    this.time = 0;
    this.lighting = new Lighting();
    this.particles = new Particles();
    this.bubbleTimer = 0;
    this.harpoons = new Harpoons();
    this.enemies = [
      ...this.world.jelly.map(j => new Jellyfish(j.x, j.y)),
      ...this.world.holes.map(h => new Moray(h.x, h.y, h.dir)),
    ];
    for (const f of this.world.fishSpawns)
      for (let i = 0; i < ENEMY.FISH.PER_SCHOOL; i++)
        this.enemies.push(new Fish(f.x + (Math.random() - 0.5) * 30, f.y + (Math.random() - 0.5) * 20));
    this.pickups = [];
    this.menu = new UpgradeMenu();
    this.atBase = false;
    this.boss = this.world.angler ? new Angler(this.world.angler.x, this.world.angler.y) : null;
    this.bossActive = false;
    this.relicDropped = false;
    this.deathTimer = 0;
    this.onClear = null;
    this._lastHp = this.player.hp;
  }

  update(dt) {
    this.time += dt;
    this.input.setPlayerScreen(
      this.player.x + this.player.w / 2 - this.cam.x,
      this.player.y + this.player.h / 2 - this.cam.y);
    this.input.update();
    if (this.menu.open) {
      if (this.input.consumeClick()) {
        const r = this.menu.click(this.input.pointer.x, this.input.pointer.y, this.player);
        if (r === 'bought') sfx.buy(); else if (r === null) sfx.denied();
      }
      return; // pause world while menu open
    }
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.player.respawn();
        this._lastHp = this.player.hp;
        if (this.bossActive && this.boss && !this.boss.dead) {
          // reset boss fight
          setGate(this.world, false);
          this.bossActive = false;
          this.boss.hp = BOSS.HP;
          this.boss.state = 'idle';
          this.boss.timer = BOSS.IDLE_TIME;
          this.boss.vx = this.boss.vy = 0;
        }
      }
      return;
    }
    const evts = this.player.update(dt, this.input, this.world);
    if (evts.includes('died')) { this.deathTimer = 1.2; return; }

    const pcx = this.player.x + this.player.w / 2, pcy = this.player.y + this.player.h / 2;
    const near = (pt, r) => Math.abs(pt.x - pcx) < r && Math.abs(pt.y - pcy) < r;
    for (const v of this.world.vents)
      if (near(v, 20)) this.player.addO2(P.O2_VENT_REFILL, dt);
    for (const k of this.world.checkpoints)
      if (near(k, 16)) this.player.setCheckpoint(k.x, k.y);
    const wasAtBase = this.atBase;
    this.atBase = near(this.world.base, 24);
    if (this.atBase && !wasAtBase) {
      this.player.bank();
      sfx.bank();
      this.player.setCheckpoint(this.world.base.x, this.world.base.y);
      if (this.player.hasRelic && this.onClear) { this.onClear(); return; }
      this.menu.open = true;
    }

    if (this.input.firing) {
      const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
      if (this.harpoons.tryFire(px + this.input.aim.x * 12, py + this.input.aim.y * 12,
          this.input.aim, P.HARPOON_SPD, this.player.dmgValue(), this.player)) {
        this.particles.spawnBubble(px, py);
        sfx.shoot();
      }
    }
    this.harpoons.update(dt, this.world);

    const lampCone = {
      x: pcx, y: pcy,
      angle: Math.atan2(this.input.aim.y, this.input.aim.x),
      spread: LIGHT.LAMP_SPREAD, reach: LIGHT.LAMP_REACH,
    };
    for (const e of this.enemies) {
      e.update(dt, this.world, this.player, lampCone);
      const hit = this.harpoons.hitTest(e.rect());
      if (hit) {
        hit.dead = true;
        e.takeDamage(hit.dmg);
        this.particles.spawnSpark(e.x + e.w / 2, e.y + e.h / 2, '#ffb0a0');
        sfx.hit();
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);

    if (this.boss && !this.boss.dead) {
      const arena = {
        x: this.boss.x + this.boss.w / 2 - 170,
        y: this.boss.y + this.boss.h / 2 - 100,
        w: 440, h: 270,
      };
      if (!this.bossActive &&
          pcx > arena.x && pcx < arena.x + arena.w &&
          pcy > arena.y && pcy < arena.y + arena.h) {
        this.bossActive = true;
        setGate(this.world, true);
      }
      if (this.bossActive) {
        this.boss.update(dt, this.world, this.player,
          (x, y) => { const f = new Fish(x, y); f.aggro = true; f.calm = 99; this.enemies.push(f); });
        const hit = this.harpoons.hitTest(this.boss.rect());
        if (hit) {
          hit.dead = true;
          this.boss.takeDamage(hit.dmg);
          this.particles.spawnSpark(hit.x, hit.y, '#ffd0a0', 10);
          sfx.hit();
        }
        if (this.boss.dead) {
          sfx.boom();
          setGate(this.world, false);
          this.bossActive = false;
          if (!this.relicDropped) {
            this.relicDropped = true;
            this.pickups.push({ kind: 'relic', x: this.boss.x + this.boss.w / 2, y: this.boss.y + this.boss.h / 2, vx: 0, vy: -10, t: 0 });
          }
        }
      }
    }

    // crystal nodes
    for (const n of this.world.nodes) {
      if (n.hp <= 0) continue;
      const hit = this.harpoons.hitTest({ x: n.x - 8, y: n.y - 6, w: 16, h: 12 });
      if (hit) {
        hit.dead = true;
        n.hp -= 1;
        this.particles.spawnSpark(n.x, n.y, '#5ae0e6');
        if (n.hp <= 0) {
          for (let i = 0; i < CRYSTALS_PER_NODE; i++) {
            const a = Math.random() * Math.PI * 2;
            this.pickups.push({ kind: 'crystal', x: n.x, y: n.y,
              vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 15, t: 0 });
          }
        }
      }
    }

    // pickups drift & collect
    const pr = this.player;
    this.pickups = this.pickups.filter(pk => {
      pk.t += dt;
      pk.vx *= 0.95; pk.vy *= 0.95;
      pk.x += pk.vx * dt; pk.y += pk.vy * dt + Math.sin(pk.t * 3) * 0.15;
      if (!pr.dead && Math.abs(pk.x - pr.x - pr.w / 2) < 12 && Math.abs(pk.y - pr.y - pr.h / 2) < 10) {
        if (pk.kind === 'crystal') pr.pickupCrystal(1);
        else pr.hasRelic = true;
        this.particles.spawnSpark(pk.x, pk.y, '#b8f8fa');
        sfx.pickup();
        return false;
      }
      return true;
    });

    this.cam.update(dt, this.player.x + this.player.w / 2,
                    this.player.y + this.player.h / 2, this.world);
    this.particles.update(dt, this.world, this.cam);
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = 0.9 + Math.random() * 0.6;
      this.particles.spawnBubble(this.player.x + (this.player.facing > 0 ? 2 : this.player.w - 2), this.player.y);
      for (const v of this.world.vents)
        if (Math.abs(v.x - this.cam.x - 240) < 300) this.particles.spawnBubble(v.x, v.y - 6, -30);
    }
    if (this.player.hp < this._lastHp && !this.player.dead) sfx.hurt();
    this._lastHp = this.player.hp;
  }

  draw(ctx) {
    const { cam, world, S, player } = this;
    drawBackground(ctx, cam, world);
    drawDecor(ctx, cam, world, this.time);
    drawTiles(ctx, cam, world, S);
    // base submarine marker
    const b = world.base;
    ctx.fillStyle = '#3a5468';
    ctx.fillRect(Math.round(b.x - 14 - cam.x), Math.round(b.y - 6 - cam.y), 28, 12);
    ctx.fillStyle = '#78dceb';
    ctx.fillRect(Math.round(b.x + 6 - cam.x), Math.round(b.y - 3 - cam.y), 4, 4);
    const spr = player.facing >= 0 ? S.diverR : S.diverL;
    const bob = Math.sin(this.time * 3) * 1;
    if (!(player.invuln > 0 && Math.floor(this.time * 12) % 2)) {
      ctx.drawImage(spr,
        Math.round(player.x - cam.x - 4),
        Math.round(player.y - cam.y - 1 + bob));
    }

    for (const n of world.nodes)
      if (n.hp > 0)
        ctx.drawImage(S.node, Math.round(n.x - 8 - cam.x), Math.round(n.y - 5 - cam.y));
    for (const pk of this.pickups)
      ctx.drawImage(pk.kind === 'crystal' ? S.crystal : S.relic,
        Math.round(pk.x - 3 - cam.x), Math.round(pk.y - 4 - cam.y));
    this.harpoons.draw(ctx, cam);

    for (const e of this.enemies) {
      const ex = Math.round(e.x - cam.x), ey = Math.round(e.y - cam.y);
      if (e instanceof Jellyfish) ctx.drawImage(S.jelly, ex, ey);
      else if (e instanceof Moray) {
        if (e.state !== 'hidden') {
          if (e.dir.x < 0) {
            ctx.save(); ctx.translate(ex + 26, ey); ctx.scale(-1, 1);
            ctx.drawImage(S.moray, 0, 0); ctx.restore();
          } else ctx.drawImage(S.moray, ex, ey);
        }
      } else {
        if (e.vx < 0) {
          ctx.save(); ctx.translate(ex + 8, ey); ctx.scale(-1, 1);
          ctx.drawImage(S.fish, 0, 0); ctx.restore();
        } else ctx.drawImage(S.fish, ex, ey);
        if (e.aggro) { ctx.fillStyle = '#ff5050'; ctx.fillRect(ex + (e.vx < 0 ? 5 : 2), ey + 1, 1, 1); }
      }
    }

    if (this.boss && !this.boss.dead) {
      const bs = S.angler.canvas;
      const bx = Math.round(this.boss.x - 10 - cam.x), by = Math.round(this.boss.y - 13 - cam.y);
      if (this.boss.facing === 1) {
        ctx.save(); ctx.translate(bx + bs.width, by); ctx.scale(-1, 1);
        ctx.drawImage(bs, 0, 0); ctx.restore();
      } else ctx.drawImage(bs, bx, by);
    }

    // lighting
    const L = this.lighting;
    const dark = this.bossActive && this.boss && this.boss.phase2();
    L.begin(cam, world, dark);
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const ang = Math.atan2(this.input.aim.y, this.input.aim.x);
    L.addCone(px, py, ang, LIGHT.LAMP_SPREAD, LIGHT.LAMP_REACH);
    L.addPoint(px, py, 30, '#ffeec2', 0.6);
    if (this.boss && !this.boss.dead && this.bossActive) {
      const lu = this.boss.lure();
      const flick = this.boss.flash ? 0.4 : 1;
      L.addPoint(lu.x, lu.y, 90, '#d8ffa0', 0.9 * flick);
    }
    let decorLights = 0;
    for (const d of world.decor) {
      if (decorLights >= 6) break;
      if (Math.abs(d.x - px) < 260 && Math.abs(d.y - py) < 160) {
        L.addPoint(d.x, d.y - 3, 22, d.color, 0.35);
        decorLights++;
      }
    }
    for (const e of this.enemies)
      if (e instanceof Jellyfish && Math.abs(e.x - px) < 260)
        L.addPoint(e.x + 7, e.y + 5, 26, '#be8cff', 0.4);
    for (const n of world.nodes)
      if (n.hp > 0 && Math.abs(n.x - px) < 260) L.addPoint(n.x, n.y, 18, '#5ae0e6', 0.4);
    L.addPoint(b.x, b.y, 44, '#9fd0e0', 0.5);
    L.apply(ctx);

    // emissive glows on top
    glow(ctx, cam, px + this.input.aim.x * 8, py + this.input.aim.y * 8, 6, '#fff4d0', 0.5);
    if (this.boss && !this.boss.dead && this.bossActive) {
      const lu = this.boss.lure();
      glow(ctx, cam, lu.x, lu.y, 8, '#f0ffd0', this.boss.flash ? 0.4 : 0.9);
    }
    this.particles.draw(ctx, cam);
    drawHud(ctx, player);
    if (this.bossActive && this.boss && !this.boss.dead)
      drawBossBar(ctx, 'ABYSSAL ANGLER', this.boss.hp / BOSS.HP);
    this.menu.draw(ctx, player);
    drawSticks(ctx, this.input);
    if (this.deathTimer > 0) {
      ctx.fillStyle = `rgba(2,3,8,${Math.min(1, (1.2 - this.deathTimer) * 2)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(ctx, 'YOU DIED', (VIEW_W - textWidth('YOU DIED', 2)) / 2, 128, '#c04050', 2);
    }
  }
}
