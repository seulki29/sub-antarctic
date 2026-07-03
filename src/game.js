import { VIEW_W, VIEW_H, LIGHT, PLAYER as P } from './constants.js';
import { Lighting, glow } from './lighting.js';
import { Particles } from './particles.js';
import { MAP_ROWS } from './map.js';
import { parseMap } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { bakeSprites } from './sprites.js';
import { Camera, drawBackground, drawTiles, drawDecor } from './render.js';

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
  }

  update(dt) {
    this.time += dt;
    this.input.setPlayerScreen(
      this.player.x + this.player.w / 2 - this.cam.x,
      this.player.y + this.player.h / 2 - this.cam.y);
    this.input.update();
    this.player.update(dt, this.input, this.world);
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
    const spr = player.facing >= 0 ? S.diverR : S.diverL;
    const bob = Math.sin(this.time * 3) * 1;
    if (!(player.invuln > 0 && Math.floor(this.time * 12) % 2)) {
      ctx.drawImage(spr,
        Math.round(player.x - cam.x - 4),
        Math.round(player.y - cam.y - 1 + bob));
    }

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
    L.apply(ctx);

    // emissive glows on top
    glow(ctx, cam, px + this.input.aim.x * 8, py + this.input.aim.y * 8, 6, '#fff4d0', 0.5);
    this.particles.draw(ctx, cam);
  }
}
