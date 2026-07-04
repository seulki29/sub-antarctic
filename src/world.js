import { TILE, NODE_HP } from './constants.js';

export const T = { WATER: 0, ROCK: 1, VENT: 2, NODE: 3, HOLE: 4, CHECK: 5, BASE: 6, GATE: 7 };

const LEGEND = {
  '.': T.WATER, '#': T.ROCK, 'V': T.VENT, 'C': T.NODE, 'M': T.HOLE,
  'K': T.CHECK, 'B': T.BASE, 'G': T.GATE,
  // entity-only markers (tile becomes water)
  'J': T.WATER, 'F': T.WATER, 'A': T.WATER, 'W': T.WATER,
};

function center(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }

// mineral tier by depth: crystal < 18 <= pearl < 40 <= abyss (tile rows)
export function mineralForRow(tileY) {
  return tileY < 18 ? 'crystal' : tileY < 40 ? 'pearl' : 'abyss';
}

export function parseMap(rows) {
  const h = rows.length, w = rows[0].length;
  const world = {
    w, h, tiles: new Uint8Array(w * h), gateClosed: false,
    base: null, vents: [], nodes: [], holes: [], checkpoints: [],
    jelly: [], fishSpawns: [], angler: null, gates: [], decor: [],
  };
  for (let ty = 0; ty < h; ty++) {
    for (let tx = 0; tx < w; tx++) {
      const ch = rows[ty][tx] ?? '#';
      const t = LEGEND[ch] ?? T.ROCK;
      world.tiles[ty * w + tx] = t;
      const c = center(tx, ty);
      if (ch === 'B') world.base = c;
      else if (ch === 'V') world.vents.push(c);
      else if (ch === 'C') world.nodes.push({ ...c, hp: NODE_HP, kind: mineralForRow(ty) });
      else if (ch === 'M') world.holes.push({ ...c, dir: dirFromWall(rows, tx, ty) });
      else if (ch === 'K') world.checkpoints.push(c);
      else if (ch === 'J') world.jelly.push(c);
      else if (ch === 'F') world.fishSpawns.push(c);
      else if (ch === 'A') world.angler = c;
      else if (ch === 'G') world.gates.push({ tx, ty });
    }
  }
  genDecor(world, rows);
  return world;
}

// moray hole faces away from its most-solid neighbor
function dirFromWall(rows, tx, ty) {
  const at = (x, y) => (rows[y]?.[x] ?? '#') === '#';
  if (at(tx - 1, ty)) return { x: 1, y: 0 };
  if (at(tx + 1, ty)) return { x: -1, y: 0 };
  if (at(tx, ty - 1)) return { x: 0, y: 1 };
  return { x: 0, y: -1 };
}

// deterministic glowing coral / kelp on floor tiles
function genDecor(world, rows) {
  const colors = ['#ff8c5a', '#ff6482', '#ffbe6e', '#aa78ff', '#78f0dc'];
  for (let ty = 1; ty < world.h; ty++) {
    for (let tx = 0; tx < world.w; tx++) {
      const solid = world.tiles[ty * world.w + tx] === T.ROCK;
      const waterAbove = world.tiles[(ty - 1) * world.w + tx] === T.WATER;
      if (!solid || !waterAbove) continue;
      const hsh = (tx * 73856093 ^ ty * 19349663) >>> 0;
      if (hsh % 100 < 22) {
        world.decor.push({
          x: tx * TILE + (hsh % TILE), y: ty * TILE,
          type: hsh % 3 === 0 ? 'kelp' : 'coral',
          color: colors[hsh % colors.length],
        });
      }
    }
  }
}

export function isSolid(world, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) return true;
  const t = world.tiles[ty * world.w + tx];
  return t === T.ROCK || t === T.HOLE || (t === T.GATE && world.gateClosed);
}

export function rectHitsSolid(world, x, y, w, h) {
  const x0 = Math.floor(x / TILE), x1 = Math.floor((x + w - 0.001) / TILE);
  const y0 = Math.floor(y / TILE), y1 = Math.floor((y + h - 0.001) / TILE);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++)
      if (isSolid(world, tx, ty)) return true;
  return false;
}

export function moveAndCollide(world, e, dt) {
  const res = { hitX: false, hitY: false };
  e.x += e.vx * dt;
  if (rectHitsSolid(world, e.x, e.y, e.w, e.h)) {
    if (e.vx > 0) e.x = Math.floor((e.x + e.w) / TILE) * TILE - e.w - 0.001;
    else e.x = (Math.floor(e.x / TILE) + 1) * TILE + 0.001;
    e.vx = 0; res.hitX = true;
  }
  e.y += e.vy * dt;
  if (rectHitsSolid(world, e.x, e.y, e.w, e.h)) {
    if (e.vy > 0) e.y = Math.floor((e.y + e.h) / TILE) * TILE - e.h - 0.001;
    else e.y = (Math.floor(e.y / TILE) + 1) * TILE + 0.001;
    e.vy = 0; res.hitY = true;
  }
  return res;
}

export function setGate(world, closed) { world.gateClosed = closed; }

function pickEven(list, n) {
  const sorted = [...list].sort((a, b) => a.x - b.x);
  if (n >= sorted.length) return sorted;
  const out = [];
  for (let i = 0; i < n; i++) out.push(sorted[Math.floor(i * sorted.length / n)]);
  return out;
}

function ventZone(v) {
  const ty = Math.floor(v.y / TILE);
  return ty < 18 ? 0 : ty < 40 ? 1 : 2;
}

// difficulty post-pass: trim nodes/vents to target counts.
// vents keep at least one per depth zone so O2 routes always exist.
export function applyDifficulty(world, diff) {
  world.nodes = pickEven(world.nodes, diff.nodes);
  const zones = [[], [], []];
  for (const v of [...world.vents].sort((a, b) => a.x - b.x)) zones[ventZone(v)].push(v);
  const kept = [];
  for (const z of zones) if (z.length) kept.push(z[0]);
  const rest = world.vents.filter(v => !kept.includes(v));
  for (const v of pickEven(rest, Math.max(0, diff.vents - kept.length))) kept.push(v);
  world.vents = kept;
}
