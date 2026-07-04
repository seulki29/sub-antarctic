import test from 'node:test';
import assert from 'node:assert/strict';
import { T, parseMap, isSolid, moveAndCollide, rectHitsSolid, setGate, mineralForRow, applyDifficulty, steamPhase } from '../src/world.js';
import { DIFFICULTY, HYDRO_ROW } from '../src/constants.js';

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

test('mineralForRow zones', () => {
  assert.equal(mineralForRow(0), 'crystal');
  assert.equal(mineralForRow(17), 'crystal');
  assert.equal(mineralForRow(18), 'pearl');
  assert.equal(mineralForRow(39), 'pearl');
  assert.equal(mineralForRow(40), 'abyss');
});

test('parseMap assigns mineral kind by depth', () => {
  const w = parseMap(['####', '#C.#', '####']);
  assert.equal(w.nodes[0].kind, 'crystal');
});

test('applyDifficulty trims counts and keeps vent zone coverage', () => {
  const mkNodes = n => Array.from({ length: n }, (_, i) => ({ x: i * 100 + 8, y: 8, hp: 2, kind: 'crystal' }));
  const vents = [
    { x: 100, y: 5 * 16 }, { x: 800, y: 12 * 16 },   // upper
    { x: 300, y: 25 * 16 }, { x: 1200, y: 30 * 16 }, // mid
    { x: 500, y: 45 * 16 }, { x: 1500, y: 50 * 16 }, // deep
    { x: 900, y: 9 * 16 }, { x: 2000, y: 55 * 16 },
  ];
  const hard = { nodes: mkNodes(16), vents: [...vents] };
  applyDifficulty(hard, DIFFICULTY.hard);
  assert.equal(hard.nodes.length, 9);
  assert.equal(hard.vents.length, 3);
  const zone = v => { const ty = Math.floor(v.y / 16); return ty < 18 ? 0 : ty < 40 ? 1 : 2; };
  assert.equal(new Set(hard.vents.map(zone)).size, 3, 'one vent per zone on hard');
  const easy = { nodes: mkNodes(16), vents: [...vents] };
  applyDifficulty(easy, DIFFICULTY.easy);
  assert.equal(easy.nodes.length, 16);
  assert.equal(easy.vents.length, 8);
});

test('mineralForRow magma tier', () => {
  assert.equal(mineralForRow(67), 'abyss');
  assert.equal(mineralForRow(68), 'magma');
  assert.equal(mineralForRow(99), 'magma');
});

test('steamPhase cycles idle-telegraph-erupt with seed offset', () => {
  // seed 0: t=0 → idle; t=2.6 → telegraph; t=3.5 → erupt; t=4.6 → wraps to idle
  assert.equal(steamPhase(0, 0), 'idle');
  assert.equal(steamPhase(2.6, 0), 'telegraph');
  assert.equal(steamPhase(3.5, 0), 'erupt');
  assert.equal(steamPhase(4.6, 0), 'idle');
  // different seeds shift phase
  const a = steamPhase(1.0, 3), b = steamPhase(1.0, 50);
  assert.ok(['idle', 'telegraph', 'erupt'].includes(a));
  assert.ok(['idle', 'telegraph', 'erupt'].includes(b));
});

test('parseMap collects pressure, hydro vents and crawler; P is solid until hullOpen', () => {
  const w = parseMap(['#####', '#PHZ#', '#####']);
  assert.equal(w.pressure.length, 1);
  assert.equal(w.hydroVents.length, 1);
  assert.ok(w.crawler);
  assert.equal(isSolid(w, 1, 1), true);   // P closed
  w.hullOpen = true;
  assert.equal(isSolid(w, 1, 1), false);  // P open
  assert.equal(isSolid(w, 2, 1), false);  // H is water
});

test('applyDifficulty keeps magma nodes and deep vents fixed', () => {
  const nodes = [
    ...Array.from({ length: 16 }, (_, i) => ({ x: i * 100 + 8, y: 8, hp: 2, kind: 'crystal' })),
    { x: 50, y: 70 * 16, hp: 2, kind: 'magma' },
    { x: 900, y: 80 * 16, hp: 2, kind: 'magma' },
  ];
  const vents = [
    { x: 100, y: 5 * 16 }, { x: 800, y: 12 * 16 },
    { x: 300, y: 25 * 16 }, { x: 1200, y: 30 * 16 },
    { x: 500, y: 45 * 16 }, { x: 1500, y: 50 * 16 },
    { x: 900, y: 9 * 16 }, { x: 2000, y: 55 * 16 },
    { x: 400, y: 75 * 16 }, // deep hydro vent — must survive hard
  ];
  const w = { nodes: [...nodes], vents: [...vents] };
  applyDifficulty(w, DIFFICULTY.hard);
  assert.equal(w.nodes.filter(n => n.kind === 'magma').length, 2);
  assert.equal(w.nodes.length, 9 + 2);
  assert.equal(w.vents.filter(v => Math.floor(v.y / 16) >= HYDRO_ROW).length, 1);
  assert.equal(w.vents.length, 3 + 1);
});
