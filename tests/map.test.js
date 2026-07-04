import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_ROWS } from '../src/map.js';
import { parseMap, isSolid, setGate } from '../src/world.js';
import { TILE } from '../src/constants.js';

function floodFrom(w, startTx, startTy) {
  const seen = new Uint8Array(w.w * w.h);
  const q = [[startTx, startTy]];
  seen[startTy * w.w + startTx] = 1;
  while (q.length) {
    const [tx, ty] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = tx + dx, ny = ty + dy;
      if (nx < 0 || ny < 0 || nx >= w.w || ny >= w.h) continue;
      if (seen[ny * w.w + nx] || isSolid(w, nx, ny)) continue;
      seen[ny * w.w + nx] = 1;
      q.push([nx, ny]);
    }
  }
  return seen;
}

test('map dimensions 150x68, uniform rows', () => {
  assert.equal(MAP_ROWS.length, 68);
  for (const r of MAP_ROWS) assert.equal(r.length, 150);
});

test('required entities present', () => {
  const w = parseMap(MAP_ROWS);
  assert.ok(w.base, 'base exists');
  assert.equal(w.vents.length, 8);
  assert.ok(w.checkpoints.length >= 2, `checkpoints ${w.checkpoints.length}`);
  assert.equal(w.nodes.length, 16);
  assert.equal(w.holes.length, 4);
  assert.ok(w.jelly.length >= 8);
  assert.equal(w.fishSpawns.length, 3);
  assert.ok(w.angler, 'boss exists');
  assert.ok(w.gates.length >= 3, 'gate line exists');
  assert.ok(w.angler.y > 50 * TILE, 'boss in deep zone');
});

test('all key points reachable from base (flood fill)', () => {
  const w = parseMap(MAP_ROWS);
  const seen = floodFrom(w, Math.floor(w.base.x / TILE), Math.floor(w.base.y / TILE));
  const reach = pt => seen[Math.floor(pt.y / TILE) * w.w + Math.floor(pt.x / TILE)] === 1;
  for (const [name, list] of [['vent', w.vents], ['node', w.nodes], ['checkpoint', w.checkpoints], ['jelly', w.jelly], ['fish', w.fishSpawns]])
    list.forEach((pt, i) => assert.ok(reach(pt), `${name}[${i}] reachable`));
  assert.ok(reach(w.angler), 'boss reachable');
});

test('closed gate seals the boss arena from the base', () => {
  const w = parseMap(MAP_ROWS);
  setGate(w, true);
  const seen = floodFrom(w, Math.floor(w.base.x / TILE), Math.floor(w.base.y / TILE));
  const bossTile = seen[Math.floor(w.angler.y / TILE) * w.w + Math.floor(w.angler.x / TILE)];
  assert.equal(bossTile, 0, 'boss must be unreachable while gate closed');
});

test('boss trigger box cannot be entered without passing the gate', () => {
  // arena trigger box (game.js): boss center +- (170..270, 100..170)
  const w = parseMap(MAP_ROWS);
  setGate(w, true);
  const seen = floodFrom(w, Math.floor(w.base.x / TILE), Math.floor(w.base.y / TILE));
  const bx = w.angler.x, by = w.angler.y;
  const x0 = Math.floor((bx - 170) / TILE), x1 = Math.ceil((bx + 270) / TILE);
  const y0 = Math.floor((by - 100) / TILE), y1 = Math.ceil((by + 170) / TILE);
  for (let ty = Math.max(0, y0); ty <= Math.min(w.h - 1, y1); ty++)
    for (let tx = Math.max(0, x0); tx <= Math.min(w.w - 1, x1); tx++)
      assert.equal(seen[ty * w.w + tx], 0,
        `trigger-box tile (${tx},${ty}) reachable with gate closed — gate would close in front of the player`);
});

test('map vents and minerals cover all depth zones', () => {
  const w = parseMap(MAP_ROWS);
  const zone = pt => { const ty = Math.floor(pt.y / TILE); return ty < 18 ? 0 : ty < 40 ? 1 : 2; };
  const vc = [0, 0, 0];
  for (const v of w.vents) vc[zone(v)]++;
  for (const c of vc) assert.ok(c >= 2, `vents per zone ${vc}`);
  const kinds = new Set(w.nodes.map(n => n.kind));
  assert.equal(kinds.size, 3, 'all three minerals present');
});
