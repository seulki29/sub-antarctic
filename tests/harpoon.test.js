import test from 'node:test';
import assert from 'node:assert/strict';
import { Harpoons } from '../src/harpoon.js';
import { parseMap } from '../src/world.js';

const world = parseMap(['######', '#....#', '#....#', '######']);

test('fires respecting cooldown', () => {
  const h = new Harpoons();
  const cd = { fireCd: 0 };
  assert.equal(h.tryFire(24, 24, { x: 1, y: 0 }, 320, 1, cd), true);
  assert.ok(cd.fireCd > 0);
  assert.equal(h.tryFire(24, 24, { x: 1, y: 0 }, 320, 1, cd), false);
  assert.equal(h.list.length, 1);
});

test('harpoon sticks to wall then dies', () => {
  const h = new Harpoons();
  h.tryFire(24, 24, { x: 1, y: 0 }, 320, 1, { fireCd: 0 });
  for (let i = 0; i < 30; i++) h.update(1 / 60, world);
  assert.ok(h.list[0]?.stuck || h.list.length === 0);
  for (let i = 0; i < 30; i++) h.update(1 / 60, world);
  assert.equal(h.list.length, 0);
});

test('hitTest returns overlapping harpoon', () => {
  const h = new Harpoons();
  h.tryFire(24, 24, { x: 1, y: 0 }, 320, 2, { fireCd: 0 });
  h.update(1 / 60, world);
  const hit = h.hitTest({ x: 20, y: 20, w: 20, h: 10 });
  assert.ok(hit);
  assert.equal(hit.dmg, 2);
});
