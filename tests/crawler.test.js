import test from 'node:test';
import assert from 'node:assert/strict';
import { Crawler } from '../src/crawler.js';
import { parseMap } from '../src/world.js';
import { Player } from '../src/player.js';
import { CRAWLER } from '../src/constants.js';

// wide flat chamber: 20x6 tiles
const world = parseMap([
  '####################',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####################',
]);

test('patrol walks and flips direction at walls', () => {
  const c = new Crawler(160, 56);
  const far = new Player(1000, 1000); // out of range
  const d0 = c.dir;
  let flipped = false;
  for (let i = 0; i < 60 * 8; i++) {
    c.update(1 / 60, world, far);
    if (c.dir !== d0) flipped = true;
  }
  assert.equal(c.state, 'patrol');
  assert.ok(flipped, 'hit a wall and flipped direction within 8s');
  assert.ok(c.x >= 16 && c.x + c.w <= 304, 'stays inside room');
});

test('telegraph then lunge when player is near above-floor', () => {
  const c = new Crawler(160, 56);
  const p = new Player(200, 40); // within 120px horizontal, above
  c.update(1 / 60, world, p);
  assert.equal(c.state, 'telegraph');
  for (let i = 0; i < 40; i++) c.update(1 / 60, world, p); // > TELEGRAPH 0.5s
  assert.equal(c.state, 'lunge');
});

test('steam fires on cooldown and exposes damage rect', () => {
  const c = new Crawler(160, 56);
  const far = new Player(1000, 1000);
  c.steamCd = 0; // force immediate steam
  c.update(1 / 60, world, far);
  assert.ok(c.steamT > 0);
  const r = c.steamRect();
  assert.ok(r && r.h === 48 && r.y < c.y, 'column rises above body');
});

test('dies at 0 hp and reset restores spawn state', () => {
  const c = new Crawler(160, 56);
  c.takeDamage(CRAWLER.HP);
  assert.equal(c.dead, true);
  c.reset();
  assert.equal(c.dead, false);
  assert.equal(c.hp, CRAWLER.HP);
  assert.equal(c.state, 'patrol');
});
