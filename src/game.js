import { VIEW_W, VIEW_H } from './constants.js';
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
  }
}
