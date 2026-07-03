import { VIEW_W, VIEW_H, LIGHT, PLAYER as P, CRYSTALS_PER_NODE } from './constants.js';
import { Lighting, glow } from './lighting.js';
import { Particles } from './particles.js';
import { MAP_ROWS } from './map.js';
import { parseMap } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { bakeSprites } from './sprites.js';
import { Camera, drawBackground, drawTiles, drawDecor } from './render.js';
import { Harpoons } from './harpoon.js';
import { drawHud, drawBossBar, UpgradeMenu } from './hud.js';

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
    this.pickups = [];
    this.menu = new UpgradeMenu();
    this.atBase = false;
  }

  update(dt) {
    this.time += dt;
    this.input.setPlayerScreen(
      this.player.x + this.player.w / 2 - this.cam.x,
      this.player.y + this.player.h / 2 - this.cam.y);
    this.input.update();
    if (this.menu.open) {
      if (this.input.consumeClick())
        this.menu.click(this.input.pointer.x, this.input.pointer.y, this.player);
      return; // pause world while menu open
    }
    this.player.update(dt, this.input, this.world);

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
      this.player.setCheckpoint(this.world.base.x, this.world.base.y);
      this.menu.open = true;
    }

    if (this.input.firing) {
      const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
      if (this.harpoons.tryFire(px + this.input.aim.x * 12, py + this.input.aim.y * 12,
          this.input.aim, P.HARPOON_SPD, this.player.dmgValue(), this.player))
        this.particles.spawnBubble(px, py);
    }
    this.harpoons.update(dt, this.world);

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

    // lighting
    const L = this.lighting;
    L.begin(cam, world);
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const ang = Math.atan2(this.input.aim.y, this.input.aim.x);
    L.addCone(px, py, ang, LIGHT.LAMP_SPREAD, LIGHT.LAMP_REACH);
    L.addPoint(px, py, 30, '#ffeec2', 0.6);
    let decorLights = 0;
    for (const d of world.decor) {
      if (decorLights >= 6) break;
      if (Math.abs(d.x - px) < 260 && Math.abs(d.y - py) < 160) {
        L.addPoint(d.x, d.y - 3, 22, d.color, 0.35);
        decorLights++;
      }
    }
    for (const n of world.nodes)
      if (n.hp > 0 && Math.abs(n.x - px) < 260) L.addPoint(n.x, n.y, 18, '#5ae0e6', 0.4);
    L.addPoint(b.x, b.y, 44, '#9fd0e0', 0.5);
    L.apply(ctx);

    // emissive glows on top
    glow(ctx, cam, px + this.input.aim.x * 8, py + this.input.aim.y * 8, 6, '#fff4d0', 0.5);
    this.particles.draw(ctx, cam);
    drawHud(ctx, player);
    this.menu.draw(ctx, player);
  }
}
