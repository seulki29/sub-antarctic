import test from 'node:test';
import assert from 'node:assert/strict';
import { Player } from '../src/player.js';
import { parseMap } from '../src/world.js';
import { PLAYER, UPGRADES } from '../src/constants.js';

const openWorld = () => parseMap([
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '##########',
]);

const idle = { move: { x: 0, y: 0 }, aim: { x: 1, y: 0 }, firing: false, boost: false };

test('swim accelerates with inertia and drags to stop', () => {
  const p = new Player(40, 30);
  const w = openWorld();
  p.update(1 / 60, { ...idle, move: { x: 1, y: 0 } }, w);
  assert.ok(p.vx > 0);
  const v1 = p.vx;
  for (let i = 0; i < 120; i++) p.update(1 / 60, idle, w); // release
  assert.ok(Math.abs(p.vx) < v1);
});

test('O2 drains, empty O2 chips HP once per period', () => {
  const p = new Player(40, 30);
  const w = openWorld();
  p.o2 = 0.001;
  for (let i = 0; i < 130; i++) p.update(1 / 60, idle, w); // >2s at 0
  assert.equal(p.o2, 0);
  assert.ok(p.hp <= PLAYER.HP_MAX - 2);
});

test('damage respects invulnerability', () => {
  const p = new Player(40, 30);
  assert.equal(p.damage(1, 0), true);
  assert.equal(p.hp, PLAYER.HP_MAX - 1);
  assert.equal(p.damage(1, 0), false); // invuln active
  assert.equal(p.hp, PLAYER.HP_MAX - 1);
});

test('death loses carried, bank preserves', () => {
  const p = new Player(40, 30);
  p.pickupCrystal(5);
  p.bank();
  p.pickupCrystal(3);
  p.die();
  assert.equal(p.carried, 0);
  assert.equal(p.banked, 5);
  assert.equal(p.dead, true);
  p.respawn();
  assert.equal(p.dead, false);
  assert.equal(p.hp, PLAYER.HP_MAX);
});

test('upgrades cost and apply', () => {
  const p = new Player(40, 30);
  p.banked = UPGRADES.tank.cost;
  assert.equal(p.buyUpgrade('tank'), true);
  assert.equal(p.banked, 0);
  assert.equal(p.o2Max(), PLAYER.O2_MAX * 1.5);
  assert.equal(p.buyUpgrade('damage'), false); // can't afford
  p.banked = UPGRADES.damage.cost;
  assert.equal(p.buyUpgrade('damage'), true);
  assert.equal(p.dmgValue(), PLAYER.HARPOON_DMG * 1.5);
});
