import test from 'node:test';
import assert from 'node:assert/strict';
import { inCone, Moray, Fish } from '../src/enemies.js';
import { parseMap } from '../src/world.js';
import { Player } from '../src/player.js';

const world = parseMap([
  '##########',
  '#........#',
  '#........#',
  '#........#',
  '##########',
]);

test('inCone respects reach and spread', () => {
  const cone = { x: 0, y: 0, angle: 0, spread: 0.5, reach: 100 };
  assert.equal(inCone(cone, 50, 0), true);
  assert.equal(inCone(cone, 150, 0), false);   // too far
  assert.equal(inCone(cone, 0, 50), false);    // 90° off
  assert.equal(inCone(cone, 50, 10), true);
});

test('moray lunges when player in front, then recovers', () => {
  const m = new Moray(32, 32, { x: 1, y: 0 });
  const p = new Player(60, 28); // in front, within 60px
  assert.equal(m.state, 'hidden');
  m.update(1 / 60, world, p);
  assert.equal(m.state, 'lunge');
  p.x = 120; // move player out of trigger range so it can settle back to hidden
  for (let i = 0; i < 40; i++) m.update(1 / 60, world, p); // > LUNGE_TIME
  assert.equal(m.state, 'recover');
  for (let i = 0; i < 90; i++) m.update(1 / 60, world, p); // > RECOVER
  assert.equal(m.state, 'hidden');
});

test('fish aggros in lamp cone, calms after timeout', () => {
  const f = new Fish(80, 32);
  const p = new Player(30, 28);
  const coneOn = { x: 30, y: 32, angle: 0, spread: 0.6, reach: 150 };
  f.update(1 / 60, world, p, coneOn);
  assert.equal(f.aggro, true);
  // lamp off entirely (null cone) — fish chases past player, any fixed cone could re-catch it
  for (let i = 0; i < 200; i++) f.update(1 / 60, world, p, null); // > CALM_TIME
  assert.equal(f.aggro, false);
});
