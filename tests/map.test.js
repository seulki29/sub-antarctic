import test from 'node:test';
import assert from 'node:assert/strict';
import { MAP_ROWS } from '../src/map.js';
import { parseMap, isSolid } from '../src/world.js';
import { TILE } from '../src/constants.js';

test('map dimensions 150x68, uniform rows', () => {
  assert.equal(MAP_ROWS.length, 68);
  for (const r of MAP_ROWS) assert.equal(r.length, 150);
});

test('required entities present', () => {
  const w = parseMap(MAP_ROWS);
  assert.ok(w.base, 'base exists');
  assert.ok(w.vents.length >= 5, `vents ${w.vents.length}`);
  assert.ok(w.checkpoints.length >= 2, `checkpoints ${w.checkpoints.length}`);
  assert.equal(w.nodes.length, 12);
  assert.equal(w.holes.length, 4);
  assert.ok(w.jelly.length >= 8);
  assert.equal(w.fishSpawns.length, 3);
  assert.ok(w.angler, 'boss exists');
  assert.ok(w.gates.length >= 3, 'gate line exists');
  assert.ok(w.angler.y > 50 * TILE, 'boss in deep zone');
});

test('all key points reachable from base (flood fill)', () => {
  const w = parseMap(MAP_ROWS);
  const seen = new Uint8Array(w.w * w.h);
  const q = [[Math.floor(w.base.x / TILE), Math.floor(w.base.y / TILE)]];
  seen[q[0][1] * w.w + q[0][0]] = 1;
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
  const reach = pt => seen[Math.floor(pt.y / TILE) * w.w + Math.floor(pt.x / TILE)] === 1;
  for (const [name, list] of [['vent', w.vents], ['node', w.nodes], ['checkpoint', w.checkpoints], ['jelly', w.jelly], ['fish', w.fishSpawns]])
    list.forEach((pt, i) => assert.ok(reach(pt), `${name}[${i}] reachable`));
  assert.ok(reach(w.angler), 'boss reachable');
});
