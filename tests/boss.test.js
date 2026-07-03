import test from 'node:test';
import assert from 'node:assert/strict';
import { Angler } from '../src/boss.js';
import { parseMap } from '../src/world.js';
import { Player } from '../src/player.js';
import { BOSS } from '../src/constants.js';

const world = parseMap([
  '####################',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####################',
]);

test('phase2 triggers at half HP', () => {
  const b = new Angler(160, 48);
  assert.equal(b.phase2(), false);
  b.takeDamage(BOSS.HP / 2);
  assert.equal(b.phase2(), true);
});

test('state machine: idle -> telegraph/summon -> back to idle', () => {
  const b = new Angler(160, 48);
  const p = new Player(40, 40);
  const summoned = [];
  let seen = new Set();
  for (let i = 0; i < 60 * 12; i++) {
    b.update(1 / 60, world, p, (x, y) => summoned.push({ x, y }));
    seen.add(b.state);
  }
  assert.ok(seen.has('telegraph') || seen.has('summon'));
  if (seen.has('charge')) assert.ok(seen.has('stun'));
});

test('dies at 0 hp', () => {
  const b = new Angler(160, 48);
  b.takeDamage(BOSS.HP);
  assert.equal(b.dead, true);
});
