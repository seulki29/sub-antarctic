# Sub-Antarctic 심해 프로토타입 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저(데스크톱+모바일)에서 플레이 가능한 심해 탐험 액션 프로토타입 — 유영·헤드램프·작살 전투·채집→생환→업그레이드 루프·보스전.

**Architecture:** HTML5 Canvas 2D + 순수 ES 모듈, 빌드 없음. 내부 해상도 480×270 오프스크린 렌더 → 정수배 업스케일. 씬×라이트맵 multiply 합성 라이팅. 순수 로직(충돌/O2/상태기계)은 캔버스 없이 Node로 단위 테스트.

**Tech Stack:** Vanilla JS (ES modules), Canvas 2D, WebAudio, Node built-in test runner (`node --test`). 외부 의존성 0.

**Spec:** `docs/superpowers/specs/2026-07-03-deep-sea-prototype-design.md`

## Global Constraints

- 빌드 도구·외부 라이브러리 금지. 정적 서버로 실행: `python -m http.server 8000`
- 내부 해상도 480×270 고정, TILE=16px, 정수배 nearest-neighbor 업스케일
- 동시 활성 광원 상한 12개 (헤드램프+루어 포함)
- 고정 타임스텝 1/60s, dt 누적 클램프 0.1s
- 데스크톱(WASD+마우스)과 모바일(트윈스틱 터치) 동일 게임성
- 튜닝 상수는 전부 `src/constants.js`에 집중
- 테스트는 DOM/캔버스 없이 실행 가능해야 함 (`node --test tests/`)
- 커밋 메시지 끝에 `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

## File Structure

```
index.html            # 캔버스, 스케일 CSS, 세로모드 오버레이
package.json          # type:module, test 스크립트
src/constants.js      # 모든 튜닝 상수
src/map.js            # ASCII 맵 데이터 (150×68 타일)
src/world.js          # 맵 파싱, 타일 충돌, 게이트, 데코 생성
src/input.js          # 키보드/마우스 + 터치 트윈스틱 → 추상 입력
src/player.js         # 유영 물리, O2, 체력, 인벤토리, 은행
src/harpoon.js        # 작살 발사체
src/enemies.js        # 해파리/곰치/심해어 + inCone
src/boss.js           # ABYSSAL ANGLER 상태기계
src/sprites.js        # 프로시저럴 스프라이트 베이크
src/render.js         # 카메라, 배경, 패럴랙스, 타일, 데코
src/lighting.js       # 라이트맵 (앰비언트/원뿔/점광원)
src/particles.js      # 기포/부유물/스파크
src/hud.js            # 3×5 폰트, O2바, 하트, 보스바, 업그레이드 메뉴
src/audio.js          # WebAudio 효과음
src/game.js           # 게임플레이 씬 (모든 모듈 조립)
src/main.js           # 루프, 씬 전환, 리사이즈
tests/*.test.js       # world/player/enemies/boss/map 테스트
```

---

### Task 1: 프로젝트 스캐폴드 + 게임 루프

**Files:**
- Create: `package.json`, `.gitignore`, `index.html`, `src/constants.js`, `src/main.js`
- Test: `tests/smoke.test.js`

**Interfaces:**
- Produces: `constants.js`의 모든 상수 (이후 전 태스크가 사용), `main.js`의 씬 규약 — 씬은 `{ update(dt), draw(ctx), onPointer?(x,y) }` 객체. `main.js`의 `setScene(s)` 전역 씬 전환.

- [ ] **Step 1: 파일 생성**

`package.json`:
```json
{
  "name": "sub-antarctic",
  "private": true,
  "type": "module",
  "scripts": { "test": "node --test tests/" }
}
```

`.gitignore`:
```
node_modules/
*.log
```

`src/constants.js`:
```js
export const VIEW_W = 480, VIEW_H = 270, TILE = 16, DT = 1 / 60;

export const PLAYER = {
  W: 20, H: 10,
  ACCEL: 600, MAX_SPD: 110, DRAG: 2.2,
  BOOST_SPD: 260, BOOST_TIME: 0.18, BOOST_CD: 0.9, BOOST_O2: 1.5,
  O2_MAX: 90, O2_DRAIN: 1, O2_VENT_REFILL: 30, O2_EMPTY_HP_PERIOD: 1,
  HP_MAX: 3, INVULN: 1.5, SLOW_TIME: 0.8,
  FIRE_CD: 0.35, HARPOON_SPD: 320, HARPOON_DMG: 1,
};

export const UPGRADES = {
  tank:   { cost: 8,  label: 'O2 TANK +50'  },
  damage: { cost: 12, label: 'HARPOON +50' },
};

export const ENEMY = {
  JELLY: { HP: 2, SPD: 14, DMG: 1 },
  MORAY: { HP: 3, TRIGGER: 60, LUNGE_SPD: 220, LUNGE_TIME: 0.35, RECOVER: 1.2, DMG: 1 },
  FISH:  { HP: 1, WANDER_SPD: 30, CHASE_SPD: 95, CALM_TIME: 3, DMG: 1, PER_SCHOOL: 4 },
};

export const BOSS = {
  HP: 30, W: 110, H: 70, CONTACT_DMG: 1,
  IDLE_TIME: 1.4, TELEGRAPH: 0.7, CHARGE_SPD: 240, STUN: 1.0,
  SUMMON_COUNT: 2, PHASE2_AT: 0.5,
};

export const LIGHT = { MAX: 12, LAMP_REACH: 150, LAMP_SPREAD: 0.5 };
export const NODE_HP = 2, CRYSTALS_PER_NODE = 3;
```

`index.html`:
```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no, viewport-fit=cover">
<title>SUB-ANTARCTIC</title>
<style>
  html, body { margin: 0; height: 100%; background: #04050e; overflow: hidden;
               touch-action: none; -webkit-user-select: none; user-select: none; }
  #wrap { display: flex; align-items: center; justify-content: center; height: 100%; }
  canvas { image-rendering: pixelated; image-rendering: crisp-edges; }
  #rotate { display: none; position: fixed; inset: 0; background: #04050e; color: #9fd0e0;
            z-index: 10; align-items: center; justify-content: center;
            font: 16px monospace; text-align: center; }
  @media (orientation: portrait) and (pointer: coarse) { #rotate { display: flex; } }
</style>
</head>
<body>
<div id="wrap"><canvas id="game" width="480" height="270"></canvas></div>
<div id="rotate">기기를 가로로 돌려주세요 🔄</div>
<script type="module" src="src/main.js"></script>
</body>
</html>
```

`src/main.js`:
```js
import { VIEW_W, VIEW_H, DT } from './constants.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;

function resize() {
  const s = Math.max(1, Math.floor(Math.min(
    window.innerWidth / VIEW_W, window.innerHeight / VIEW_H)));
  canvas.style.width = VIEW_W * s + 'px';
  canvas.style.height = VIEW_H * s + 'px';
}
window.addEventListener('resize', resize);
resize();

let scene = {
  update() {},
  draw(c) { c.fillStyle = '#04050e'; c.fillRect(0, 0, VIEW_W, VIEW_H); },
};
export function setScene(s) { scene = s; }
export function getCanvas() { return canvas; }

let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min((now - last) / 1000, 0.1);
  last = now;
  while (acc >= DT) { scene.update(DT); acc -= DT; }
  scene.draw(ctx);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 2: 테스트 하네스 확인용 스모크 테스트**

`tests/smoke.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_W, VIEW_H, TILE, PLAYER } from '../src/constants.js';

test('constants sane', () => {
  assert.equal(VIEW_W, 480);
  assert.equal(VIEW_H, 270);
  assert.equal(TILE, 16);
  assert.ok(PLAYER.O2_MAX > 0);
});
```

- [ ] **Step 3: 테스트 실행**

Run: `node --test tests/`
Expected: `pass 1`, `fail 0`

- [ ] **Step 4: 브라우저 스모크 확인**

Run: `python -m http.server 8000` (백그라운드) 후 브라우저에서 `http://localhost:8000` 접속.
Expected: 검은(#04050e) 480×270 캔버스가 정수배로 확대되어 중앙에 표시. 콘솔 에러 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: project scaffold with fixed-timestep game loop"
```

---

### Task 2: 월드 — 맵 파싱 + 타일 충돌

**Files:**
- Create: `src/world.js`
- Test: `tests/world.test.js`

**Interfaces:**
- Consumes: `constants.js`의 `TILE`
- Produces:
  - `T` — 타일 enum `{ WATER:0, ROCK:1, VENT:2, NODE:3, HOLE:4, CHECK:5, BASE:6, GATE:7 }`
  - `parseMap(rows: string[]) → World` — World = `{ w, h, tiles: Uint8Array, gateClosed: bool, base:{x,y}, vents:[{x,y}], nodes:[{x,y,hp}], holes:[{x,y,dir}], checkpoints:[{x,y}], jelly:[{x,y}], fishSpawns:[{x,y}], angler:{x,y}|null, gates:[{tx,ty}], decor:[{x,y,type,color}] }` (좌표는 월드 px, 타일 중심)
  - `isSolid(world, tx, ty) → bool` (맵 밖 = solid)
  - `moveAndCollide(world, e, dt) → { hitX, hitY }` — e는 `{x,y,w,h,vx,vy}` mutate
  - `rectHitsSolid(world, x, y, w, h) → bool`
  - `setGate(world, closed)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/world.test.js`:
```js
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
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node --test tests/`
Expected: FAIL — `Cannot find module ... world.js`

- [ ] **Step 3: 구현**

`src/world.js`:
```js
import { TILE, NODE_HP } from './constants.js';

export const T = { WATER: 0, ROCK: 1, VENT: 2, NODE: 3, HOLE: 4, CHECK: 5, BASE: 6, GATE: 7 };

const LEGEND = {
  '.': T.WATER, '#': T.ROCK, 'V': T.VENT, 'C': T.NODE, 'M': T.HOLE,
  'K': T.CHECK, 'B': T.BASE, 'G': T.GATE,
  // entity-only markers (tile becomes water)
  'J': T.WATER, 'F': T.WATER, 'A': T.WATER, 'W': T.WATER,
};

function center(tx, ty) { return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 }; }

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
      else if (ch === 'C') world.nodes.push({ ...c, hp: NODE_HP });
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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/`
Expected: 전부 PASS

- [ ] **Step 5: Commit**

```bash
git add src/world.js tests/world.test.js
git commit -m "feat: tilemap parsing, AABB collision, gate toggle, decor gen"
```

---

### Task 3: 입력 — 키보드/마우스 + 터치 트윈스틱

**Files:**
- Create: `src/input.js`
- Test: `tests/input.test.js`

**Interfaces:**
- Produces:
  - `stickVector(ox, oy, x, y, r=26) → {x, y, len}` — 원점 대비 정규화 벡터(len 0..1 클램프)
  - `class Input` — 필드 `move:{x,y}`(단위·0벡터 가능), `aim:{x,y}`(항상 단위벡터), `firing:bool`, `boost:bool`, `touchMode:bool`, `pointer:{x,y,clicked}` (뷰 좌표계 480×270), 터치 스틱 표시용 `sticks:{left:{ox,oy,x,y}|null, right:{...}|null}`
  - 메서드 `attach(canvas)`, `setPlayerScreen(x, y)`(마우스 조준 기준점), `update()`(매 프레임 호출, clicked는 1프레임만 true), `consumeClick() → bool`

- [ ] **Step 1: 실패하는 테스트 작성 (순수 수학만)**

`tests/input.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { stickVector } from '../src/input.js';

test('stickVector normalizes and clamps', () => {
  const v = stickVector(0, 0, 100, 0, 26);
  assert.equal(v.x, 1);
  assert.equal(v.y, 0);
  assert.equal(v.len, 1);
});

test('stickVector partial deflection', () => {
  const v = stickVector(0, 0, 13, 0, 26);
  assert.ok(Math.abs(v.len - 0.5) < 1e-9);
  assert.equal(v.x, 1); // direction stays unit
});

test('stickVector zero at origin', () => {
  const v = stickVector(10, 10, 10, 10, 26);
  assert.equal(v.len, 0);
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node --test tests/`
Expected: FAIL — input.js 없음

- [ ] **Step 3: 구현**

`src/input.js`:
```js
import { VIEW_W, VIEW_H } from './constants.js';

export function stickVector(ox, oy, x, y, r = 26) {
  const dx = x - ox, dy = y - oy;
  const d = Math.hypot(dx, dy);
  if (d < 0.001) return { x: 0, y: 0, len: 0 };
  return { x: dx / d, y: dy / d, len: Math.min(d / r, 1) };
}

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'boost', ShiftRight: 'boost',
};

export class Input {
  constructor() {
    this.move = { x: 0, y: 0 };
    this.aim = { x: 1, y: 0 };
    this.firing = false;
    this.boost = false;
    this.touchMode = false;
    this.pointer = { x: 0, y: 0, clicked: false };
    this.sticks = { left: null, right: null };
    this._keys = new Set();
    this._mouse = { x: VIEW_W / 2, y: VIEW_H / 2, down: false };
    this._playerScreen = { x: VIEW_W / 2, y: VIEW_H / 2 };
    this._touches = new Map(); // id -> {side, ox, oy, x, y}
    this._clickQueue = false;
  }

  attach(canvas) {
    this._canvas = canvas;
    const toView = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      return { x: (cx - r.left) / r.width * VIEW_W, y: (cy - r.top) / r.height * VIEW_H };
    };
    window.addEventListener('keydown', e => { if (KEYMAP[e.code]) { this._keys.add(KEYMAP[e.code]); e.preventDefault(); } });
    window.addEventListener('keyup', e => this._keys.delete(KEYMAP[e.code]));
    canvas.addEventListener('mousemove', e => Object.assign(this._mouse, toView(e.clientX, e.clientY)));
    canvas.addEventListener('mousedown', e => { this._mouse.down = true; this._clickQueue = true; Object.assign(this._mouse, toView(e.clientX, e.clientY)); });
    window.addEventListener('mouseup', () => { this._mouse.down = false; });
    canvas.addEventListener('touchstart', e => {
      e.preventDefault();
      this.touchMode = true;
      for (const t of e.changedTouches) {
        const p = toView(t.clientX, t.clientY);
        const side = p.x < VIEW_W / 2 ? 'left' : 'right';
        if ([...this._touches.values()].some(v => v.side === side)) continue;
        this._touches.set(t.identifier, { side, ox: p.x, oy: p.y, x: p.x, y: p.y });
        this._clickQueue = true;
        Object.assign(this.pointer, p);
      }
    }, { passive: false });
    canvas.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const v = this._touches.get(t.identifier);
        if (v) Object.assign(v, toView(t.clientX, t.clientY));
      }
    }, { passive: false });
    const endTouch = e => {
      for (const t of e.changedTouches) this._touches.delete(t.identifier);
    };
    canvas.addEventListener('touchend', endTouch);
    canvas.addEventListener('touchcancel', endTouch);
  }

  setPlayerScreen(x, y) { this._playerScreen = { x, y }; }

  update() {
    this.pointer.clicked = this._clickQueue;
    this._clickQueue = false;
    if (!this.touchMode) {
      const k = this._keys;
      this.move = {
        x: (k.has('right') ? 1 : 0) - (k.has('left') ? 1 : 0),
        y: (k.has('down') ? 1 : 0) - (k.has('up') ? 1 : 0),
      };
      const len = Math.hypot(this.move.x, this.move.y);
      if (len > 1) { this.move.x /= len; this.move.y /= len; }
      const a = stickVector(this._playerScreen.x, this._playerScreen.y, this._mouse.x, this._mouse.y, 1);
      if (a.len > 0) this.aim = { x: a.x, y: a.y };
      this.firing = this._mouse.down;
      this.boost = k.has('boost');
      Object.assign(this.pointer, { x: this._mouse.x, y: this._mouse.y });
    } else {
      this.sticks.left = this.sticks.right = null;
      this.move = { x: 0, y: 0 };
      this.firing = false;
      let leftV = null;
      for (const v of this._touches.values()) {
        const s = stickVector(v.ox, v.oy, v.x, v.y);
        if (v.side === 'left') { this.move = { x: s.x * s.len, y: s.y * s.len }; this.sticks.left = v; leftV = s; }
        else {
          if (s.len > 0.15) this.aim = { x: s.x, y: s.y };
          this.firing = s.len > 0.35;
          this.sticks.right = v;
        }
      }
      // boost: left stick fully deflected
      this.boost = !!leftV && leftV.len >= 0.98;
    }
  }

  consumeClick() {
    const c = this.pointer.clicked;
    this.pointer.clicked = false;
    return c;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/`
Expected: 전부 PASS (Input 클래스는 DOM 의존이지만 import 시점에 DOM 접근 없음 확인)

- [ ] **Step 5: Commit**

```bash
git add src/input.js tests/input.test.js
git commit -m "feat: unified keyboard/mouse and twin-stick touch input"
```

---

### Task 4: 플레이어 — 유영 물리 / O2 / 체력 / 인벤토리

**Files:**
- Create: `src/player.js`
- Test: `tests/player.test.js`

**Interfaces:**
- Consumes: `moveAndCollide(world, e, dt)`, `PLAYER`/`UPGRADES` 상수
- Produces: `class Player`
  - 필드: `x,y,w,h,vx,vy`, `hp`, `o2`, `invuln`, `slow`, `boostT`, `boostCd`, `fireCd`, `facing`(±1), `carried`, `banked`, `upgrades:{tank:bool,damage:bool}`, `checkpoint:{x,y}`, `hasRelic:bool`, `dead:bool`
  - `constructor(x, y)`
  - `update(dt, input, world) → events: string[]` — 이벤트: `'died'` (O2 고갈 사망 포함)
  - `o2Max()`, `dmgValue()` — 업그레이드 반영값
  - `damage(n, fromX) → bool` — 무적 중이면 false
  - `addO2(perSec, dt)`
  - `pickupCrystal(n)`
  - `bank() → number` — 은행된 양 반환, O2/HP 회복
  - `buyUpgrade(key) → bool`
  - `die()` / `respawn()` — die는 carried 소실 + dead=true, respawn은 checkpoint 복귀 + 회복
  - `setCheckpoint(x, y)`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/player.test.js`:
```js
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
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node --test tests/`
Expected: FAIL — player.js 없음

- [ ] **Step 3: 구현**

`src/player.js`:
```js
import { PLAYER as P, UPGRADES } from './constants.js';
import { moveAndCollide } from './world.js';

export class Player {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = P.W; this.h = P.H;
    this.vx = 0; this.vy = 0;
    this.hp = P.HP_MAX; this.o2 = P.O2_MAX;
    this.invuln = 0; this.slow = 0;
    this.boostT = 0; this.boostCd = 0; this.fireCd = 0;
    this.facing = 1;
    this.carried = 0; this.banked = 0;
    this.upgrades = { tank: false, damage: false };
    this.checkpoint = { x, y };
    this.hasRelic = false;
    this.dead = false;
    this._o2HpTimer = 0;
  }

  o2Max() { return P.O2_MAX * (this.upgrades.tank ? 1.5 : 1); }
  dmgValue() { return P.HARPOON_DMG * (this.upgrades.damage ? 1.5 : 1); }

  update(dt, input, world) {
    const events = [];
    if (this.dead) return events;

    for (const k of ['invuln', 'slow', 'boostCd', 'fireCd']) this[k] = Math.max(0, this[k] - dt);

    // boost trigger
    if (input.boost && this.boostCd <= 0 && this.boostT <= 0 &&
        (input.move.x || input.move.y)) {
      this.boostT = P.BOOST_TIME;
      this.boostCd = P.BOOST_CD;
      this.o2 = Math.max(0, this.o2 - P.BOOST_O2);
      const len = Math.hypot(input.move.x, input.move.y) || 1;
      this.vx = input.move.x / len * P.BOOST_SPD;
      this.vy = input.move.y / len * P.BOOST_SPD;
    }
    this.boostT = Math.max(0, this.boostT - dt);

    // swim with inertia
    const slowMul = this.slow > 0 ? 0.5 : 1;
    if (this.boostT <= 0) {
      this.vx += input.move.x * P.ACCEL * slowMul * dt;
      this.vy += input.move.y * P.ACCEL * slowMul * dt;
      const spd = Math.hypot(this.vx, this.vy);
      if (spd > P.MAX_SPD) { this.vx *= P.MAX_SPD / spd; this.vy *= P.MAX_SPD / spd; }
    }
    this.vx -= this.vx * P.DRAG * dt;
    this.vy -= this.vy * P.DRAG * dt;
    moveAndCollide(world, this, dt);

    if (input.aim.x !== 0) this.facing = input.aim.x > 0 ? 1 : -1;

    // O2
    this.o2 = Math.max(0, this.o2 - P.O2_DRAIN * dt);
    if (this.o2 <= 0) {
      this._o2HpTimer += dt;
      while (this._o2HpTimer >= P.O2_EMPTY_HP_PERIOD) {
        this._o2HpTimer -= P.O2_EMPTY_HP_PERIOD;
        this.hp -= 1;
      }
    } else this._o2HpTimer = 0;

    if (this.hp <= 0) { this.die(); events.push('died'); }
    return events;
  }

  addO2(perSec, dt) { this.o2 = Math.min(this.o2Max(), this.o2 + perSec * dt); }

  damage(n, fromX = this.x) {
    if (this.invuln > 0 || this.dead) return false;
    this.hp -= n;
    this.invuln = P.INVULN;
    this.vx = Math.sign(this.x - fromX || 1) * 140;
    this.vy = -40;
    return true;
  }

  pickupCrystal(n) { this.carried += n; }

  bank() {
    const amt = this.carried;
    this.banked += amt;
    this.carried = 0;
    this.o2 = this.o2Max();
    this.hp = P.HP_MAX;
    return amt;
  }

  buyUpgrade(key) {
    const u = UPGRADES[key];
    if (!u || this.upgrades[key] || this.banked < u.cost) return false;
    this.banked -= u.cost;
    this.upgrades[key] = true;
    if (key === 'tank') this.o2 = this.o2Max();
    return true;
  }

  setCheckpoint(x, y) { this.checkpoint = { x, y }; }

  die() {
    this.carried = 0;
    this.dead = true;
  }

  respawn() {
    this.dead = false;
    this.x = this.checkpoint.x; this.y = this.checkpoint.y;
    this.vx = this.vy = 0;
    this.hp = P.HP_MAX;
    this.o2 = this.o2Max();
    this.invuln = 2;
    this._o2HpTimer = 0;
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test tests/`
Expected: 전부 PASS

- [ ] **Step 5: Commit**

```bash
git add src/player.js tests/player.test.js
git commit -m "feat: player swim physics, O2/health, inventory and banking rules"
```

---

### Task 5: 스프라이트 베이크 + 렌더 + 기본 맵 — "헤엄칠 수 있는 세계"

**Files:**
- Create: `src/sprites.js`, `src/render.js`, `src/map.js`, `src/game.js`
- Modify: `src/main.js` (게임 씬 연결)

**Interfaces:**
- Consumes: Task 1-4 전부
- Produces:
  - `sprites.js`: `bakePixelArt(rows, legend) → canvas`, `bakeSprites() → S` — S는 `{ diverR, diverL, jelly, moray, fish, crystal, node, relic, rock: canvas[4], angler: {canvas, lure:{x,y}} }`. `outline(canvas, color)` 유틸.
  - `render.js`: `class Camera { x, y, update(dt, targetX, targetY, world) }` (lerp 추적 + 월드 클램프), `drawBackground(ctx, cam, world)`, `drawTiles(ctx, cam, world, S)`, `drawDecor(ctx, cam, world)`
  - `map.js`: `MAP_ROWS: string[]` (이 태스크에서는 상단 1/4만 임시 오픈월드, Task 11에서 전체 교체)
  - `game.js`: `class GameScene { constructor(canvas), update(dt), draw(ctx) }`
- 주의: 모든 draw는 월드좌표 - `cam.x/cam.y` 스크린 변환. 카메라는 반픽셀 지터 방지 위해 draw 시 `Math.round`.

- [ ] **Step 1: 스프라이트 모듈 구현**

`src/sprites.js`:
```js
// procedural sprite baking — runs once at load
function mk(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function g2(c) { const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return g; }

export function bakePixelArt(rows, legend) {
  const c = mk(rows[0].length, rows.length), g = g2(c);
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.' || !legend[ch]) return;
    g.fillStyle = legend[ch];
    g.fillRect(x, y, 1, 1);
  }));
  return c;
}

export function outline(c, color = '#05040a') {
  const g = g2(c), { width: w, height: h } = c;
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 40;
  const mark = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (!solid(x, y) && (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)))
      mark.push([x, y]);
  }
  g.fillStyle = color;
  for (const [x, y] of mark) g.fillRect(x, y, 1, 1);
  return c;
}

function poly(g, pts, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) g.lineTo(p[0], p[1]);
  g.closePath(); g.fill();
}
function ell(g, x, y, rx, ry, fill) {
  g.fillStyle = fill;
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); g.fill();
}

// diver (approved sample art, 28x12, facing right)
const DIVER_ROWS = [
  '..................KKKKK.....',
  '.......KKK.......KHHHHHK....',
  '......KTTtK.....KHHGGGGgK...',
  '......KTTtK....KHhGGggggK...',
  '...KK.KTTtKKKKKKoHGGggggKL..',
  '..KFFKohooooooooohKGGGGKKL..',
  '.KFFFKoodooodoooooKKKKKK....',
  '..KFFKoodooodooooooooK......',
  '...KKKohoooooooKoooooK......',
  '......KKoodooKKKKoodoK......',
  '........KKKKK...KooooK......',
  '.................KKKK.......',
];
const DIVER_LEGEND = {
  K: '#05040a', o: '#de7e30', d: '#9c4c22', h: '#fab264',
  H: '#a8b2be', G: '#78dceb', g: '#d7fafc',
  T: '#c4ae5a', t: '#827038', F: '#3c5a70', L: '#ffecaa',
};

function bakeDiver() {
  const r = bakePixelArt(DIVER_ROWS, DIVER_LEGEND);
  const l = mk(r.width, r.height), g = g2(l);
  g.scale(-1, 1); g.drawImage(r, -r.width, 0);
  return { diverR: r, diverL: l };
}

function bakeJelly() {
  const c = mk(14, 16), g = g2(c);
  ell(g, 7, 5, 6, 4, 'rgba(190,140,255,0.85)');
  ell(g, 7, 4, 4, 2, 'rgba(240,210,255,0.9)');
  g.strokeStyle = 'rgba(190,140,255,0.5)';
  for (let i = 0; i < 5; i++) {
    g.beginPath(); g.moveTo(2.5 + i * 2.2, 8);
    g.lineTo(2.5 + i * 2.2 + (i % 2), 14 + (i % 3)); g.stroke();
  }
  return outline(c, 'rgba(40,20,60,0.6)');
}

function bakeMoray() { // head + neck, facing right at rest
  const c = mk(26, 12), g = g2(c);
  poly(g, [[0, 4], [14, 2], [24, 5], [24, 9], [14, 10], [0, 8]], '#2e5040');
  poly(g, [[14, 3], [24, 5], [24, 9], [14, 9]], '#3e6852');
  ell(g, 19, 5, 1.5, 1.5, '#ffd050');
  g.fillStyle = '#101a14'; g.fillRect(19, 5, 1, 1);
  poly(g, [[24, 5], [26, 6], [24, 7]], '#e8f0ee'); // tooth tip
  return outline(c);
}

function bakeFish() {
  const c = mk(8, 5), g = g2(c);
  poly(g, [[0, 2], [2, 0], [6, 2], [2, 4]], '#4a6a94');
  poly(g, [[6, 2], [8, 0], [8, 4]], '#3a5478');
  g.fillStyle = '#c0e0f0'; g.fillRect(2, 1, 1, 1);
  return outline(c);
}

function bakeCrystal() {
  const c = mk(7, 9), g = g2(c);
  poly(g, [[3, 0], [6, 4], [3, 8], [0, 4]], '#5ae0e6');
  poly(g, [[3, 0], [6, 4], [3, 4]], '#b8f8fa');
  return outline(c);
}

function bakeNode() {
  const c = mk(16, 12), g = g2(c);
  poly(g, [[2, 11], [4, 4], [7, 11]], '#38b8c0');
  poly(g, [[6, 11], [9, 1], [12, 11]], '#5ae0e6');
  poly(g, [[10, 11], [13, 6], [15, 11]], '#38b8c0');
  poly(g, [[8, 4], [9, 1], [10, 4]], '#b8f8fa');
  return outline(c);
}

function bakeRelic() {
  const c = mk(10, 12), g = g2(c);
  poly(g, [[2, 11], [8, 11], [7, 3], [3, 3]], '#c8a84a');
  g.fillStyle = '#ffe9a0'; g.fillRect(4, 5, 2, 2);
  ell(g, 5, 2, 2, 2, '#c8a84a');
  return outline(c);
}

function bakeRocks() {
  const out = [];
  for (let v = 0; v < 4; v++) {
    const c = mk(16, 16), g = g2(c);
    g.fillStyle = '#0a1226'; g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#111c38';
    for (let i = 0; i < 6; i++) {
      const h = (v * 31 + i * 47) % 13;
      g.fillRect((i * 3 + v) % 14, h, 2 + (i % 2), 2);
    }
    g.fillStyle = '#060a18';
    for (let i = 0; i < 5; i++) {
      const h = (v * 17 + i * 71) % 13;
      g.fillRect((i * 5 + v * 2) % 14, h, 2, 1 + (i % 2));
    }
    out.push(c);
  }
  return out;
}

function bakeAngler() {
  const w = 130, h = 96, c = mk(w, h), g = g2(c);
  const cx = w * 0.56, cy = h * 0.52;
  const base = '#38223e', shade = '#26162c', hi = '#56385c',
        mouth = '#100510', teeth = '#e8f0ee';
  poly(g, [[w * 0.86, cy], [w - 2, cy - 26], [w * 0.93, cy], [w - 2, cy + 26]], shade);
  poly(g, [[cx - 6, cy - 34], [cx + 16, cy - 52], [cx + 30, cy - 30]], shade);
  poly(g, [[cx + 2, cy + 32], [cx + 20, cy + 48], [cx + 32, cy + 28]], shade);
  ell(g, cx, cy, 45, 36, base);
  poly(g, [[cx - 44, cy - 2], [cx - 4, cy - 10], [cx - 8, cy + 16], [cx - 46, cy + 22]], mouth);
  poly(g, [[cx - 46, cy + 22], [cx - 8, cy + 16], [cx - 2, cy + 30], [cx - 38, cy + 34]], shade);
  poly(g, [[cx - 48, cy - 4], [cx - 6, cy - 14], [cx + 2, cy - 30], [cx - 34, cy - 22]], base);
  for (let i = 0; i < 7; i++) {
    const tx = cx - 42 + i * 6;
    poly(g, [[tx, cy - 3], [tx + 3, cy - 3], [tx + 1, cy + 4]], teeth);
  }
  for (let i = 0; i < 6; i++) {
    const tx = cx - 40 + i * 6.4;
    poly(g, [[tx, cy + 20], [tx + 3, cy + 20], [tx + 1, cy + 14]], teeth);
  }
  ell(g, cx + 2, cy - 18, 4, 4, '#ffcc5a');
  ell(g, cx + 3, cy - 18, 1.5, 2, '#0a060a');
  poly(g, [[cx + 14, cy + 6], [cx + 34, cy + 20], [cx + 30, cy - 2]], hi);
  g.strokeStyle = shade; g.lineWidth = 2;
  g.beginPath(); g.moveTo(cx - 20, cy - 26);
  g.quadraticCurveTo(cx - 40, cy - 70, cx - 54, cy - 62); g.stroke();
  outline(c);
  return { canvas: c, lure: { x: cx - 54, y: cy - 64 } };
}

export function bakeSprites() {
  return {
    ...bakeDiver(),
    jelly: bakeJelly(), moray: bakeMoray(), fish: bakeFish(),
    crystal: bakeCrystal(), node: bakeNode(), relic: bakeRelic(),
    rock: bakeRocks(), angler: bakeAngler(),
  };
}
```

- [ ] **Step 2: 렌더 모듈 구현**

`src/render.js`:
```js
import { VIEW_W, VIEW_H, TILE } from './constants.js';
import { T } from './world.js';

export class Camera {
  constructor() { this.x = 0; this.y = 0; }
  update(dt, tx, ty, world) {
    const gx = tx - VIEW_W / 2, gy = ty - VIEW_H / 2;
    const k = 1 - Math.exp(-8 * dt);
    this.x += (gx - this.x) * k;
    this.y += (gy - this.y) * k;
    this.x = Math.max(0, Math.min(world.w * TILE - VIEW_W, this.x));
    this.y = Math.max(0, Math.min(world.h * TILE - VIEW_H, this.y));
  }
}

const RAMP = ['#1c3464', '#12244c', '#0d1838', '#080e24', '#060918', '#04050e'];

export function drawBackground(ctx, cam, world) {
  const worldH = world.h * TILE;
  const grad = ctx.createLinearGradient(0, -cam.y, 0, worldH - cam.y);
  RAMP.forEach((c, i) => grad.addColorStop(i / (RAMP.length - 1), c));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawParallax(ctx, cam, worldH);
}

let ridgeFar = null, ridgeMid = null;
function bakeRidge(seed, amp, color) {
  const c = document.createElement('canvas');
  c.width = 960; c.height = 120;
  const g = c.getContext('2d');
  g.fillStyle = color;
  g.beginPath(); g.moveTo(0, 120);
  for (let x = 0; x <= 960; x += 4) {
    const y = 60 + Math.sin(x * 0.011 + seed) * amp + Math.sin(x * 0.037 + seed * 2) * amp * 0.4;
    g.lineTo(x, y);
  }
  g.lineTo(960, 120); g.closePath(); g.fill();
  return c;
}

function drawParallax(ctx, cam, worldH) {
  ridgeFar ??= bakeRidge(1.7, 22, 'rgba(14,22,48,0.55)');
  ridgeMid ??= bakeRidge(4.2, 30, 'rgba(9,14,32,0.7)');
  for (const [img, fx, fy, yoff] of [[ridgeFar, 0.25, 0.1, 110], [ridgeMid, 0.5, 0.2, 170]]) {
    const ox = -((cam.x * fx) % img.width);
    const oy = yoff - cam.y * fy;
    ctx.drawImage(img, ox, oy);
    ctx.drawImage(img, ox + img.width, oy);
  }
}

export function drawTiles(ctx, cam, world, S) {
  const x0 = Math.floor(cam.x / TILE), x1 = Math.ceil((cam.x + VIEW_W) / TILE);
  const y0 = Math.floor(cam.y / TILE), y1 = Math.ceil((cam.y + VIEW_H) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (tx < 0 || ty < 0 || tx >= world.w || ty >= world.h) continue;
      const t = world.tiles[ty * world.w + tx];
      const sx = Math.round(tx * TILE - cam.x), sy = Math.round(ty * TILE - cam.y);
      if (t === T.ROCK || t === T.HOLE)
        ctx.drawImage(S.rock[(tx * 7 + ty * 13) % 4], sx, sy);
      else if (t === T.GATE && world.gateClosed) {
        ctx.fillStyle = '#28425a';
        ctx.fillRect(sx + 5, sy, 6, TILE);
      }
      if (t === T.HOLE) {
        ctx.fillStyle = '#03040a';
        ctx.fillRect(sx + 3, sy + 3, 10, 10);
      }
    }
  }
}

export function drawDecor(ctx, cam, world, time) {
  for (const d of world.decor) {
    const sx = Math.round(d.x - cam.x), sy = Math.round(d.y - cam.y);
    if (sx < -8 || sx > VIEW_W + 8 || sy < -40 || sy > VIEW_H + 8) continue;
    if (d.type === 'kelp') {
      ctx.strokeStyle = '#16424e';
      ctx.beginPath(); ctx.moveTo(sx, sy);
      const h = 14 + (d.x % 12);
      const swayX = sx + Math.sin(time * 1.3 + d.x) * 2;
      ctx.quadraticCurveTo(sx, sy - h / 2, swayX, sy - h);
      ctx.stroke();
      ctx.fillStyle = d.color;
      ctx.fillRect(Math.round(swayX), Math.round(sy - h) - 1, 1, 1);
    } else {
      ctx.fillStyle = '#1c2a3a';
      ctx.fillRect(sx - 1, sy - 3, 3, 3);
      ctx.fillStyle = d.color;
      ctx.fillRect(sx, sy - 4, 1, 1);
    }
  }
}
```

- [ ] **Step 3: 임시 맵 + 게임 씬 + 연결**

`src/map.js` (임시 — Task 11에서 전체 맵으로 교체):
```js
// 60x30 temporary sandbox: base at top, open water, some rock shelves
const r = (s, n) => s.repeat(n);
export const MAP_ROWS = [
  r('#', 60),
  '#' + r('.', 58) + '#',
  '#....B' + r('.', 53) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#.....' + r('#', 20) + r('.', 33) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#..............' + r('#', 10) + r('.', 34) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#........V' + r('.', 49) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#....C.....C' + r('.', 47) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  '#' + r('.', 58) + '#',
  r('#', 60),
];
```

`src/game.js`:
```js
import { VIEW_W, VIEW_H } from './constants.js';
import { MAP_ROWS } from './map.js';
import { parseMap } from './world.js';
import { Player } from './player.js';
import { Input } from './input.js';
import { bakeSprites } from './sprites.js';
import { Camera, drawBackground, drawTiles, drawDecor } from './render.js';

export class GameScene {
  constructor(canvas) {
    this.world = parseMap(MAP_ROWS);
    this.S = bakeSprites();
    this.player = new Player(this.world.base.x, this.world.base.y);
    this.input = new Input();
    this.input.attach(canvas);
    this.cam = new Camera();
    this.time = 0;
  }

  update(dt) {
    this.time += dt;
    this.input.setPlayerScreen(
      this.player.x + this.player.w / 2 - this.cam.x,
      this.player.y + this.player.h / 2 - this.cam.y);
    this.input.update();
    this.player.update(dt, this.input, this.world);
    this.cam.update(dt, this.player.x + this.player.w / 2,
                    this.player.y + this.player.h / 2, this.world);
  }

  draw(ctx) {
    const { cam, world, S, player } = this;
    drawBackground(ctx, cam, world);
    drawDecor(ctx, cam, world, this.time);
    drawTiles(ctx, cam, world, S);
    const spr = player.facing >= 0 ? S.diverR : S.diverL;
    const bob = Math.sin(this.time * 3) * 1;
    if (!(player.invuln > 0 && Math.floor(this.time * 12) % 2)) {
      ctx.drawImage(spr,
        Math.round(player.x - cam.x - 4),
        Math.round(player.y - cam.y - 1 + bob));
    }
  }
}
```

`src/main.js` 수정 — 파일 하단의 기본 scene 정의 아래에 추가:
```js
import { GameScene } from './game.js';
setScene(new GameScene(canvas));
```
(임시 직결. Task 12에서 타이틀 씬으로 교체)

- [ ] **Step 4: 회귀 테스트 + 브라우저 확인**

Run: `node --test tests/`
Expected: 전부 PASS

브라우저 확인 체크리스트:
- WASD로 유영 — 관성 느껴짐, 벽에 막힘
- Shift 부스트 — 짧은 대시
- 마우스 위치 따라 다이버 좌우 반전
- 배경 그라데이션 + 패럴랙스 능선 + 바닥 산호 점 보임
- 카메라 부드럽게 추적, 픽셀 지터 없음

- [ ] **Step 5: Commit**

```bash
git add src/ index.html
git commit -m "feat: sprites, camera, tile/background render — swimmable world"
```

---

### Task 6: 라이팅 + 파티클 — 심해 무드

**Files:**
- Create: `src/lighting.js`, `src/particles.js`
- Modify: `src/game.js`

**Interfaces:**
- Consumes: Camera(cam.x/y), world 크기
- Produces:
  - `class Lighting { constructor(), begin(cam, world, forcedDark=false), addPoint(wx, wy, r, color='#fff', a=1), addCone(wx, wy, angle, spread, reach, color='#ffeec2'), apply(ctx), count }` — 좌표는 월드px, 내부에서 스크린 변환. `count`로 광원 수 추적, MAX 초과분 무시.
  - `class Particles { spawnBubble(x,y,vy=-18), spawnSpark(x,y,color,n=6), burst(x,y,color,n), update(dt, world, cam), draw(ctx, cam) }` — 부유물(motes)은 내부에서 자동 유지(~50개, 뷰 주변).
- 합성 순서(game.draw): 배경→데코→타일→엔티티 → `lighting.apply(ctx)` (multiply) → 발광체 glow(`lighter`) → 파티클 → HUD

- [ ] **Step 1: 구현**

`src/lighting.js`:
```js
import { VIEW_W, VIEW_H, TILE, LIGHT } from './constants.js';

export class Lighting {
  constructor() {
    this.c = document.createElement('canvas');
    this.c.width = VIEW_W; this.c.height = VIEW_H;
    this.g = this.c.getContext('2d');
  }

  begin(cam, world, forcedDark = false) {
    this.cam = cam;
    this.count = 0;
    const g = this.g;
    g.globalCompositeOperation = 'source-over';
    if (forcedDark) {
      g.fillStyle = '#0a0a12';
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    } else {
      const worldH = world.h * TILE;
      const aTop = ambientAt(cam.y, worldH), aBot = ambientAt(cam.y + VIEW_H, worldH);
      const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, ambColor(aTop));
      grad.addColorStop(1, ambColor(aBot));
      g.fillStyle = grad;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    g.globalCompositeOperation = 'lighter';
  }

  addPoint(wx, wy, r, color = '#ffffff', a = 1) {
    if (this.count >= LIGHT.MAX) return;
    const x = wx - this.cam.x, y = wy - this.cam.y;
    if (x < -r || y < -r || x > VIEW_W + r || y > VIEW_H + r) return;
    this.count++;
    const g = this.g;
    const grad = g.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalAlpha = a;
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
    g.globalAlpha = 1;
  }

  addCone(wx, wy, angle, spread, reach, color = '#ffeec2') {
    if (this.count >= LIGHT.MAX) return;
    this.count++;
    const g = this.g, x = wx - this.cam.x, y = wy - this.cam.y;
    g.save();
    g.beginPath();
    g.moveTo(x, y);
    g.arc(x, y, reach, angle - spread, angle + spread);
    g.closePath();
    g.clip();
    const grad = g.createRadialGradient(x, y, 4, x, y, reach);
    grad.addColorStop(0, color);
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(x - reach, y - reach, reach * 2, reach * 2);
    g.restore();
  }

  apply(ctx) {
    ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(this.c, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
  }
}

function ambientAt(worldY, worldH) {
  const t = Math.max(0, Math.min(1, worldY / worldH));
  return 0.75 - 0.63 * t; // 0.75 top → 0.12 bottom
}
function ambColor(a) {
  const r = Math.round(190 * a), g = Math.round(215 * a), b = Math.round(255 * a);
  return `rgb(${r},${g},${b})`;
}

export function glow(ctx, cam, wx, wy, r, color, a = 0.8) {
  const x = wx - cam.x, y = wy - cam.y;
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}
```

`src/particles.js`:
```js
import { VIEW_W, VIEW_H } from './constants.js';
import { rectHitsSolid } from './world.js';

export class Particles {
  constructor() { this.list = []; this.motes = []; }

  spawnBubble(x, y, vy = -18) {
    this.list.push({ t: 'bub', x, y, vx: 0, vy, life: 3, r: Math.random() < 0.3 ? 2 : 1 });
  }
  spawnSpark(x, y, color, n = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, s = 40 + Math.random() * 60;
      this.list.push({ t: 'spark', x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.35, color });
    }
  }
  burst(x, y, color, n = 10) { this.spawnSpark(x, y, color, n); }

  update(dt, world, cam) {
    while (this.motes.length < 50) {
      this.motes.push({
        x: cam.x + Math.random() * VIEW_W, y: cam.y + Math.random() * VIEW_H,
        vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4,
      });
    }
    for (const m of this.motes) {
      m.x += m.vx * dt; m.y += m.vy * dt;
      if (m.x < cam.x - 8) m.x += VIEW_W + 16;
      if (m.x > cam.x + VIEW_W + 8) m.x -= VIEW_W + 16;
      if (m.y < cam.y - 8) m.y += VIEW_H + 16;
      if (m.y > cam.y + VIEW_H + 8) m.y -= VIEW_H + 16;
    }
    this.list = this.list.filter(p => {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.t === 'bub') {
        p.x += Math.sin(p.y * 0.1) * 6 * dt;
        if (rectHitsSolid(world, p.x, p.y, 1, 1)) return false;
      }
      return p.life > 0;
    });
  }

  draw(ctx, cam) {
    ctx.fillStyle = 'rgba(150,190,220,0.25)';
    for (const m of this.motes)
      ctx.fillRect(Math.round(m.x - cam.x), Math.round(m.y - cam.y), 1, 1);
    for (const p of this.list) {
      const x = Math.round(p.x - cam.x), y = Math.round(p.y - cam.y);
      if (p.t === 'bub') {
        ctx.strokeStyle = 'rgba(180,220,240,0.5)';
        ctx.strokeRect(x - p.r, y - p.r, p.r * 2, p.r * 2);
      } else {
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.max(0, p.life / 0.35);
        ctx.fillRect(x, y, 1, 1);
        ctx.globalAlpha = 1;
      }
    }
  }
}
```

- [ ] **Step 2: game.js 통합**

`src/game.js` 수정 — import 추가, constructor에 생성, update/draw 확장:
```js
import { Lighting, glow } from './lighting.js';
import { Particles } from './particles.js';
import { LIGHT, PLAYER as P } from './constants.js';
```
constructor에 추가:
```js
    this.lighting = new Lighting();
    this.particles = new Particles();
    this.bubbleTimer = 0;
```
update 끝에 추가:
```js
    this.particles.update(dt, this.world, this.cam);
    this.bubbleTimer -= dt;
    if (this.bubbleTimer <= 0) {
      this.bubbleTimer = 0.9 + Math.random() * 0.6;
      this.particles.spawnBubble(this.player.x + (this.player.facing > 0 ? 2 : this.player.w - 2), this.player.y);
      for (const v of this.world.vents)
        if (Math.abs(v.x - this.cam.x - 240) < 300) this.particles.spawnBubble(v.x, v.y - 6, -30);
    }
```
draw를 다음 순서로 재구성 (기존 엔티티 그리기 유지):
```js
  draw(ctx) {
    const { cam, world, S, player } = this;
    drawBackground(ctx, cam, world);
    drawDecor(ctx, cam, world, this.time);
    drawTiles(ctx, cam, world, S);
    // ... (다이버 draw 기존 코드) ...

    // lighting
    const L = this.lighting;
    L.begin(cam, world);
    const px = player.x + player.w / 2, py = player.y + player.h / 2;
    const ang = Math.atan2(this.input.aim.y, this.input.aim.x);
    L.addCone(px, py, ang, LIGHT.LAMP_SPREAD, LIGHT.LAMP_REACH);
    L.addPoint(px, py, 30, '#ffeec2', 0.6);
    let decorLights = 0;
    for (const d of world.decor) {
      if (decorLights >= 6) break;
      if (Math.abs(d.x - px) < 260 && Math.abs(d.y - py) < 160) {
        L.addPoint(d.x, d.y - 3, 22, d.color, 0.35);
        decorLights++;
      }
    }
    L.apply(ctx);

    // emissive glows on top
    glow(ctx, cam, px + this.input.aim.x * 8, py + this.input.aim.y * 8, 6, '#fff4d0', 0.5);
    this.particles.draw(ctx, cam);
  }
```

- [ ] **Step 3: 회귀 + 브라우저 확인**

Run: `node --test tests/`
Expected: 전부 PASS

브라우저 체크리스트:
- 위는 밝고 아래로 내려가면 어두워짐
- 헤드램프 원뿔이 마우스 방향을 따라감, 원뿔 밖은 어두움
- 산호 불빛들이 은은하게 주변을 밝힘
- 기포가 플레이어와 분출구에서 올라옴, 부유물이 떠다님
- 60fps 유지 (devtools performance 확인)

- [ ] **Step 4: Commit**

```bash
git add src/lighting.js src/particles.js src/game.js
git commit -m "feat: realtime lightmap (ambient/cone/points) and particles"
```

---

### Task 7: 작살 전투 + 크리스탈 노드/픽업

**Files:**
- Create: `src/harpoon.js`
- Modify: `src/game.js`
- Test: `tests/harpoon.test.js`

**Interfaces:**
- Consumes: `rectHitsSolid`, player의 `fireCd`/`dmgValue()`
- Produces:
  - `class Harpoons { list, tryFire(x, y, aim, speed, dmg, cdRef) → bool, update(dt, world), draw(ctx, cam), hitTest(rect) → harpoon|null }` — harpoon: `{x, y, vx, vy, dmg, dead, stuck}`. 벽에 맞으면 0.3s 박혔다 사라짐. `hitTest`는 살아있는 작살과 rect AABB 검사 후 해당 작살 반환(호출측이 dead 처리).
  - game.js에 크리스탈 픽업 엔티티: `{x, y, vx, vy, t}` — 노드 파괴 시 3개 산란, 부유 감속, 플레이어 접촉 시 `pickupCrystal(1)`
  - 노드는 `world.nodes` (hp>0만 표시/충돌), 작살 명중 시 hp--, 0이면 픽업 산란

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/harpoon.test.js`:
```js
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
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node --test tests/`
Expected: FAIL — harpoon.js 없음

- [ ] **Step 3: 구현**

`src/harpoon.js`:
```js
import { PLAYER as P } from './constants.js';
import { rectHitsSolid } from './world.js';

export class Harpoons {
  constructor() { this.list = []; }

  tryFire(x, y, aim, speed, dmg, cdRef) {
    if (cdRef.fireCd > 0) return false;
    cdRef.fireCd = P.FIRE_CD;
    this.list.push({ x, y, vx: aim.x * speed, vy: aim.y * speed, dmg, dead: false, stuck: 0 });
    return true;
  }

  update(dt, world) {
    for (const h of this.list) {
      if (h.stuck > 0) {
        h.stuck -= dt;
        if (h.stuck <= 0) h.dead = true;
        continue;
      }
      h.x += h.vx * dt; h.y += h.vy * dt;
      if (rectHitsSolid(world, h.x - 1, h.y - 1, 2, 2)) {
        h.stuck = 0.3; h.vx = h.vy = 0;
      }
    }
    this.list = this.list.filter(h => !h.dead);
  }

  hitTest(r) {
    for (const h of this.list) {
      if (h.dead || h.stuck > 0) continue;
      if (h.x > r.x && h.x < r.x + r.w && h.y > r.y && h.y < r.y + r.h) return h;
    }
    return null;
  }

  draw(ctx, cam) {
    for (const h of this.list) {
      const x = Math.round(h.x - cam.x), y = Math.round(h.y - cam.y);
      const a = Math.atan2(h.vy, h.vx);
      ctx.strokeStyle = '#aab8c6';
      ctx.beginPath();
      ctx.moveTo(x - Math.cos(a) * 6, y - Math.sin(a) * 6);
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.fillStyle = '#e0e8ee';
      ctx.fillRect(x, y, 2, 1);
    }
  }
}
```

- [ ] **Step 4: game.js 통합**

`src/game.js` 수정:
```js
import { Harpoons } from './harpoon.js';
import { CRYSTALS_PER_NODE } from './constants.js';
```
constructor: `this.harpoons = new Harpoons(); this.pickups = [];`

update에 추가 (player.update 이후):
```js
    if (this.input.firing) {
      const px = this.player.x + this.player.w / 2, py = this.player.y + this.player.h / 2;
      if (this.harpoons.tryFire(px + this.input.aim.x * 12, py + this.input.aim.y * 12,
          this.input.aim, P.HARPOON_SPD, this.player.dmgValue(), this.player))
        this.particles.spawnBubble(px, py);
    }
    this.harpoons.update(dt, this.world);

    // crystal nodes
    for (const n of this.world.nodes) {
      if (n.hp <= 0) continue;
      const hit = this.harpoons.hitTest({ x: n.x - 8, y: n.y - 6, w: 16, h: 12 });
      if (hit) {
        hit.dead = true;
        n.hp -= 1;
        this.particles.spawnSpark(n.x, n.y, '#5ae0e6');
        if (n.hp <= 0) {
          for (let i = 0; i < CRYSTALS_PER_NODE; i++) {
            const a = Math.random() * Math.PI * 2;
            this.pickups.push({ kind: 'crystal', x: n.x, y: n.y,
              vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 15, t: 0 });
          }
        }
      }
    }

    // pickups drift & collect
    const pr = this.player;
    this.pickups = this.pickups.filter(pk => {
      pk.t += dt;
      pk.vx *= 0.95; pk.vy *= 0.95;
      pk.x += pk.vx * dt; pk.y += pk.vy * dt + Math.sin(pk.t * 3) * 0.15;
      if (!pr.dead && Math.abs(pk.x - pr.x - pr.w / 2) < 12 && Math.abs(pk.y - pr.y - pr.h / 2) < 10) {
        if (pk.kind === 'crystal') pr.pickupCrystal(1);
        else pr.hasRelic = true;
        this.particles.spawnSpark(pk.x, pk.y, '#b8f8fa');
        return false;
      }
      return true;
    });
```

draw에 추가 (다이버 draw 다음, lighting 전):
```js
    for (const n of world.nodes)
      if (n.hp > 0)
        ctx.drawImage(S.node, Math.round(n.x - 8 - cam.x), Math.round(n.y - 5 - cam.y));
    for (const pk of this.pickups)
      ctx.drawImage(pk.kind === 'crystal' ? S.crystal : S.relic,
        Math.round(pk.x - 3 - cam.x), Math.round(pk.y - 4 - cam.y));
    this.harpoons.draw(ctx, cam);
```
lighting 섹션에 추가 (decor 루프 뒤):
```js
    for (const n of world.nodes)
      if (n.hp > 0 && Math.abs(n.x - px) < 260) L.addPoint(n.x, n.y, 18, '#5ae0e6', 0.4);
```

- [ ] **Step 5: 테스트 + 브라우저 확인**

Run: `node --test tests/`
Expected: 전부 PASS

브라우저: 클릭으로 작살 발사(마우스 방향), 노드 2방에 파괴 → 크리스탈 3개 흩어짐 → 접촉 수집. 스파크 이펙트 확인.

- [ ] **Step 6: Commit**

```bash
git add src/harpoon.js src/game.js tests/harpoon.test.js
git commit -m "feat: harpoon combat, crystal nodes and pickups"
```

---

### Task 8: HUD + 거점 은행/업그레이드 메뉴

**Files:**
- Create: `src/hud.js`
- Modify: `src/game.js`
- Test: `tests/hud.test.js`

**Interfaces:**
- Consumes: player 필드 전부, `UPGRADES`
- Produces:
  - `drawText(ctx, s, x, y, color, scale=1)` — 3×5 내장 폰트 (A-Z, 0-9, 공백, `-+!.`)
  - `textWidth(s, scale=1) → number`
  - `drawHud(ctx, player)` — O2바(라벨 O2), 하트, 크리스탈 수(carried/banked), DEPTH 미터(`Math.round(player.y / 4) + 'M'`)
  - `drawBossBar(ctx, name, frac)`
  - `class UpgradeMenu { open: bool, layout(player) → buttons: [{key,x,y,w,h,label,cost,owned,affordable}], draw(ctx, player), click(x, y, player) → 'bought'|'closed'|null }` — 메뉴 하단에 CLOSE 버튼.
  - `menuButtons`는 뷰 좌표(480×270) 기준. 터치 대응 위해 버튼 높이 ≥ 24px.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/hud.test.js`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { textWidth, UpgradeMenu } from '../src/hud.js';
import { Player } from '../src/player.js';
import { UPGRADES } from '../src/constants.js';

test('textWidth measures 4px per char', () => {
  assert.equal(textWidth('ABC'), 12);
  assert.equal(textWidth('AB', 2), 16);
});

test('upgrade menu click buys when affordable', () => {
  const m = new UpgradeMenu();
  m.open = true;
  const p = new Player(0, 0);
  p.banked = UPGRADES.tank.cost;
  const btn = m.layout(p).find(b => b.key === 'tank');
  assert.equal(m.click(btn.x + 2, btn.y + 2, p), 'bought');
  assert.equal(p.upgrades.tank, true);
  // second click: owned, no purchase
  assert.equal(m.click(btn.x + 2, btn.y + 2, p), null);
});

test('close button closes menu', () => {
  const m = new UpgradeMenu();
  m.open = true;
  const p = new Player(0, 0);
  const close = m.layout(p).find(b => b.key === 'close');
  assert.equal(m.click(close.x + 1, close.y + 1, p), 'closed');
  assert.equal(m.open, false);
});
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node --test tests/`
Expected: FAIL — hud.js 없음

- [ ] **Step 3: 구현**

`src/hud.js`:
```js
import { VIEW_W, VIEW_H, UPGRADES, PLAYER as P } from './constants.js';

const F = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011',
  D: '110101101101110', E: '111100110100111', F: '111100110100100',
  G: '011100101101011', H: '101101111101101', I: '111010010010111',
  J: '001001001101010', K: '101110100110101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010',
  P: '110101110100100', Q: '010101101011001', R: '110101110110101',
  S: '011100010001110', T: '111010010010010', U: '101101101101011',
  V: '101101101010010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111',
  0: '010101101101010', 1: '010110010010111', 2: '110001010100111',
  3: '110001010001110', 4: '101101111001001', 5: '111100110001110',
  6: '011100110101010', 7: '111001010010010', 8: '010101010101010',
  9: '010101011001110',
  ' ': '000000000000000', '-': '000000111000000', '+': '000010111010000',
  '!': '010010010000010', '.': '000000000000010',
};

export function drawText(ctx, s, x, y, color, scale = 1) {
  ctx.fillStyle = color;
  let cx = x;
  for (const ch of String(s).toUpperCase()) {
    const pat = F[ch];
    if (pat) for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++)
      if (pat[j * 3 + i] === '1') ctx.fillRect(cx + i * scale, y + j * scale, scale, scale);
    cx += 4 * scale;
  }
}
export function textWidth(s, scale = 1) { return String(s).length * 4 * scale; }

export function drawHud(ctx, player) {
  // O2 bar
  ctx.fillStyle = '#080a14'; ctx.fillRect(6, 6, 62, 7);
  ctx.strokeStyle = '#5a788c'; ctx.strokeRect(5.5, 5.5, 63, 8);
  const frac = player.o2 / player.o2Max();
  ctx.fillStyle = frac < 0.25 ? '#e05a5a' : '#5ac8e6';
  ctx.fillRect(7, 7, Math.round(60 * frac), 5);
  drawText(ctx, 'O2', 72, 7, '#8cc8dc');
  // hearts
  for (let i = 0; i < P.HP_MAX; i++) {
    ctx.fillStyle = i < player.hp ? '#e64656' : '#2a1e2c';
    const x = 6 + i * 9;
    ctx.fillRect(x, 17, 3, 3); ctx.fillRect(x + 4, 17, 3, 3);
    ctx.fillRect(x + 1, 20, 5, 2); ctx.fillRect(x + 2, 22, 3, 1);
  }
  // crystals
  ctx.fillStyle = '#5ae0e6';
  ctx.fillRect(6, 27, 3, 5); ctx.fillRect(7, 26, 1, 7);
  drawText(ctx, `${player.carried}+${player.banked}`, 13, 27, '#9ff0f4');
  // depth
  const depth = Math.max(0, Math.round(player.y / 4));
  const label = `DEPTH ${depth}M`;
  drawText(ctx, label, VIEW_W - textWidth(label) - 6, 7, '#78a0be');
  if (player.hasRelic) drawText(ctx, 'RELIC!', VIEW_W - 30, 17, '#ffd870');
}

export function drawBossBar(ctx, name, frac) {
  const bw = 180, x0 = (VIEW_W - bw) / 2, y0 = VIEW_H - 20;
  drawText(ctx, name, (VIEW_W - textWidth(name)) / 2, y0 - 8, '#dcbec8');
  ctx.fillStyle = '#0a060e'; ctx.fillRect(x0, y0, bw, 7);
  ctx.strokeStyle = '#78465a'; ctx.strokeRect(x0 - 0.5, y0 - 0.5, bw + 1, 8);
  ctx.fillStyle = '#be3246';
  ctx.fillRect(x0 + 1, y0 + 1, Math.round((bw - 2) * Math.max(0, frac)), 5);
}

export class UpgradeMenu {
  constructor() { this.open = false; }

  layout(player) {
    const keys = Object.keys(UPGRADES);
    const bw = 190, bh = 26, x = (VIEW_W - bw) / 2;
    const btns = keys.map((key, i) => {
      const u = UPGRADES[key];
      return {
        key, x, y: 70 + i * (bh + 8), w: bw, h: bh,
        label: u.label, cost: u.cost,
        owned: player.upgrades[key], affordable: player.banked >= u.cost,
      };
    });
    btns.push({ key: 'close', x, y: 70 + keys.length * (bh + 8), w: bw, h: 20, label: 'CLOSE' });
    return btns;
  }

  click(x, y, player) {
    if (!this.open) return null;
    for (const b of this.layout(player)) {
      if (x < b.x || x > b.x + b.w || y < b.y || y > b.y + b.h) continue;
      if (b.key === 'close') { this.open = false; return 'closed'; }
      if (player.buyUpgrade(b.key)) return 'bought';
      return null;
    }
    return null;
  }

  draw(ctx, player) {
    if (!this.open) return;
    ctx.fillStyle = 'rgba(4,6,14,0.85)';
    ctx.fillRect(100, 40, VIEW_W - 200, 190);
    ctx.strokeStyle = '#4a7890';
    ctx.strokeRect(100.5, 40.5, VIEW_W - 200, 190);
    drawText(ctx, 'SUBMARINE - UPGRADES', (VIEW_W - textWidth('SUBMARINE - UPGRADES', 2)) / 2, 48, '#9fd0e0', 2);
    for (const b of this.layout(player)) {
      const col = b.key === 'close' ? '#3a5468' : b.owned ? '#2a4a3a' : b.affordable ? '#2a5a78' : '#28303c';
      ctx.fillStyle = col;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      const txt = b.key === 'close' ? 'CLOSE'
        : b.owned ? `${b.label} - OK`
        : `${b.label} - ${b.cost} CRYSTAL`;
      drawText(ctx, txt, b.x + 8, b.y + (b.h - 5) / 2, b.owned ? '#8ce0a8' : '#d0e8f0');
    }
    drawText(ctx, `BANKED ${player.banked}`, 108, 214, '#9ff0f4');
  }
}
```

- [ ] **Step 4: game.js 통합 — 거점 접촉 은행/메뉴**

`src/game.js` 수정:
```js
import { drawHud, drawBossBar, UpgradeMenu } from './hud.js';
```
constructor: `this.menu = new UpgradeMenu(); this.atBase = false;`

update 시작 부분(input.update 후)에 메뉴 처리:
```js
    if (this.menu.open) {
      if (this.input.consumeClick())
        this.menu.click(this.input.pointer.x, this.input.pointer.y, this.player);
      return; // pause world while menu open
    }
```
update에 거점/분출구/체크포인트 접촉 추가 (player.update 후):
```js
    const pcx = this.player.x + this.player.w / 2, pcy = this.player.y + this.player.h / 2;
    const near = (pt, r) => Math.abs(pt.x - pcx) < r && Math.abs(pt.y - pcy) < r;
    for (const v of this.world.vents)
      if (near(v, 20)) this.player.addO2(P.O2_VENT_REFILL, dt);
    for (const k of this.world.checkpoints)
      if (near(k, 16)) this.player.setCheckpoint(k.x, k.y);
    const wasAtBase = this.atBase;
    this.atBase = near(this.world.base, 24);
    if (this.atBase && !wasAtBase) {
      this.player.bank();
      this.player.setCheckpoint(this.world.base.x, this.world.base.y);
      this.menu.open = true;
    }
```
draw 끝에 추가:
```js
    drawHud(ctx, player);
    this.menu.draw(ctx, player);
```
draw의 타일 이후에 거점 잠수정 표시:
```js
    // base submarine marker
    const b = world.base;
    ctx.fillStyle = '#3a5468';
    ctx.fillRect(Math.round(b.x - 14 - cam.x), Math.round(b.y - 6 - cam.y), 28, 12);
    ctx.fillStyle = '#78dceb';
    ctx.fillRect(Math.round(b.x + 6 - cam.x), Math.round(b.y - 3 - cam.y), 4, 4);
```
lighting에 거점 광원 추가: `L.addPoint(b.x, b.y, 44, '#9fd0e0', 0.5);`

- [ ] **Step 5: 테스트 + 브라우저 확인**

Run: `node --test tests/`
Expected: 전부 PASS

브라우저: 크리스탈 몇 개 수집 → 거점 접촉 → 은행 + 메뉴 열림 → 업그레이드 구매/CLOSE. HUD의 O2/하트/크리스탈/DEPTH 표시 확인. 메뉴 열린 동안 월드 정지 확인.

- [ ] **Step 6: Commit**

```bash
git add src/hud.js src/game.js tests/hud.test.js
git commit -m "feat: HUD, base banking and upgrade menu"
```

---

### Task 9: 적 3종 — 해파리 / 곰치 / 심해어 떼

**Files:**
- Create: `src/enemies.js`
- Modify: `src/game.js`
- Test: `tests/enemies.test.js`

**Interfaces:**
- Consumes: `moveAndCollide`, `ENEMY` 상수, player rect/damage
- Produces:
  - `inCone(cone, x, y) → bool` — cone `{x, y, angle, spread, reach}`
  - `class Jellyfish { x,y,w,h,hp,dead, update(dt, world, player), rect() }` — 세로 왕복 부유(스폰점 ±28px, sin), 접촉: `player.damage(1)` + `player.slow = SLOW_TIME`
  - `class Moray { state:'hidden'|'lunge'|'recover', update(dt, world, player), rect() }` — hidden 중 dir 방향 ±60° 원뿔 60px 내 플레이어 감지 → lunge (dir 방향 LUNGE_SPD, LUNGE_TIME) → recover(RECOVER 초, 구멍 복귀) → hidden. lunge 중 접촉 피해. hidden 중 무적(hp 감소 없음).
  - `class Fish { x,y,w,h,hp,dead,aggro, update(dt, world, player, lampCone), rect() }` — 비어그로: 랜덤 방향 전환 배회. `inCone(lampCone, 중심)` → aggro=true + calm 타이머 리셋. aggro: 플레이어 추격(CHASE_SPD), 원뿔 밖 CALM_TIME 지나면 배회 복귀. 접촉 피해(공유 쿨다운은 player.invuln이 담당).
  - 모두 `takeDamage(n)` — hp<=0 → dead=true

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/enemies.test.js`:
```js
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
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node --test tests/`
Expected: FAIL — enemies.js 없음

- [ ] **Step 3: 구현**

`src/enemies.js`:
```js
import { ENEMY } from './constants.js';
import { moveAndCollide } from './world.js';

export function inCone(cone, x, y) {
  const dx = x - cone.x, dy = y - cone.y;
  const d = Math.hypot(dx, dy);
  if (d > cone.reach) return false;
  let da = Math.atan2(dy, dx) - cone.angle;
  da = Math.atan2(Math.sin(da), Math.cos(da));
  return Math.abs(da) <= cone.spread;
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}
const prect = p => ({ x: p.x, y: p.y, w: p.w, h: p.h });

export class Jellyfish {
  constructor(x, y) {
    this.x = x - 7; this.y = y - 8; this.w = 14; this.h = 12;
    this.hp = ENEMY.JELLY.HP; this.dead = false;
    this.oy = y; this.t = Math.random() * 6;
  }
  rect() { return this; }
  takeDamage(n) { this.hp -= n; if (this.hp <= 0) this.dead = true; }
  update(dt, world, player) {
    this.t += dt;
    this.y = this.oy - 8 + Math.sin(this.t * ENEMY.JELLY.SPD / 14) * 28;
    if (!player.dead && overlaps(this, prect(player))) {
      if (player.damage(ENEMY.JELLY.DMG, this.x)) player.slow = 0.8;
    }
  }
}

export class Moray {
  constructor(x, y, dir) {
    this.hx = x; this.hy = y; this.dir = dir;
    this.x = x - 6; this.y = y - 5; this.w = 22; this.h = 10;
    this.vx = 0; this.vy = 0;
    this.hp = ENEMY.MORAY.HP; this.dead = false;
    this.state = 'hidden'; this.timer = 0;
  }
  rect() { return this; }
  takeDamage(n) {
    if (this.state === 'hidden') return; // safe in hole
    this.hp -= n; if (this.hp <= 0) this.dead = true;
  }
  update(dt, world, player) {
    const E = ENEMY.MORAY;
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    if (this.state === 'hidden') {
      const cone = { x: this.hx, y: this.hy, angle: Math.atan2(this.dir.y, this.dir.x), spread: 1.05, reach: E.TRIGGER };
      if (!player.dead && inCone(cone, pcx, pcy)) {
        this.state = 'lunge'; this.timer = E.LUNGE_TIME;
        this.vx = this.dir.x * E.LUNGE_SPD; this.vy = this.dir.y * E.LUNGE_SPD;
      }
    } else if (this.state === 'lunge') {
      this.timer -= dt;
      moveAndCollide(world, this, dt);
      if (!player.dead && overlaps(this, prect(player))) player.damage(E.DMG, this.x);
      if (this.timer <= 0) { this.state = 'recover'; this.timer = E.RECOVER; }
    } else { // recover: ease back to hole
      this.timer -= dt;
      this.x += (this.hx - 6 - this.x) * 3 * dt;
      this.y += (this.hy - 5 - this.y) * 3 * dt;
      if (this.timer <= 0) { this.state = 'hidden'; this.x = this.hx - 6; this.y = this.hy - 5; }
    }
  }
}

export class Fish {
  constructor(x, y) {
    this.x = x; this.y = y; this.w = 8; this.h = 5;
    this.vx = 0; this.vy = 0;
    this.hp = ENEMY.FISH.HP; this.dead = false;
    this.aggro = false; this.calm = 0; this.turn = 0;
    this.dir = Math.random() * Math.PI * 2;
  }
  rect() { return this; }
  takeDamage(n) { this.hp -= n; if (this.hp <= 0) this.dead = true; }
  update(dt, world, player, lampCone) {
    const E = ENEMY.FISH;
    const cx = this.x + 4, cy = this.y + 2;
    if (!player.dead && lampCone && inCone(lampCone, cx, cy)) {
      this.aggro = true; this.calm = E.CALM_TIME;
    } else if (this.aggro) {
      this.calm -= dt;
      if (this.calm <= 0) this.aggro = false;
    }
    if (this.aggro && !player.dead) {
      const a = Math.atan2(player.y + player.h / 2 - cy, player.x + player.w / 2 - cx);
      this.vx += (Math.cos(a) * E.CHASE_SPD - this.vx) * 4 * dt;
      this.vy += (Math.sin(a) * E.CHASE_SPD - this.vy) * 4 * dt;
    } else {
      this.turn -= dt;
      if (this.turn <= 0) { this.turn = 1 + Math.random() * 2; this.dir = Math.random() * Math.PI * 2; }
      this.vx += (Math.cos(this.dir) * E.WANDER_SPD - this.vx) * 2 * dt;
      this.vy += (Math.sin(this.dir) * E.WANDER_SPD - this.vy) * 2 * dt;
    }
    const r = moveAndCollide(world, this, dt);
    if (r.hitX || r.hitY) this.dir += Math.PI / 2 + Math.random();
    if (!player.dead && overlaps(this, prect(player))) player.damage(E.DMG, this.x);
  }
}
```

- [ ] **Step 4: game.js 통합**

`src/game.js` 수정:
```js
import { Jellyfish, Moray, Fish } from './enemies.js';
import { ENEMY } from './constants.js'; // LIGHT는 Task 6에서 이미 import됨 — 기존 라인에 병합
```
constructor에 스폰:
```js
    this.enemies = [
      ...this.world.jelly.map(j => new Jellyfish(j.x, j.y)),
      ...this.world.holes.map(h => new Moray(h.x, h.y, h.dir)),
    ];
    for (const f of this.world.fishSpawns)
      for (let i = 0; i < ENEMY.FISH.PER_SCHOOL; i++)
        this.enemies.push(new Fish(f.x + (Math.random() - 0.5) * 30, f.y + (Math.random() - 0.5) * 20));
```
update에 (harpoons.update 뒤):
```js
    const lampCone = {
      x: pcx, y: pcy,
      angle: Math.atan2(this.input.aim.y, this.input.aim.x),
      spread: LIGHT.LAMP_SPREAD, reach: LIGHT.LAMP_REACH,
    };
    for (const e of this.enemies) {
      e.update(dt, this.world, this.player, lampCone);
      const hit = this.harpoons.hitTest(e.rect());
      if (hit) {
        hit.dead = true;
        e.takeDamage(hit.dmg);
        this.particles.spawnSpark(e.x + e.w / 2, e.y + e.h / 2, '#ffb0a0');
      }
    }
    this.enemies = this.enemies.filter(e => !e.dead);
```
(주의: update 안에서 `pcx/pcy` 정의가 이 지점보다 앞에 오도록 순서 유지)

draw에 적 렌더 (노드 draw 근처):
```js
    for (const e of this.enemies) {
      const ex = Math.round(e.x - cam.x), ey = Math.round(e.y - cam.y);
      if (e instanceof Jellyfish) ctx.drawImage(S.jelly, ex, ey);
      else if (e instanceof Moray) {
        if (e.state !== 'hidden') {
          if (e.dir.x < 0) {
            ctx.save(); ctx.translate(ex + 26, ey); ctx.scale(-1, 1);
            ctx.drawImage(S.moray, 0, 0); ctx.restore();
          } else ctx.drawImage(S.moray, ex, ey);
        }
      } else {
        if (e.vx < 0) {
          ctx.save(); ctx.translate(ex + 8, ey); ctx.scale(-1, 1);
          ctx.drawImage(S.fish, 0, 0); ctx.restore();
        } else ctx.drawImage(S.fish, ex, ey);
        if (e.aggro) { ctx.fillStyle = '#ff5050'; ctx.fillRect(ex + (e.vx < 0 ? 5 : 2), ey + 1, 1, 1); }
      }
    }
```
lighting에 해파리 발광 추가 (decor 루프 뒤):
```js
    for (const e of this.enemies)
      if (e instanceof Jellyfish && Math.abs(e.x - px) < 260)
        L.addPoint(e.x + 7, e.y + 5, 26, '#be8cff', 0.4);
```

- [ ] **Step 5: 테스트 + 브라우저 확인**

Run: `node --test tests/`
Expected: 전부 PASS

브라우저: 임시 맵에 M/J/F를 몇 개 추가해 (`src/map.js` 행 수정) 확인 — 해파리 상하 왕복+보라 발광, 곰치가 다가가면 튀어나옴, 물고기가 램프에 닿으면 빨간 점 + 추격, 작살로 처치 가능, 접촉 시 하트 감소+넉백.

- [ ] **Step 6: Commit**

```bash
git add src/enemies.js src/game.js src/map.js tests/enemies.test.js
git commit -m "feat: jellyfish, moray ambusher, light-aggro fish"
```

---

### Task 10: 보스 — ABYSSAL ANGLER

**Files:**
- Create: `src/boss.js`
- Modify: `src/game.js`
- Test: `tests/boss.test.js`

**Interfaces:**
- Consumes: `BOSS` 상수, `moveAndCollide`, Fish 클래스(소환)
- Produces: `class Angler`
  - 필드: `x,y,w,h,vx,vy,hp,dead,state('idle'|'telegraph'|'charge'|'stun'|'summon'),timer,facing`
  - `constructor(x, y)` — x,y는 중심
  - `phase2() → bool` — `hp <= BOSS.HP * PHASE2_AT`
  - `lure() → {x, y}` — 루어 월드좌표. 몸 중심 기준 오프셋 `{x: facing * 42, y: -34}` (스프라이트는 왼쪽 보기 기준, facing으로 미러)
  - `rect() → {x,y,w,h}` (충돌용, 스프라이트보다 작은 몸통 박스)
  - `takeDamage(n)`
  - `update(dt, world, player, onSummon)` — onSummon(x, y) 콜백. 상태기계: idle(IDLE_TIME, phase2면 ×0.6) → 랜덤으로 telegraph 또는 summon. telegraph(TELEGRAPH초, 루어 깜빡임 플래그 `flash`) → charge (텔레그래프 종료 시점의 플레이어 방향, CHARGE_SPD, phase2면 ×1.25, 벽 충돌 시) → stun(STUN) → idle. summon → SUMMON_COUNT 마리 콜백 → idle. 접촉 시 CONTACT_DMG.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/boss.test.js`:
```js
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
```

- [ ] **Step 2: 실행해서 실패 확인**

Run: `node --test tests/`
Expected: FAIL — boss.js 없음

- [ ] **Step 3: 구현**

`src/boss.js`:
```js
import { BOSS as B } from './constants.js';
import { moveAndCollide } from './world.js';

export class Angler {
  constructor(x, y) {
    this.w = B.W; this.h = B.H;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = 0; this.vy = 0;
    this.hp = B.HP; this.dead = false;
    this.state = 'idle'; this.timer = B.IDLE_TIME;
    this.facing = -1; // sprite faces left
    this.flash = false;
    this._chargeDir = { x: -1, y: 0 };
  }

  phase2() { return this.hp <= B.HP * B.PHASE2_AT; }
  rect() { return { x: this.x + 10, y: this.y + 8, w: this.w - 20, h: this.h - 16 }; }
  lure() {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    return { x: cx + this.facing * 42, y: cy - 34 };
  }
  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  update(dt, world, player, onSummon) {
    if (this.dead) return;
    const p2 = this.phase2();
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    this.facing = pcx < cx ? -1 : 1;
    this.timer -= dt;
    this.flash = false;

    switch (this.state) {
      case 'idle': {
        // drift toward player slowly
        this.vx += Math.sign(pcx - cx) * 20 * dt;
        this.vy += Math.sign(pcy - cy) * 20 * dt;
        this.vx *= 0.98; this.vy *= 0.98;
        moveAndCollide(world, this, dt);
        if (this.timer <= 0) {
          if (Math.random() < 0.35) { this.state = 'summon'; this.timer = 0.5; }
          else { this.state = 'telegraph'; this.timer = B.TELEGRAPH; }
        }
        break;
      }
      case 'telegraph': {
        this.flash = Math.floor(this.timer * 10) % 2 === 0;
        this.vx = this.vy = 0;
        if (this.timer <= 0) {
          const d = Math.hypot(pcx - cx, pcy - cy) || 1;
          this._chargeDir = { x: (pcx - cx) / d, y: (pcy - cy) / d };
          this.state = 'charge';
          this.timer = 2.5; // safety cap
        }
        break;
      }
      case 'charge': {
        const spd = B.CHARGE_SPD * (p2 ? 1.25 : 1);
        this.vx = this._chargeDir.x * spd;
        this.vy = this._chargeDir.y * spd;
        const r = moveAndCollide(world, this, dt);
        if (r.hitX || r.hitY || this.timer <= 0) { this.state = 'stun'; this.timer = B.STUN; }
        break;
      }
      case 'stun': {
        this.vx = this.vy = 0;
        if (this.timer <= 0) { this.state = 'idle'; this.timer = B.IDLE_TIME * (p2 ? 0.6 : 1); }
        break;
      }
      case 'summon': {
        if (this.timer <= 0) {
          for (let i = 0; i < B.SUMMON_COUNT + (p2 ? 1 : 0); i++)
            onSummon(cx + (Math.random() - 0.5) * 60, cy + (Math.random() - 0.5) * 40);
          this.state = 'idle'; this.timer = B.IDLE_TIME * (p2 ? 0.6 : 1);
        }
        break;
      }
    }

    // contact damage
    const r = this.rect();
    if (!player.dead &&
        player.x < r.x + r.w && player.x + player.w > r.x &&
        player.y < r.y + r.h && player.y + player.h > r.y)
      player.damage(B.CONTACT_DMG, cx);
  }
}
```

- [ ] **Step 4: game.js 통합 — 아레나/게이트/보스바/조명 페이즈**

`src/game.js` 수정:
```js
import { Angler } from './boss.js';
import { setGate } from './world.js';
import { BOSS } from './constants.js';
```
constructor:
```js
    this.boss = this.world.angler ? new Angler(this.world.angler.x, this.world.angler.y) : null;
    this.bossActive = false;
    this.relicDropped = false;
```
update에 (enemies 처리 뒤):
```js
    if (this.boss && !this.boss.dead) {
      const arena = { x: this.boss.x - 170, y: this.boss.y - 100, w: 440, h: 270 };
      if (!this.bossActive &&
          pcx > arena.x && pcx < arena.x + arena.w &&
          pcy > arena.y && pcy < arena.y + arena.h) {
        this.bossActive = true;
        setGate(this.world, true);
      }
      if (this.bossActive) {
        this.boss.update(dt, this.world, this.player,
          (x, y) => { const f = new Fish(x, y); f.aggro = true; f.calm = 99; this.enemies.push(f); });
        const hit = this.harpoons.hitTest(this.boss.rect());
        if (hit) {
          hit.dead = true;
          this.boss.takeDamage(hit.dmg);
          this.particles.spawnSpark(hit.x, hit.y, '#ffd0a0', 10);
        }
        if (this.boss.dead) {
          setGate(this.world, false);
          this.bossActive = false;
          if (!this.relicDropped) {
            this.relicDropped = true;
            this.pickups.push({ kind: 'relic', x: this.boss.x + this.boss.w / 2, y: this.boss.y + this.boss.h / 2, vx: 0, vy: -10, t: 0 });
          }
        }
      }
    }
```
draw에 보스 렌더 (적 렌더 뒤):
```js
    if (this.boss && !this.boss.dead) {
      const bs = S.angler.canvas;
      const bx = Math.round(this.boss.x - 10 - cam.x), by = Math.round(this.boss.y - 13 - cam.y);
      if (this.boss.facing === 1) {
        ctx.save(); ctx.translate(bx + bs.width, by); ctx.scale(-1, 1);
        ctx.drawImage(bs, 0, 0); ctx.restore();
      } else ctx.drawImage(bs, bx, by);
    }
```
lighting 수정 — begin에 phase2 암전, 루어 광원:
```js
    const dark = this.bossActive && this.boss && this.boss.phase2();
    L.begin(cam, world, dark);
```
(기존 `L.begin(cam, world)` 교체) — 그리고 원뿔 뒤에:
```js
    if (this.boss && !this.boss.dead && this.bossActive) {
      const lu = this.boss.lure();
      const flick = this.boss.flash ? 0.4 : 1;
      L.addPoint(lu.x, lu.y, 90, '#d8ffa0', 0.9 * flick);
    }
```
emissive glow 섹션에 루어 코어 추가:
```js
    if (this.boss && !this.boss.dead && this.bossActive) {
      const lu = this.boss.lure();
      glow(ctx, cam, lu.x, lu.y, 8, '#f0ffd0', this.boss.flash ? 0.4 : 0.9);
    }
```
draw HUD 뒤에 보스바:
```js
    if (this.bossActive && this.boss && !this.boss.dead)
      drawBossBar(ctx, 'ABYSSAL ANGLER', this.boss.hp / BOSS.HP);
```

- [ ] **Step 5: 테스트 + 브라우저 확인**

Run: `node --test tests/`
Expected: 전부 PASS

브라우저: 임시 맵에 `A`와 `G` 추가 후 — 접근 시 게이트 닫힘+보스바, 루어 깜빡임→돌진→벽 스턴, 소환된 물고기 즉시 어그로, 50% 이하에서 화면 암전(루어+램프만), 처치 시 유물 드랍+게이트 열림.

- [ ] **Step 6: Commit**

```bash
git add src/boss.js src/game.js src/map.js tests/boss.test.js
git commit -m "feat: Abyssal Angler boss with charge, summon and blackout phase"
```

---

### Task 11: 본 맵 제작 + 사망/부활/클리어 흐름

**Files:**
- Modify: `src/map.js` (전체 교체), `src/game.js`
- Test: `tests/map.test.js`

**Interfaces:**
- Consumes: 전체 시스템
- Produces:
  - `MAP_ROWS` — 150×68 최종 맵. 필수 요소: `B`×1(상단), `V`×5+, `K`×2, `C`×12 (12노드×3크리스탈=36 ≈ 스펙 ~35), `M`×4, `J`×8, `F`×3, `A`×1(최심부), `G` 게이트 라인(아레나 입구)
  - game.js: 사망 연출(1.2s 암전+YOU DIED)→respawn, 유물 들고 거점 도착→`this.onClear()` 콜백 (Task 12에서 씬 전환 연결)

- [ ] **Step 1: 맵 검증 테스트 작성 (선행)**

`tests/map.test.js`:
```js
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
```

- [ ] **Step 2: 맵 작성**

`src/map.js`를 전체 교체. 아래 설계 원칙으로 68행 × 150열 ASCII를 직접 작성한다:

- 행 0-1, 열 0-1, 마지막 행/열: `#` 테두리
- **상층 (행 2-15)**: 거점 `B`(열 10 부근, 행 3), 넓은 개방 수역, 얕은 바위 턱, `V`×1, `C`×2 (쉬운 보상), `J`×2
- **하강 통로**: 좌측(열 28-34)과 우측(열 100-108) 두 개의 세로 통로로 중층 진입 (경로 선택지)
- **중층 (행 18-38)**: 수평 동굴 미로. `K`×1(행 22 부근), `V`×2, `C`×5, `M`×2 (통로 벽면), `J`×4, `F`×2
- **심층 (행 40-58)**: 더 좁고 어두운 동굴. `K`×1(행 44 부근), `V`×2, `C`×5, `M`×2, `J`×2, `F`×1
- **보스 아레나 (행 56-66, 열 100-146)**: 개방 공간, 입구는 열 96-98의 통로, 통로에 세로 `G` 라인 (행 58-62), `A`는 열 125/행 61 부근
- 각 구역 사이에 2-3타일 폭 통로 최소 2개 (flood fill 통과 필수)

작성 후 Step 3의 테스트가 실패하면 (봉쇄/개수 오류) 물길을 뚫거나 개수를 조정한다 — 맵은 데이터이므로 테스트를 통과할 때까지 수정하는 것이 정상 워크플로.

- [ ] **Step 3: 테스트 실행 → 맵 수정 반복**

Run: `node --test tests/`
Expected: map.test.js 3개 전부 PASS (실패 시 맵 수정 반복)

- [ ] **Step 4: 사망/클리어 흐름 game.js 통합**

`src/game.js` 수정:

constructor: `this.deathTimer = 0; this.onClear = null;`

update의 player.update 결과 처리:
```js
    const evts = this.player.update(dt, this.input, this.world);
    if (evts.includes('died')) this.deathTimer = 1.2;
```
update 최상단 (menu 처리 다음):
```js
    if (this.deathTimer > 0) {
      this.deathTimer -= dt;
      if (this.deathTimer <= 0) {
        this.player.respawn();
        if (this.bossActive && this.boss && !this.boss.dead) {
          // reset boss fight
          setGate(this.world, false);
          this.bossActive = false;
          this.boss.hp = BOSS.HP;
          this.boss.state = 'idle';
        }
      }
      return;
    }
```
클리어 판정 (atBase 처리 안, bank 직후):
```js
    if (this.atBase && !wasAtBase && this.player.hasRelic && this.onClear) this.onClear();
```
draw 끝에 사망 오버레이:
```js
    if (this.deathTimer > 0) {
      ctx.fillStyle = `rgba(2,3,8,${Math.min(1, (1.2 - this.deathTimer) * 2)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(ctx, 'YOU DIED', (VIEW_W - textWidth('YOU DIED', 2)) / 2, 128, '#c04050', 2);
    }
```
(`drawText`, `textWidth`를 hud.js에서 import에 추가)

- [ ] **Step 5: 전체 테스트 + 풀 플레이스루

Run: `node --test tests/`
Expected: 전부 PASS

브라우저 풀 플레이스루 체크리스트:
- 거점→상층 채집→중층(어두워짐, 체크포인트)→심층→보스전→유물→귀환
- 죽으면 YOU DIED + 소지 크리스탈 소실 + 체크포인트 부활, 보스전 중 사망 시 보스 리셋
- O2 압박으로 분출구 경유 동선이 실제로 강제되는지 체감
- 업그레이드 2종 구매 가능 (크리스탈 총량 36 ≥ 20)

- [ ] **Step 6: Commit**

```bash
git add src/map.js src/game.js tests/map.test.js
git commit -m "feat: full 150x68 map with verified reachability, death/clear flow"
```

---

### Task 12: 오디오 + 타이틀/클리어 씬 + 모바일 마감

**Files:**
- Create: `src/audio.js`
- Modify: `src/main.js`, `src/game.js`, `src/hud.js` (터치 스틱 표시)

**Interfaces:**
- Produces:
  - `audio.js`: `initAudio()` (첫 제스처에서 호출), `sfx.shoot() / hit() / hurt() / pickup() / bank() / buy() / boom() / denied()`
  - `main.js`: `TitleScene`(클릭/탭 → initAudio + GameScene 시작), `ClearScene`(banked 수 + 플레이타임 표시, 탭 → 타이틀). GameScene의 `onClear` 연결.
  - 터치 모드일 때 가상 스틱 시각화(HUD): `drawSticks(ctx, input)` — 반투명 원 + 노브

- [ ] **Step 1: 오디오 구현**

`src/audio.js`:
```js
let ac = null;
export function initAudio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
  if (ac.state === 'suspended') ac.resume();
}

function tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(ac.destination);
  o.start(); o.stop(ac.currentTime + dur);
}

export const sfx = {
  shoot: () => tone(880, 0.07, 'square', 0.08, -500),
  hit: () => tone(220, 0.09, 'sawtooth', 0.1),
  hurt: () => tone(110, 0.25, 'sawtooth', 0.14, -60),
  pickup: () => tone(1320, 0.06, 'sine', 0.1, 300),
  bank: () => { tone(660, 0.08, 'sine', 0.1); setTimeout(() => tone(990, 0.1, 'sine', 0.1), 90); },
  buy: () => { tone(520, 0.08, 'square', 0.08); setTimeout(() => tone(1040, 0.12, 'square', 0.08), 100); },
  boom: () => tone(70, 0.5, 'sawtooth', 0.18, -30),
  denied: () => tone(140, 0.12, 'square', 0.08),
};
```

- [ ] **Step 2: game.js에 효과음 연결**

`src/game.js`에 `import { sfx } from './audio.js';` 추가 후 각 지점에 삽입:
- `tryFire` 성공 시 `sfx.shoot()`
- 적/보스 피격 스파크 지점 `sfx.hit()`
- `player.damage(...)` 가 true 반환한 지점들 — Jellyfish/Moray/Fish/보스 접촉은 game에서 직접 알 수 없으므로 update에서 hp 변화 감지: constructor에 `this._lastHp = this.player.hp;`, update 끝에
  ```js
  if (this.player.hp < this._lastHp && !this.player.dead) sfx.hurt();
  this._lastHp = this.player.hp;
  ```
- 픽업 수집 지점 `sfx.pickup()`
- `bank()` 호출 지점 `sfx.bank()` (0개여도 무해)
- 메뉴 click 결과 `'bought'` → `sfx.buy()`, null인데 버튼 눌렀으면 `sfx.denied()`
- 보스 사망 지점 `sfx.boom()`

- [ ] **Step 3: 씬 전환 + 스틱 표시**

`src/hud.js`에 추가:
```js
export function drawSticks(ctx, input) {
  if (!input.touchMode) return;
  for (const s of [input.sticks.left, input.sticks.right]) {
    if (!s) continue;
    ctx.strokeStyle = 'rgba(160,200,220,0.35)';
    ctx.beginPath(); ctx.arc(s.ox, s.oy, 22, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(160,200,220,0.45)';
    const dx = s.x - s.ox, dy = s.y - s.oy, d = Math.hypot(dx, dy) || 1, cl = Math.min(d, 22);
    ctx.beginPath(); ctx.arc(s.ox + dx / d * cl, s.oy + dy / d * cl, 7, 0, Math.PI * 2); ctx.fill();
  }
}
```
game.js draw 끝(HUD 뒤)에 `drawSticks(ctx, this.input);`

`src/main.js` 하단부 전체 교체 (기존 `setScene(new GameScene(canvas))` 제거):
```js
import { GameScene } from './game.js';
import { drawText, textWidth } from './hud.js';
import { initAudio } from './audio.js';

function makeTitle() {
  let pulse = 0;
  const start = () => {
    initAudio();
    const g = new GameScene(canvas);
    const t0 = performance.now();
    g.onClear = () => setScene(makeClear(g, (performance.now() - t0) / 1000));
    setScene(g);
  };
  const onTap = () => { canvas.removeEventListener('mousedown', onTap); canvas.removeEventListener('touchstart', onTap); start(); };
  canvas.addEventListener('mousedown', onTap);
  canvas.addEventListener('touchstart', onTap);
  return {
    update(dt) { pulse += dt; },
    draw(c) {
      const grad = c.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#12244c'); grad.addColorStop(1, '#04050e');
      c.fillStyle = grad; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'SUB-ANTARCTIC', (VIEW_W - textWidth('SUB-ANTARCTIC', 3)) / 2, 90, '#9fd0e0', 3);
      if (Math.floor(pulse * 2) % 2)
        drawText(c, 'CLICK OR TAP TO DIVE', (VIEW_W - textWidth('CLICK OR TAP TO DIVE')) / 2, 150, '#5a8ca0');
    },
  };
}

function makeClear(game, seconds) {
  const onTap = () => {
    canvas.removeEventListener('mousedown', onTap);
    canvas.removeEventListener('touchstart', onTap);
    setScene(makeTitle());
  };
  setTimeout(() => {
    canvas.addEventListener('mousedown', onTap);
    canvas.addEventListener('touchstart', onTap);
  }, 800);
  return {
    update() {},
    draw(c) {
      c.fillStyle = '#04050e'; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'DIVE COMPLETE!', (VIEW_W - textWidth('DIVE COMPLETE!', 2)) / 2, 90, '#ffd870', 2);
      drawText(c, `CRYSTALS BANKED ${game.player.banked}`, (VIEW_W - textWidth(`CRYSTALS BANKED ${game.player.banked}`)) / 2, 130, '#9ff0f4');
      drawText(c, `TIME ${Math.round(seconds)}S`, (VIEW_W - textWidth(`TIME ${Math.round(seconds)}S`)) / 2, 145, '#9ff0f4');
      drawText(c, 'TAP TO TITLE', (VIEW_W - textWidth('TAP TO TITLE')) / 2, 190, '#5a8ca0');
    },
  };
}

setScene(makeTitle());
```

- [ ] **Step 4: 전체 검증**

Run: `node --test tests/`
Expected: 전부 PASS

최종 플레이 체크리스트:
- 타이틀 → 클릭/탭 → 게임 시작, 효과음 재생 (발사/피격/픽업/은행/구매)
- 보스 처치 → 유물 → 귀환 → DIVE COMPLETE 씬 → 타이틀 복귀
- **모바일 실기 (또는 devtools 터치 에뮬레이션)**: 가상 스틱 표시·유영·조준·자동발사·부스트, 세로 모드에서 회전 안내
- 60fps 유지 (보스전 암전 페이즈 포함)

- [ ] **Step 5: Commit**

```bash
git add src/ index.html
git commit -m "feat: audio, title/clear scenes, touch stick visualization"
```

---

## 최종 인수 기준 (스펙 §7)

1. `node --test tests/` 전부 통과
2. 데스크톱: 설명 없이 조작 이해 가능 (타이틀 문구만으로)
3. 모바일: 트윈스틱으로 풀 플레이스루 가능
4. 채집→생환 판단(더 갈까/돌아갈까)이 실제 플레이에서 발생
5. 60fps, 광원 12개 상한 준수
6. 승인된 샘플 무드와 시각적 일관성
