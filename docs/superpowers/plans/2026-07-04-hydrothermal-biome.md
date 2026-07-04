# Hydrothermal Biome Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 열수분출구 바이옴 — 맵 150×100 확장, PRESSURE HULL 게이팅, 마그마 결정(가치8), 증기 해저드, 중간보스 VENT CRAWLER.

**Architecture:** 기존 맵 아래 32행 추가(좌표 불변=세이브 호환). 게이팅은 새 타일 `P`+`world.hullOpen` 플래그. 증기는 순수 함수 `steamPhase(time,seed)` 주기. 크롤러는 `src/crawler.js` 독립 클래스(바닥 보행형).

**Tech Stack:** 기존과 동일.

**Spec:** `docs/superpowers/specs/2026-07-04-hydrothermal-biome-design.md`

## Global Constraints

- 작업 브랜치: `feature/hydrothermal-biome`
- 테스트: `npm test` (NOT `node --test tests/`). 기존 43개 회귀 유지
- 기존 맵 행 0–67 데이터 불변 (노드 좌표 = 세이브 키 → 절대 이동 금지)
- 광물 존: crystal <18 / pearl <40 / abyss <68 / **magma ≥68** (`HYDRO_ROW = 68`)
- 신규 상수: `MINERALS.magma {value:8,color:'#ffb040'}`, `UPGRADES.hull {cost:24,label:'PRESSURE HULL'}`, CRAWLER/STEAM 상수는 Task 1 코드 그대로
- applyDifficulty: magma 노드와 행≥68 분출구는 트리밍 제외 (기존 카운트는 구지역 기준 유지)
- 증기 주기: idle 2.5s → telegraph 0.8s → erupt 1.2s, 분출구별 위상 오프셋(좌표 시드)
- 저장 스키마 v1 유지 + 선택 필드 `hydroBossDead` (구 세이브 부재 시 false)
- 광원 상한 12 준수 (증기 광원은 뷰 내 최대 3개)
- 커밋 트레일러: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- anchor가 실제 파일과 다르면 실제 파일 기준 (의미 변경 금지)

## File Structure

- `src/constants.js` — MINERALS.magma, UPGRADES.hull, HYDRO_ROW, STEAM, CRAWLER
- `src/world.js` — T.PBARRIER/T.HVENT 개념(P/H/Z 파싱), hullOpen, mineralForRow 확장, applyDifficulty 제외, steamPhase, 관벌레 데코
- `src/map.js` — 150×100 확장
- `src/crawler.js` — 중간보스 (신규)
- `src/sprites.js` — magma 톤, bakeCrawler
- `src/render.js` — P 장벽 렌더, 배경 웜 램프
- `src/lighting.js` — 심부 웜 앰비언트
- `src/game.js` — hullOpen 동기화, 경고, 증기 시스템, 크롤러 배선
- `src/save.js` — hydroBossDead
- `src/hud.js` — 메뉴 6버튼 레이아웃

---

### Task 1: 상수 + world 순수 로직 (P/H/Z, steamPhase, magma)

**Files:**
- Modify: `src/constants.js`, `src/world.js`
- Test: `tests/world.test.js` (추가)

**Interfaces:**
- Produces:
  - constants: `HYDRO_ROW = 68`, `MINERALS.magma`, `UPGRADES.hull`, `STEAM = {IDLE:2.5, TELEGRAPH:0.8, ERUPT:1.2, COLUMN_H:48, COLUMN_W:24}`, `CRAWLER = {HP:20, W:70, H:40, PATROL_SPD:40, LUNGE_SPD:200, TELEGRAPH:0.5, LUNGE_TIME:0.8, STEAM_CD_MIN:4, STEAM_CD_MAX:6, CONTACT_DMG:1, AGGRO_RANGE:200, DROP:12, GRAVITY:300}`
  - world: `T`에 `PBARRIER:8` 추가; LEGEND `'P':T.PBARRIER`, `'H':T.WATER`, `'Z':T.WATER`; parseMap 필드 `pressure:[{tx,ty}]`, `hydroVents:[{x,y}]`, `crawler:{x,y}|null`, `hullOpen:false`; isSolid에 `(t===T.PBARRIER && !world.hullOpen)`; `mineralForRow` magma 확장; `steamPhase(time,seed)→'idle'|'telegraph'|'erupt'`; applyDifficulty magma/심부 vent 제외; genDecor 행≥HYDRO_ROW 관벌레 팔레트

- [ ] **Step 1: 실패하는 테스트** — `tests/world.test.js` 끝에 추가 (import에 `steamPhase`, `HYDRO_ROW`는 constants에서 병합):

```js
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
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL

- [ ] **Step 3: constants.js 구현** — MINERALS에 `magma: { value: 8, color: '#ffb040' },` 추가; UPGRADES에 `hull: { cost: 24, label: 'PRESSURE HULL' },` 추가; 파일 끝에:

```js
export const HYDRO_ROW = 68; // tile row where the hydrothermal biome starts

export const STEAM = {
  IDLE: 2.5, TELEGRAPH: 0.8, ERUPT: 1.2,
  COLUMN_H: 48, COLUMN_W: 24,
};

export const CRAWLER = {
  HP: 20, W: 70, H: 40, PATROL_SPD: 40,
  LUNGE_SPD: 200, TELEGRAPH: 0.5, LUNGE_TIME: 0.8,
  STEAM_CD_MIN: 4, STEAM_CD_MAX: 6,
  CONTACT_DMG: 1, AGGRO_RANGE: 200, DROP: 12, GRAVITY: 300,
};
```

- [ ] **Step 4: world.js 구현**

- T enum: `..., GATE: 7, PBARRIER: 8 };`
- LEGEND에 `'P': T.PBARRIER, 'H': T.WATER, 'Z': T.WATER,` (entity-only 주석 그룹에 H/Z)
- parseMap world 리터럴에 `pressure: [], hydroVents: [], crawler: null, hullOpen: false,` 추가; 파싱 분기에:
```js
      else if (ch === 'P') world.pressure.push({ tx, ty });
      else if (ch === 'H') world.hydroVents.push(c);
      else if (ch === 'Z') world.crawler = c;
```
(주의: `'P'`는 타일이 PBARRIER로 이미 기록되므로 tiles 배열은 그대로 두고 pressure 목록만 추가)
- isSolid return 확장: `t === T.ROCK || t === T.HOLE || (t === T.GATE && world.gateClosed) || (t === T.PBARRIER && !world.hullOpen)`
- mineralForRow 교체:
```js
export function mineralForRow(tileY) {
  return tileY < 18 ? 'crystal' : tileY < 40 ? 'pearl' : tileY < HYDRO_ROW ? 'abyss' : 'magma';
}
```
(import에 HYDRO_ROW 병합)
- steamPhase 추가:
```js
// deterministic per-vent steam cycle; seed offsets the phase
export function steamPhase(time, seed) {
  const period = STEAM.IDLE + STEAM.TELEGRAPH + STEAM.ERUPT;
  const t = (time + ((seed % 97) / 97) * period) % period;
  return t < STEAM.IDLE ? 'idle'
    : t < STEAM.IDLE + STEAM.TELEGRAPH ? 'telegraph' : 'erupt';
}
```
(import에 STEAM 병합)
- applyDifficulty 교체 (기존 pickEven/ventZone 유지):
```js
export function applyDifficulty(world, diff) {
  const fixedNodes = world.nodes.filter(n => n.kind === 'magma');
  world.nodes = [...pickEven(world.nodes.filter(n => n.kind !== 'magma'), diff.nodes), ...fixedNodes];
  const isDeep = v => Math.floor(v.y / TILE) >= HYDRO_ROW;
  const fixedVents = world.vents.filter(isDeep);
  const oldVents = world.vents.filter(v => !isDeep(v));
  const zones = [[], [], []];
  for (const v of [...oldVents].sort((a, b) => a.x - b.x)) zones[ventZone(v)].push(v);
  const kept = [];
  for (const z of zones) if (z.length) kept.push(z[0]);
  const rest = oldVents.filter(v => !kept.includes(v));
  for (const v of pickEven(rest, Math.max(0, diff.vents - kept.length))) kept.push(v);
  world.vents = [...kept, ...fixedVents];
}
```
- genDecor 색상 분기 — 기존 `colors` 배열 사용부를 행 기준으로:
```js
  const cool = ['#ff8c5a', '#ff6482', '#ffbe6e', '#aa78ff', '#78f0dc'];
  const warm = ['#ff6a4a', '#ffd0c0', '#ff9a70', '#e05a5a']; // tube worms
```
push 시 `color: (ty >= HYDRO_ROW ? warm : cool)[hsh % (ty >= HYDRO_ROW ? warm.length : cool.length)],`

- [ ] **Step 5: 통과 확인** — Run: `npm test` / Expected: 47개 PASS (43+4)

- [ ] **Step 6: Commit** — `git add src/constants.js src/world.js tests/world.test.js && git commit -m "feat: hydrothermal constants, pressure barrier, steam cycle, magma tier"`

---

### Task 2: 맵 150×100 확장

**Files:**
- Modify: `src/map.js`, `tests/map.test.js`

**Interfaces:**
- Consumes: Task 1의 P/H/Z 파싱
- Produces: 행 68–99 신규 지역 — 진입 수직 통로(열 20–24 부근, 기존 심층 바닥 행 67을 뚫음) + `P` 가로 라인(통로 폭 전체), 챔버 2–3개, `C`×6(전부 행≥68), `V`×2, `J`×2, `M`×2, `H`×6+, `Z`×1(최심부 챔버)

- [ ] **Step 1: 테스트 갱신 (선행)** — `tests/map.test.js`:

기존 어서션 수정:
- `assert.equal(MAP_ROWS.length, 68)` → `100`
- `assert.equal(w.vents.length, 8)` → `10`
- `assert.equal(w.nodes.length, 16)` → `22`

기존 flood-fill 테스트: 이제 hull 닫힘 기준으로는 신규 지역 도달 불가이므로, **구지역 엔티티만** 검사하도록 수정 — reach 검사 대상을 필터:
```js
  const oldRegion = pt => Math.floor(pt.y / TILE) < HYDRO_ROW;
  for (const [name, list] of [['vent', w.vents.filter(oldRegion)], ['node', w.nodes.filter(n => n.kind !== 'magma')], ['checkpoint', w.checkpoints], ['jelly', w.jelly.filter(oldRegion)], ['fish', w.fishSpawns]])
```
(import에 HYDRO_ROW 추가 — constants에서)

파일 끝에 신규 테스트:
```js
test('hydro biome entities and hull gating', () => {
  const w = parseMap(MAP_ROWS);
  assert.equal(w.nodes.filter(n => n.kind === 'magma').length, 6);
  assert.ok(w.hydroVents.length >= 6, `steam vents ${w.hydroVents.length}`);
  assert.ok(w.pressure.length >= 3, 'pressure line spans corridor');
  assert.ok(w.crawler, 'crawler spawn exists');
  assert.ok(w.crawler.y >= HYDRO_ROW * TILE, 'crawler in biome');

  // hull closed: biome unreachable
  let seen = floodFrom(w, Math.floor(w.base.x / TILE), Math.floor(w.base.y / TILE));
  const reach = pt => seen[Math.floor(pt.y / TILE) * w.w + Math.floor(pt.x / TILE)] === 1;
  for (const n of w.nodes.filter(n => n.kind === 'magma'))
    assert.equal(reach(n), false, 'magma node sealed');
  assert.equal(reach(w.crawler), false, 'crawler sealed');

  // hull open: everything reachable
  w.hullOpen = true;
  seen = floodFrom(w, Math.floor(w.base.x / TILE), Math.floor(w.base.y / TILE));
  for (const n of w.nodes) assert.ok(reach(n), 'node reachable with hull');
  for (const v of w.vents) assert.ok(reach(v), 'vent reachable with hull');
  assert.ok(reach(w.crawler), 'crawler reachable with hull');
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: 맵 테스트 FAIL

- [ ] **Step 3: 맵 확장** — `src/map.js`에 행 68–99 추가 (기존 0–67 문자 불변, 단 **진입 통로 위치의 행 67 바닥만** `#`→`.` 3타일 개방 허용 — 기존 엔티티 타일은 절대 변경 금지):
  - 행 67(기존 최하단 테두리): 열 21–23을 `.`로 개방 (다른 곳 불변)
  - 행 68–71: 수직 통로 (열 21–23 물, 나머지 `#`), 행 69에 `PPP`(열 21–23)
  - 행 72–82: 첫 챔버 (넓은 물 공간 + 바닥 굴곡), C×3·V×1·H×3·J×1·M×1 배치
  - 행 83–86: 연결 통로 (2–3타일 폭)
  - 행 87–98: 심부 챔버 — C×3·V×1·H×3+·J×1·M×1·Z×1(행 95 부근, 열 100+ 넓은 바닥)
  - 행 99: 전체 `#` 테두리. 모든 행 정확히 150자
  - H는 바닥(`#`) 바로 위 물 타일에, M은 벽면에, Z 챔버는 바닥 평탄 구간 ≥8타일 (크롤러 순찰 공간)
  - 생성 스크립트 사용 가능 (커밋 금지), 산출물은 리터럴 문자열. 테스트 통과까지 반복

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 48개 전부 PASS (기존 아레나 봉쇄 포함)

- [ ] **Step 5: Commit** — `git add src/map.js tests/map.test.js && git commit -m "feat: extend map to 150x100 with gated hydrothermal biome"`

---

### Task 3: VENT CRAWLER 클래스

**Files:**
- Create: `src/crawler.js`
- Test: `tests/crawler.test.js`

**Interfaces:**
- Consumes: `CRAWLER`/`STEAM` 상수, `moveAndCollide`
- Produces: `class Crawler` — `constructor(x,y)`(중심좌표), 필드 `x,y,w,h,vx,vy,hp,dead,state('patrol'|'telegraph'|'lunge'),dir,facing,steamT`, 메서드 `rect()`, `takeDamage(n)`, `reset()`, `steamRect()→rect|null`, `update(dt,world,player)`

- [ ] **Step 1: 실패하는 테스트** — `tests/crawler.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { Crawler } from '../src/crawler.js';
import { parseMap } from '../src/world.js';
import { Player } from '../src/player.js';
import { CRAWLER } from '../src/constants.js';

// wide flat chamber: 20x6 tiles
const world = parseMap([
  '####################',
  '#..................#',
  '#..................#',
  '#..................#',
  '#..................#',
  '####################',
]);

test('patrol walks and flips direction at walls', () => {
  const c = new Crawler(160, 56);
  const far = new Player(1000, 1000); // out of range
  const d0 = c.dir;
  let flipped = false;
  for (let i = 0; i < 60 * 8; i++) {
    c.update(1 / 60, world, far);
    if (c.dir !== d0) flipped = true;
  }
  assert.equal(c.state, 'patrol');
  assert.ok(flipped, 'hit a wall and flipped direction within 8s');
  assert.ok(c.x >= 16 && c.x + c.w <= 304, 'stays inside room');
});

test('telegraph then lunge when player is near above-floor', () => {
  const c = new Crawler(160, 56);
  const p = new Player(200, 40); // within 120px horizontal, above
  c.update(1 / 60, world, p);
  assert.equal(c.state, 'telegraph');
  for (let i = 0; i < 40; i++) c.update(1 / 60, world, p); // > TELEGRAPH 0.5s
  assert.equal(c.state, 'lunge');
});

test('steam fires on cooldown and exposes damage rect', () => {
  const c = new Crawler(160, 56);
  const far = new Player(1000, 1000);
  c.steamCd = 0; // force immediate steam
  c.update(1 / 60, world, far);
  assert.ok(c.steamT > 0);
  const r = c.steamRect();
  assert.ok(r && r.h === 48 && r.y < c.y, 'column rises above body');
});

test('dies at 0 hp and reset restores spawn state', () => {
  const c = new Crawler(160, 56);
  c.takeDamage(CRAWLER.HP);
  assert.equal(c.dead, true);
  c.reset();
  assert.equal(c.dead, false);
  assert.equal(c.hp, CRAWLER.HP);
  assert.equal(c.state, 'patrol');
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL (crawler.js 없음)

- [ ] **Step 3: 구현** — `src/crawler.js`:

```js
import { CRAWLER as C, STEAM } from './constants.js';
import { moveAndCollide } from './world.js';

// floor-crawling hydrothermal midboss
export class Crawler {
  constructor(x, y) {
    this.spawnX = x; this.spawnY = y;
    this.w = C.W; this.h = C.H;
    this.x = x - this.w / 2; this.y = y - this.h / 2;
    this.vx = 0; this.vy = 0;
    this.hp = C.HP; this.dead = false;
    this.state = 'patrol'; this.timer = 0;
    this.dir = 1; this.facing = 1;
    this.steamCd = C.STEAM_CD_MIN;
    this.steamT = 0;
    this._lungeDir = 1;
  }

  rect() { return { x: this.x, y: this.y, w: this.w, h: this.h }; }

  takeDamage(n) {
    this.hp -= n;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  reset() {
    this.hp = C.HP; this.dead = false;
    this.state = 'patrol'; this.timer = 0;
    this.vx = this.vy = 0;
    this.x = this.spawnX - this.w / 2; this.y = this.spawnY - this.h / 2;
    this.steamT = 0; this.steamCd = C.STEAM_CD_MIN;
  }

  steamRect() {
    if (this.steamT <= 0) return null;
    return { x: this.x + this.w / 2 - STEAM.COLUMN_W / 2, y: this.y - STEAM.COLUMN_H, w: STEAM.COLUMN_W, h: STEAM.COLUMN_H };
  }

  update(dt, world, player) {
    if (this.dead) return;
    this.timer -= dt;
    this.steamCd -= dt;
    this.steamT = Math.max(0, this.steamT - dt);
    const pcx = player.x + player.w / 2, pcy = player.y + player.h / 2;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    this.facing = pcx < cx ? -1 : 1;
    this.vy += C.GRAVITY * dt; // stick to the floor

    switch (this.state) {
      case 'patrol': {
        this.vx = this.dir * C.PATROL_SPD;
        const near = !player.dead && Math.abs(pcx - cx) < 120 &&
          (cy - pcy) < 80 && (cy - pcy) > -40;
        if (near) {
          this.state = 'telegraph'; this.timer = C.TELEGRAPH;
          this._lungeDir = Math.sign(pcx - cx) || 1;
        } else if (this.steamCd <= 0) {
          this.steamT = STEAM.ERUPT;
          this.steamCd = C.STEAM_CD_MIN + Math.random() * (C.STEAM_CD_MAX - C.STEAM_CD_MIN);
        }
        break;
      }
      case 'telegraph': {
        this.vx = 0;
        if (this.timer <= 0) { this.state = 'lunge'; this.timer = C.LUNGE_TIME; }
        break;
      }
      case 'lunge': {
        this.vx = this._lungeDir * C.LUNGE_SPD;
        if (this.timer <= 0) this.state = 'patrol';
        break;
      }
    }

    const r = moveAndCollide(world, this, dt);
    if (r.hitX) {
      this.dir *= -1;
      if (this.state === 'lunge') this.state = 'patrol';
    }

    const overlaps = (a, b) =>
      a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
    const prect = { x: player.x, y: player.y, w: player.w, h: player.h };
    if (!player.dead && overlaps(this.rect(), prect)) player.damage(C.CONTACT_DMG, cx);
    const s = this.steamRect();
    if (s && !player.dead && overlaps(s, prect)) player.damage(1, cx);
  }
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 52개 PASS (48+4)

- [ ] **Step 5: Commit** — `git add src/crawler.js tests/crawler.test.js && git commit -m "feat: vent crawler midboss state machine"`

---

### Task 4: 스프라이트 + 바이옴 비주얼 (장벽·웜 톤)

**Files:**
- Modify: `src/sprites.js`, `src/render.js`, `src/lighting.js`

**Interfaces:**
- Produces: `GEM_TONES.magma`, `bakeSprites()`에 `crawler` 키 (70×40 캔버스); drawTiles의 PBARRIER 렌더(hullOpen 시 생략); 배경 램프 심부 웜 스톱; 앰비언트 웜 시프트

- [ ] **Step 1: sprites.js**

GEM_TONES에 추가: `magma: { dark: '#b84a10', main: '#ff9a30', hi: '#ffe0a0' },`

bakeCrawler 함수 추가 (bakeAngler 근처):
```js
function bakeCrawler() {
  const c = mk(70, 40), g = g2(c);
  for (let i = 0; i < 4; i++)
    poly(g, [[8 + i * 15, 34], [12 + i * 15, 24], [16 + i * 15, 34], [14 + i * 15, 39], [10 + i * 15, 39]], '#7a2818');
  ell(g, 35, 22, 30, 14, '#a03820');
  ell(g, 35, 18, 26, 10, '#c05028');
  g.fillStyle = '#ffb040';
  for (const [vx, vy] of [[24, 13], [34, 10], [44, 13]]) g.fillRect(vx, vy, 3, 3);
  poly(g, [[2, 26], [11, 19], [11, 31]], '#a03820');
  poly(g, [[68, 26], [59, 19], [59, 31]], '#a03820');
  g.fillStyle = '#ffe0a0';
  g.fillRect(27, 21, 2, 2); g.fillRect(41, 21, 2, 2);
  return outline(c);
}
```
bakeSprites 반환에 `crawler: bakeCrawler(),` 추가.

- [ ] **Step 2: render.js**

RAMP 교체 (심부 웜 스톱 2개 추가):
```js
const RAMP = ['#1c3464', '#12244c', '#0d1838', '#080e24', '#060918', '#04050e', '#160a0a', '#2a1008'];
```

drawTiles의 GATE 분기 뒤에 PBARRIER 렌더 추가 (T import에 이미 포함됨 — world.js의 T):
```js
      else if (t === T.PBARRIER && !world.hullOpen) {
        ctx.fillStyle = '#4a1018';
        ctx.fillRect(sx, sy + 5, TILE, 6);
        ctx.fillStyle = '#ff5a3a';
        ctx.fillRect(sx + 2, sy + 7, 4, 2);
        ctx.fillRect(sx + 10, sy + 7, 4, 2);
      }
```

- [ ] **Step 3: lighting.js**

`begin()`의 else 분기(그라데이션 앰비언트) 교체:
```js
      const worldH = world.h * TILE;
      const warmAt = y => Math.max(0, Math.min(1, (y / TILE - 60) / 20));
      const aTop = ambientAt(cam.y, worldH) + warmAt(cam.y) * 0.08;
      const aBot = ambientAt(cam.y + VIEW_H, worldH) + warmAt(cam.y + VIEW_H) * 0.08;
      const grad = g.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, ambColor(aTop, warmAt(cam.y)));
      grad.addColorStop(1, ambColor(aBot, warmAt(cam.y + VIEW_H)));
      g.fillStyle = grad;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
```
ambColor 교체:
```js
function ambColor(a, warm = 0) {
  const r = Math.round((190 + 55 * warm) * a);
  const gg = Math.round((215 - 45 * warm) * a);
  const b = Math.round((255 - 130 * warm) * a);
  return `rgb(${r},${gg},${b})`;
}
```

- [ ] **Step 4: 검증** — Run: `npm test` (52개 유지) + `node --check` (sprites/render/lighting)

- [ ] **Step 5: Commit** — `git add src/sprites.js src/render.js src/lighting.js && git commit -m "feat: magma tones, crawler sprite, barrier render, warm deep ambience"`

---

### Task 5: game.js — hull 동기화 + 증기 해저드

**Files:**
- Modify: `src/game.js`, `src/hud.js`

**Interfaces:**
- Consumes: `steamPhase`, `STEAM`, `HYDRO_ROW`(불필요시 생략), world.pressure/hydroVents/hullOpen, player.upgrades.hull
- Produces: hullOpen이 항상 `player.upgrades.hull`과 동기; 증기 기둥 피해/렌더/광원; 장벽 근접 경고; 메뉴 6버튼 레이아웃

- [ ] **Step 1: hud.js 메뉴 6버튼** — layout의 `bh = 24` → `22`, `y: 60 + i * (bh + 6)` → `y: 56 + i * (bh + 4)`, close `y: 60 + keys.length * (bh + 6), h: 20` → `y: 56 + keys.length * (bh + 4), h: 18`. draw의 버튼 라벨 y 계산은 `(b.h - 5) / 2` 그대로.

- [ ] **Step 2: game.js hull 동기화**

- import 병합: constants에서 `STEAM`, world에서 `steamPhase`
- constructor: `this._resume` 처리 블록 **다음**에 `this.world.hullOpen = this.player.upgrades.hull;`
- 메뉴 클릭 'bought' 블록: `storeSave(this._snapshot());` 다음에 `this.world.hullOpen = this.player.upgrades.hull;`

- [ ] **Step 3: game.js 증기 시스템**

update() — particles.update 근처(월드 정지 게이트들 뒤 아무 지점, pcx/pcy 정의 이후)에:
```js
    // hydrothermal steam vents
    for (const v of this.world.hydroVents) {
      if (Math.abs(v.x - pcx) > 320 || Math.abs(v.y - pcy) > 240) continue;
      const ph = steamPhase(this.time, v.x * 7 + v.y * 13);
      if (ph === 'erupt') {
        const sr = { x: v.x - STEAM.COLUMN_W / 2, y: v.y - STEAM.COLUMN_H, w: STEAM.COLUMN_W, h: STEAM.COLUMN_H };
        const pl = this.player;
        if (!pl.dead && pl.x < sr.x + sr.w && pl.x + pl.w > sr.x && pl.y < sr.y + sr.h && pl.y + pl.h > sr.y)
          pl.damage(1, v.x);
        if (Math.random() < 0.4) this.particles.spawnSpark(v.x + (Math.random() - 0.5) * 10, v.y - Math.random() * STEAM.COLUMN_H, '#ffc080', 2);
      } else if (ph === 'telegraph' && Math.random() < 0.2) {
        this.particles.spawnBubble(v.x, v.y - 4, -40);
      }
    }
```

draw() — 타일 렌더 뒤(스프라이트들 근처)에 증기 기둥:
```js
    // steam columns
    for (const v of world.hydroVents) {
      const sx = Math.round(v.x - cam.x), sy = Math.round(v.y - cam.y);
      if (sx < -20 || sx > VIEW_W + 20 || sy < -20 || sy > VIEW_H + STEAM.COLUMN_H) continue;
      const ph = steamPhase(this.time, v.x * 7 + v.y * 13);
      if (ph === 'erupt') {
        ctx.fillStyle = 'rgba(255,190,130,0.35)';
        ctx.fillRect(sx - STEAM.COLUMN_W / 2, sy - STEAM.COLUMN_H, STEAM.COLUMN_W, STEAM.COLUMN_H);
        ctx.fillStyle = 'rgba(255,240,210,0.5)';
        ctx.fillRect(sx - 4, sy - STEAM.COLUMN_H, 8, STEAM.COLUMN_H);
      }
    }
```

lighting 섹션 (decor 광원 루프 뒤) — 분출 광원 최대 3개:
```js
    let steamLights = 0;
    for (const v of world.hydroVents) {
      if (steamLights >= 3) break;
      if (Math.abs(v.x - px) < 280 && steamPhase(this.time, v.x * 7 + v.y * 13) === 'erupt') {
        L.addPoint(v.x, v.y - 20, 44, '#ffb040', 0.7);
        steamLights++;
      }
    }
```

draw() — HUD 직전, 장벽 경고:
```js
    // pressure barrier warning
    if (!player.upgrades.hull) {
      const pcx2 = player.x + player.w / 2, pcy2 = player.y + player.h / 2;
      for (const pt of world.pressure) {
        if (Math.abs(pt.tx * 16 + 8 - pcx2) < 56 && Math.abs(pt.ty * 16 + 8 - pcy2) < 56) {
          drawText(ctx, 'NEED PRESSURE HULL', (VIEW_W - textWidth('NEED PRESSURE HULL')) / 2, 60, '#ff8a6a');
          break;
        }
      }
    }
```

- [ ] **Step 4: 검증** — Run: `npm test` (52개 유지) + `node --check src/game.js src/hud.js` (개별 실행)

- [ ] **Step 5: Commit** — `git add src/game.js src/hud.js && git commit -m "feat: pressure hull gating and steam vent hazards"`

---

### Task 6: 크롤러 배선 + 저장 플래그

**Files:**
- Modify: `src/game.js`, `src/save.js`
- Test: `tests/save.test.js` (추가)

**Interfaces:**
- Consumes: `Crawler`(Task 3), `CRAWLER` 상수, 기존 save 모듈
- Produces: buildSave 6번째 파라미터 `hydroBossDead=false` + 스키마 필드; applySave 반환에 `hydroBossDead`; game.js 크롤러 전투/드랍/보스바/BGM/사망리셋/세이브

- [ ] **Step 1: 실패하는 테스트** — `tests/save.test.js` 끝에 추가:

```js
test('hydroBossDead round-trips and defaults false for old saves', () => {
  const p = new Player(0, 0);
  const s = buildSave('normal', p, fakeWorld(), false, false, true);
  assert.equal(s.hydroBossDead, true);
  const p2 = new Player(0, 0);
  const flags = applySave(s, fakeWorld(), p2);
  assert.equal(flags.hydroBossDead, true);
  // old save without the field
  const legacy = { v: 1, difficulty: 'easy', banked: 0, upgrades: {}, nodesHp: {}, bossDead: false, cleared: false };
  const flags2 = applySave(legacy, fakeWorld(), new Player(0, 0));
  assert.equal(flags2.hydroBossDead, false);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL

- [ ] **Step 3: save.js 수정**

- buildSave 시그니처: `export function buildSave(diffKey, player, world, bossDead, cleared, hydroBossDead = false) {` — 반환 객체에 `hydroBossDead: !!hydroBossDead,` 추가
- applySave 반환: `return { bossDead: !!save.bossDead, cleared: !!save.cleared, hydroBossDead: !!save.hydroBossDead };`

- [ ] **Step 4: game.js 크롤러 배선**

- import: `import { Crawler } from './crawler.js';`, constants import에 `CRAWLER` 병합
- constructor (boss 초기화 근처): `this.crawler = this.world.crawler ? new Crawler(this.world.crawler.x, this.world.crawler.y) : null; this.crawlerAggro = false;`
- `_resume` 복원 블록에 추가: `if (this._resume.hydroBossDead && this.crawler) this.crawler.dead = true;`
- `_snapshot()` 교체:
```js
  _snapshot() {
    return buildSave(this.diffKey, this.player, this.world,
      this.boss ? this.boss.dead : false, this.cleared,
      this.crawler ? this.crawler.dead : false);
  }
```
- update() — 보스 블록 다음에:
```js
    if (this.crawler && !this.crawler.dead) {
      const ccx = this.crawler.x + this.crawler.w / 2, ccy = this.crawler.y + this.crawler.h / 2;
      this.crawlerAggro = Math.hypot(ccx - pcx, ccy - pcy) < CRAWLER.AGGRO_RANGE;
      this.crawler.update(dt, this.world, this.player);
      if (this.crawlerAggro) setBgmMode('boss');
      else if (!this.bossActive) setBgmMode('calm');
      const hit = this.harpoons.hitTest(this.crawler.rect());
      if (hit) {
        hit.dead = true;
        this.crawler.takeDamage(hit.dmg);
        this.particles.spawnSpark(ccx, ccy, '#ffc080');
        sfx.hit();
      }
      if (this.crawler.dead) {
        sfx.boom();
        setBgmMode('calm');
        for (let i = 0; i < CRAWLER.DROP; i++) {
          const a = Math.random() * Math.PI * 2;
          this.pickups.push({ kind: 'magma', x: ccx, y: ccy, vx: Math.cos(a) * 60, vy: Math.sin(a) * 60 - 20, t: 0 });
        }
        storeSave(this._snapshot());
      }
    }
```
- deathTimer 리셋 블록(보스 리셋 근처)에: `if (this.crawler && !this.crawler.dead) this.crawler.reset();`
- draw() — 보스 렌더 다음에:
```js
    if (this.crawler && !this.crawler.dead) {
      const cs = S.crawler;
      const cx2 = Math.round(this.crawler.x - cam.x), cy2 = Math.round(this.crawler.y - cam.y);
      if (this.crawler.facing === -1) {
        ctx.save(); ctx.translate(cx2 + cs.width, cy2); ctx.scale(-1, 1);
        ctx.drawImage(cs, 0, 0); ctx.restore();
      } else ctx.drawImage(cs, cx2, cy2);
      const s = this.crawler.steamRect();
      if (s) {
        ctx.fillStyle = 'rgba(255,190,130,0.4)';
        ctx.fillRect(Math.round(s.x - cam.x), Math.round(s.y - cam.y), s.w, s.h);
      }
      if (this.crawler.state === 'telegraph' && Math.floor(this.time * 10) % 2) {
        ctx.fillStyle = '#ff5a3a';
        ctx.fillRect(cx2 + Math.round(cs.width / 2) - 1, cy2 - 6, 3, 3);
      }
    }
```
- 보스바 (drawHud 뒤, 기존 앵글러 바 조건 다음에):
```js
    else if (this.crawlerAggro && this.crawler && !this.crawler.dead)
      drawBossBar(ctx, 'VENT CRAWLER', this.crawler.hp / CRAWLER.HP);
```
(기존 앵글러 `if (...) drawBossBar(...)` 문에 else-if로 연결)

- [ ] **Step 5: 검증** — Run: `npm test` / Expected: 53개 PASS (52+1) + `node --check src/game.js src/save.js` (개별)

- [ ] **Step 6: Commit** — `git add src/game.js src/save.js tests/save.test.js && git commit -m "feat: vent crawler encounter, magma drops, hydroBossDead persistence"`

---

## 최종 인수 기준

1. `npm test` 53개 전부 통과
2. HULL 미구매: 장벽 통과 불가 + 근접 경고 / 구매 즉시 통과 가능 (재입장 불필요)
3. 증기: 예고(기포)→분출(기둥+광원) 리듬 확인, 분출 접촉 시 피해
4. 신규 지역: 붉은 톤 전환, 관벌레 데코, 마그마 노드 6개(주황), 가치 8 합산
5. 크롤러: 순찰→접근 시 텔레그래프→돌진, 증기 뿜기, 보스바+BGM 전환, 처치 시 마그마 12개, 사망 후 재도전 시 리셋
6. 크롤러 처치 저장: 새로고침 CONTINUE 후에도 죽어 있음; 구 세이브 로드 정상
7. 기존 콘텐츠 회귀 없음 (아레나 봉쇄, 클리어 흐름, 난이도 카운트)
8. 60fps 유지 (증기 파티클 포함)
