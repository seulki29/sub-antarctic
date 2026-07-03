import test from 'node:test';
import assert from 'node:assert/strict';
import { T, parseMap, isSolid, moveAndCollide, rectHitsSolid, setGate } from '../src/world.js';

const SMALL = [
  '#####',
  '#..V#',
  '#.C.#',
  '#B..#',
  '#####',
];

test('parseMap sizes and entities', () => {
  const w = parseMap(SMALL);
  assert.equal(w.w, 5);
  assert.equal(w.h, 5);
  assert.equal(w.vents.length, 1);
  assert.equal(w.nodes.length, 1);
  assert.equal(w.nodes[0].hp, 2);
  assert.deepEqual(w.base, { x: 1 * 16 + 8, y: 3 * 16 + 8 });
});

test('isSolid: rock, bounds, water', () => {
  const w = parseMap(SMALL);
  assert.equal(isSolid(w, 0, 0), true);   // rock
  assert.equal(isSolid(w, 1, 1), false);  // water
  assert.equal(isSolid(w, -1, 2), true);  // out of bounds
  assert.equal(isSolid(w, 2, 99), true);
});

test('moveAndCollide clamps into wall and zeroes velocity', () => {
  // NOTE: fixed-timestep steps only — single big dt would tunnel (by design;
  // game speeds are capped well below TILE/DT)
  const w = parseMap(SMALL);
  const e = { x: 20, y: 20, w: 10, h: 8, vx: 200, vy: 0 };
  let hit = false;
  for (let i = 0; i < 60; i++) hit = moveAndCollide(w, e, 1 / 60).hitX || hit;
  assert.equal(hit, true);
  assert.equal(e.vx, 0);
  assert.ok(e.x + e.w <= 4 * 16); // stopped before right wall
});

test('gate toggles solidity', () => {
  const rows = ['#####', '#.G.#', '#####'];
  const w = parseMap(rows);
  assert.equal(isSolid(w, 2, 1), false);
  setGate(w, true);
  assert.equal(isSolid(w, 2, 1), true);
  assert.equal(rectHitsSolid(w, 33, 17, 10, 10), true);
});
