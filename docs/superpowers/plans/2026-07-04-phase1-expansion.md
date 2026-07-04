# Phase 1 Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 광물 3종(가치제)·업그레이드 5종·난이도 3단계·시작 메뉴(난이도 선택+사운드 토글)·프로시저럴 BGM을 기존 프로토타입에 추가.

**Architecture:** 기존 모듈 구조 유지, 수정 위주. 광물 종류는 노드 깊이에서 파생(`mineralForRow`), 난이도는 파싱된 월드를 후처리(`applyDifficulty`). BGM은 audio.js 안에서 마스터 GainNode 그래프로 구성.

**Tech Stack:** 기존과 동일 (vanilla JS ES modules, Canvas 2D, WebAudio, node --test).

**Spec:** `docs/superpowers/specs/2026-07-04-phase1-expansion-design.md`

## Global Constraints

- 작업 브랜치: `feature/phase1-expansion` (master에서 분기)
- 테스트: `npm test` (NOT `node --test tests/` — Windows에서 깨짐). 기존 30개 회귀 유지
- 광물 존 경계(타일 행): crystal < 18 ≤ pearl < 40 ≤ abyss (분출구 존도 동일 경계)
- DIFFICULTY 수치: easy `{hp:5,nodes:16,vents:8}`, normal `{hp:3,nodes:12,vents:5}`, hard `{hp:2,nodes:9,vents:3}`
- UPGRADES 비용: tank 8 / damage 12 / lamp 10 / fins 14 / suit 16
- 업그레이드 효과 배율: lamp reach×1.4·spread×1.15, fins 속도×1.2·부스트쿨×0.6, suit 무적 2.5s·넉백×0.5
- localStorage 키: `'snd'` = `'on'|'off'` (이외 저장 없음 — 저장/불러오기는 범위 외)
- 모듈 최상위에서 window/document/localStorage 접근 금지 (Node import 안전 유지)
- 기존 게임플레이 상수·아레나 봉쇄 로직 불변
- 커밋 트레일러: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- 파일 수정 시: 이 플랜의 anchor 문자열이 실제 파일과 공백 수준에서 다르면 실제 파일 기준으로 맞춰 적용 (의미 변경 금지)

---

### Task 1: 상수 + 광물/난이도 순수 로직

**Files:**
- Modify: `src/constants.js`, `src/world.js`
- Test: `tests/world.test.js` (추가)

**Interfaces:**
- Consumes: 기존 `parseMap`, `TILE`
- Produces:
  - `constants.js`: `DIFFICULTY = {easy,normal,hard}` (각 `{hp,nodes,vents}`), `MINERALS = {crystal:{value:1,color:'#5ae0e6'}, pearl:{value:3,color:'#f0dce6'}, abyss:{value:5,color:'#ff8a5a'}}`, `UPGRADES` 5키(tank/damage/lamp/fins/suit)
  - `world.js`: `mineralForRow(tileY) → 'crystal'|'pearl'|'abyss'`, `applyDifficulty(world, diff)` (world.nodes/world.vents를 목표 개수로 축소 — x정렬 균등 선택, 분출구는 존별 최소 1개 보장), parseMap의 노드에 `kind` 필드 추가

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/world.test.js` 끝에 추가:

```js
import { DIFFICULTY } from '../src/constants.js';
// (파일 상단 import에 mineralForRow, applyDifficulty 병합)

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
```

- [ ] **Step 2: 실행해서 실패 확인** — Run: `npm test` / Expected: FAIL (`mineralForRow` export 없음)

- [ ] **Step 3: 구현**

`src/constants.js` — UPGRADES 블록을 교체하고 그 아래 신규 상수 추가:

```js
export const UPGRADES = {
  tank:   { cost: 8,  label: 'O2 TANK +50' },
  damage: { cost: 12, label: 'HARPOON +50' },
  lamp:   { cost: 10, label: 'LAMP +40' },
  fins:   { cost: 14, label: 'FINS SPEED' },
  suit:   { cost: 16, label: 'DIVE SUIT' },
};

export const DIFFICULTY = {
  easy:   { hp: 5, nodes: 16, vents: 8 },
  normal: { hp: 3, nodes: 12, vents: 5 },
  hard:   { hp: 2, nodes: 9,  vents: 3 },
};

export const MINERALS = {
  crystal: { value: 1, color: '#5ae0e6' },
  pearl:   { value: 3, color: '#f0dce6' },
  abyss:   { value: 5, color: '#ff8a5a' },
};
```

`src/world.js` — 노드 push 라인 수정 + 파일 끝에 함수 추가:

기존: `else if (ch === 'C') world.nodes.push({ ...c, hp: NODE_HP });`
변경: `else if (ch === 'C') world.nodes.push({ ...c, hp: NODE_HP, kind: mineralForRow(ty) });`

```js
// mineral tier by depth: crystal < 18 <= pearl < 40 <= abyss (tile rows)
export function mineralForRow(tileY) {
  return tileY < 18 ? 'crystal' : tileY < 40 ? 'pearl' : 'abyss';
}

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
```

- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test` / Expected: 전부 PASS (33개)

- [ ] **Step 5: Commit** — `git add src/constants.js src/world.js tests/world.test.js && git commit -m "feat: minerals, difficulty presets and world post-pass"`

---

### Task 2: 맵 증설 — C×16, V×8

**Files:**
- Modify: `src/map.js`, `tests/map.test.js`

**Interfaces:**
- Consumes: parseMap의 kind 파생 (Task 1)
- Produces: MAP_ROWS에 C 16개(존별 crystal≥3/pearl≥4/abyss≥3), V 8개(존별 ≥2)

- [ ] **Step 1: 테스트 갱신 (선행)** — `tests/map.test.js`의 카운트 어서션 교체:

기존: `assert.ok(w.vents.length >= 5, ...)` → `assert.equal(w.vents.length, 8);`
기존: `assert.equal(w.nodes.length, 12);` → `assert.equal(w.nodes.length, 16);`

그리고 파일 끝에 추가:

```js
test('map vents and minerals cover all depth zones', () => {
  const w = parseMap(MAP_ROWS);
  const zone = pt => { const ty = Math.floor(pt.y / TILE); return ty < 18 ? 0 : ty < 40 ? 1 : 2; };
  const vc = [0, 0, 0];
  for (const v of w.vents) vc[zone(v)]++;
  for (const c of vc) assert.ok(c >= 2, `vents per zone ${vc}`);
  const kinds = new Set(w.nodes.map(n => n.kind));
  assert.equal(kinds.size, 3, 'all three minerals present');
});
```

- [ ] **Step 2: 실행해서 실패 확인** — Run: `npm test` / Expected: 카운트 FAIL

- [ ] **Step 3: 맵 데이터 수정** — `src/map.js` 리터럴 행에서 물(`.`) 타일을 골라 C 4개·V 3개 추가:
  - C 추가 위치(제안): 상층 행 10 부근 1개, 중층 행 30 부근 1개, 심층 행 46·행 55 부근 각 1개 — 존별 최소치(3/4/3)를 만족하도록 기존 분포 확인 후 조정
  - V 추가 위치(제안): 상층 행 9~12에 1개, 중층 행 30~35에 1개, 심층 행 54~56 밴드(아레나 실링 위)에 1개
  - 규칙: 행 길이 150 유지, 벽(`#`) 대체 금지(물 타일만 교체), 아레나 내부(행 58+, 열 96+)에 두지 말 것. flood-fill 테스트가 도달성을 검증하므로 실패 시 위치 조정
  - 행 편집은 문자 치환 스크립트(작업용, 커밋 금지)를 써도 되고 직접 편집해도 됨

- [ ] **Step 4: 테스트 통과 확인** — Run: `npm test` / Expected: 전부 PASS (34개, 기존 아레나 봉쇄 테스트 포함)

- [ ] **Step 5: Commit** — `git add src/map.js tests/map.test.js && git commit -m "feat: expand map to 16 nodes / 8 vents for difficulty scaling"`

---

### Task 3: 플레이어 hpMax·업그레이드 효과 + HUD 5종 메뉴

**Files:**
- Modify: `src/player.js`, `src/hud.js`
- Test: `tests/player.test.js`, `tests/hud.test.js` (추가)

**Interfaces:**
- Consumes: `UPGRADES` 5키, `LIGHT` 상수
- Produces: `Player`
  - `constructor(x, y, hpMax = PLAYER.HP_MAX)`, 필드 `hpMax`
  - `maxSpd()`, `boostCdMax()`, `lampReach()`, `lampSpread()`, `invulnTime()` — 업그레이드 반영값
  - `upgrades = { tank, damage, lamp, fins, suit }` (전부 false 초기화)
  - bank()/respawn()은 `this.hpMax`로 회복, damage()는 `invulnTime()`+suit 넉백 절반
- HUD: 하트 렌더 `player.hpMax` 기준, 메뉴 버튼 y=60 시작·높이 24·간격 6 (5업그레이드+CLOSE, 패널 y 28~246)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/player.test.js` 끝에 추가 (상단 import에 `LIGHT` 병합: `import { PLAYER, UPGRADES, LIGHT } from '../src/constants.js';`):

```js
test('hpMax parameter drives max health and respawn', () => {
  const p = new Player(40, 30, 5);
  assert.equal(p.hp, 5);
  assert.equal(p.hpMax, 5);
  p.die(); p.respawn();
  assert.equal(p.hp, 5);
});

test('suit upgrade extends invuln and halves knockback', () => {
  const p = new Player(40, 30);
  p.banked = UPGRADES.suit.cost;
  assert.equal(p.buyUpgrade('suit'), true);
  p.damage(1, 100);
  assert.equal(p.invuln, 2.5);
  assert.ok(Math.abs(Math.abs(p.vx) - PLAYER.KNOCKBACK_VX * 0.5) < 1e-9);
});

test('fins upgrade raises speed cap and shortens boost cooldown', () => {
  const p = new Player(40, 30);
  assert.equal(p.maxSpd(), PLAYER.MAX_SPD);
  p.banked = UPGRADES.fins.cost;
  p.buyUpgrade('fins');
  assert.ok(Math.abs(p.maxSpd() - PLAYER.MAX_SPD * 1.2) < 1e-9);
  assert.ok(Math.abs(p.boostCdMax() - PLAYER.BOOST_CD * 0.6) < 1e-9);
});

test('lamp upgrade widens the cone', () => {
  const p = new Player(0, 0);
  p.banked = UPGRADES.lamp.cost;
  p.buyUpgrade('lamp');
  assert.ok(Math.abs(p.lampReach() - LIGHT.LAMP_REACH * 1.4) < 1e-6);
  assert.ok(Math.abs(p.lampSpread() - LIGHT.LAMP_SPREAD * 1.15) < 1e-6);
});
```

`tests/hud.test.js` 끝에 추가 (상단 import에 `UPGRADES` — `from '../src/constants.js'` 라인에 병합):

```js
test('menu lists all upgrades and stays inside the view', () => {
  const m = new UpgradeMenu();
  m.open = true;
  const p = new Player(0, 0);
  const btns = m.layout(p);
  assert.equal(btns.length, Object.keys(UPGRADES).length + 1); // + CLOSE
  for (const b of btns) assert.ok(b.y + b.h <= 250, `${b.key} fits in view`);
});
```

- [ ] **Step 2: 실행해서 실패 확인** — Run: `npm test` / Expected: 신규 테스트 FAIL

- [ ] **Step 3: player.js 구현**

import 라인: `import { PLAYER as P, UPGRADES, LIGHT } from './constants.js';`

constructor 교체 부분:
```js
  constructor(x, y, hpMax = P.HP_MAX) {
```
`this.hp = P.HP_MAX;` → `this.hpMax = hpMax; this.hp = hpMax;`
`this.upgrades = { tank: false, damage: false };` → `this.upgrades = { tank: false, damage: false, lamp: false, fins: false, suit: false };`

메서드 추가 (o2Max 근처):
```js
  maxSpd() { return P.MAX_SPD * (this.upgrades.fins ? 1.2 : 1); }
  boostCdMax() { return P.BOOST_CD * (this.upgrades.fins ? 0.6 : 1); }
  lampReach() { return LIGHT.LAMP_REACH * (this.upgrades.lamp ? 1.4 : 1); }
  lampSpread() { return LIGHT.LAMP_SPREAD * (this.upgrades.lamp ? 1.15 : 1); }
  invulnTime() { return this.upgrades.suit ? 2.5 : P.INVULN; }
```

update() 내부 수정:
- `this.boostCd = P.BOOST_CD;` → `this.boostCd = this.boostCdMax();`
- 속도 클램프 블록 교체:
```js
      const ms = this.maxSpd();
      const spd = Math.hypot(this.vx, this.vy);
      if (spd > ms) { this.vx *= ms / spd; this.vy *= ms / spd; }
```

damage() 수정:
- `this.invuln = P.INVULN;` → `this.invuln = this.invulnTime();`
- 넉백 두 줄 교체:
```js
    const kb = this.upgrades.suit ? 0.5 : 1;
    this.vx = Math.sign(this.x - fromX || 1) * P.KNOCKBACK_VX * kb;
    this.vy = P.KNOCKBACK_VY * kb;
```

bank()·respawn()의 `this.hp = P.HP_MAX;` → `this.hp = this.hpMax;` (두 곳)

- [ ] **Step 4: hud.js 구현**

drawHud 하트 루프: `for (let i = 0; i < P.HP_MAX; i++)` → `for (let i = 0; i < player.hpMax; i++)`

UpgradeMenu.layout 교체:
```js
  layout(player) {
    const keys = Object.keys(UPGRADES);
    const bw = 190, bh = 24, x = (VIEW_W - bw) / 2;
    const btns = keys.map((key, i) => {
      const u = UPGRADES[key];
      return {
        key, x, y: 60 + i * (bh + 6), w: bw, h: bh,
        label: u.label, cost: u.cost,
        owned: player.upgrades[key], affordable: player.banked >= u.cost,
      };
    });
    btns.push({ key: 'close', x, y: 60 + keys.length * (bh + 6), w: bw, h: 20, label: 'CLOSE' });
    return btns;
  }
```

UpgradeMenu.draw 패널/타이틀/BANKED 좌표 수정:
- `ctx.fillRect(100, 40, VIEW_W - 200, 190);` → `ctx.fillRect(100, 28, VIEW_W - 200, 218);`
- `ctx.strokeRect(100.5, 40.5, VIEW_W - 200, 190);` → `ctx.strokeRect(100.5, 28.5, VIEW_W - 200, 218);`
- 타이틀 y `48` → `36`
- `drawText(ctx, \`BANKED ${player.banked}\`, 108, 214, '#9ff0f4');` → y `236`

- [ ] **Step 5: 테스트 통과 확인** — Run: `npm test` / Expected: 전부 PASS (39개)

- [ ] **Step 6: Commit** — `git add src/player.js src/hud.js tests/player.test.js tests/hud.test.js && git commit -m "feat: hpMax, lamp/fins/suit upgrade effects, 5-slot upgrade menu"`

---

### Task 4: 스프라이트 광물 3종 + game.js 통합 (난이도·광물·램프)

**Files:**
- Modify: `src/sprites.js`, `src/game.js`

**Interfaces:**
- Consumes: Task 1-3 전부
- Produces:
  - `bakeSprites()` 반환 변경: `crystal`/`node` 제거 → `gems: {crystal,pearl,abyss}` (7×9), `nodes: {crystal,pearl,abyss}` (16×12). `relic` 유지
  - `GameScene`: `constructor(canvas, diffKey = 'normal')`, 필드 `this.diff`
  - 시작 시 상점 자동 오픈 제거 (`this.atBase = true` 초기화)

- [ ] **Step 1: sprites.js 수정**

`bakeCrystal`/`bakeNode` 함수를 다음으로 교체:

```js
const GEM_TONES = {
  crystal: { dark: '#38b8c0', main: '#5ae0e6', hi: '#b8f8fa' },
  pearl:   { dark: '#c8a8b8', main: '#f0dce6', hi: '#ffffff' },
  abyss:   { dark: '#c04828', main: '#ff7a50', hi: '#ffd0a0' },
};

function bakeGem(t) {
  const c = mk(7, 9), g = g2(c);
  poly(g, [[3, 0], [6, 4], [3, 8], [0, 4]], t.main);
  poly(g, [[3, 0], [6, 4], [3, 4]], t.hi);
  return outline(c);
}

function bakeNodeKind(t) {
  const c = mk(16, 12), g = g2(c);
  poly(g, [[2, 11], [4, 4], [7, 11]], t.dark);
  poly(g, [[6, 11], [9, 1], [12, 11]], t.main);
  poly(g, [[10, 11], [13, 6], [15, 11]], t.dark);
  poly(g, [[8, 4], [9, 1], [10, 4]], t.hi);
  return outline(c);
}
```

bakeSprites() 반환 객체에서 `crystal: bakeCrystal(), node: bakeNode(),` 를 다음으로 교체:
```js
    gems: Object.fromEntries(Object.entries(GEM_TONES).map(([k, t]) => [k, bakeGem(t)])),
    nodes: Object.fromEntries(Object.entries(GEM_TONES).map(([k, t]) => [k, bakeNodeKind(t)])),
```

- [ ] **Step 2: game.js 수정**

imports 병합 (라인은 실제 파일 기준):
- constants 라인에 `DIFFICULTY, MINERALS` 추가, `LIGHT`는 이 태스크 후 미사용이면 제거
- world 라인에 `applyDifficulty` 추가

constructor:
- 시그니처: `constructor(canvas, diffKey = 'normal') {`
- `this.world = parseMap(MAP_ROWS);` 다음 줄에:
```js
    this.diff = DIFFICULTY[diffKey] || DIFFICULTY.normal;
    applyDifficulty(this.world, this.diff);
```
- `new Player(this.world.base.x, this.world.base.y)` → `new Player(this.world.base.x, this.world.base.y, this.diff.hp)`
- `this.atBase = false;` → `this.atBase = true; // spawn at base without popping the shop`

update():
- lampCone 객체: `spread: LIGHT.LAMP_SPREAD, reach: LIGHT.LAMP_REACH` → `spread: this.player.lampSpread(), reach: this.player.lampReach()`
- 노드 드랍 push: `this.pickups.push({ kind: 'crystal', ...` → `this.pickups.push({ kind: n.kind, ...`
- 픽업 수집 분기 교체:
```js
        if (pk.kind === 'relic') pr.hasRelic = true;
        else pr.pickupCrystal(MINERALS[pk.kind].value);
```

draw():
- 노드: `ctx.drawImage(S.node, ...)` → `ctx.drawImage(S.nodes[n.kind], ...)`
- 픽업: `ctx.drawImage(pk.kind === 'crystal' ? S.crystal : S.relic, ...)` → `ctx.drawImage(pk.kind === 'relic' ? S.relic : S.gems[pk.kind], ...)`
- 램프 원뿔: `L.addCone(px, py, ang, LIGHT.LAMP_SPREAD, LIGHT.LAMP_REACH);` → `L.addCone(px, py, ang, player.lampSpread(), player.lampReach());`
- 노드 발광: `L.addPoint(n.x, n.y, 18, '#5ae0e6', 0.4);` → `L.addPoint(n.x, n.y, 18, MINERALS[n.kind].color, 0.4);`

- [ ] **Step 3: 검증** — Run: `npm test` (전부 PASS 유지) + `node --check src/game.js` + `node --check src/sprites.js`

- [ ] **Step 4: Commit** — `git add src/sprites.js src/game.js && git commit -m "feat: mineral tiers wired into world, difficulty injection, lamp upgrade"`

---

### Task 5: BGM 엔진 + 시작 플로우 (난이도 선택·사운드 토글)

**Files:**
- Modify: `src/audio.js`, `src/main.js`, `src/game.js`

**Interfaces:**
- Consumes: `GameScene(canvas, diffKey)` (Task 4), `DIFFICULTY`
- Produces:
  - `audio.js`: `initAudio()`(마스터 그래프 구성+뮤트 로드), `setMuted(bool)`, `isMuted() → bool`, `startBgm()`, `stopBgm()`, `setBgmMode('calm'|'boss')`. 모듈 최상위 브라우저 API 접근 없음
  - `main.js`: 타이틀(사운드 토글 좌하단) → `makeDifficulty()` 씬 → 게임. 씬 규약 `{update(dt), draw(ctx)}` 유지

- [ ] **Step 1: audio.js 전면 개정** — 파일 전체를 다음으로 교체:

```js
let ac = null, master = null, sfxGain = null, bgm = null, mutedFlag = false;

export function initAudio() {
  if (!ac) {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain();
    master.connect(ac.destination);
    sfxGain = ac.createGain();
    sfxGain.connect(master);
    mutedFlag = typeof localStorage !== 'undefined' && localStorage.getItem('snd') === 'off';
    master.gain.value = mutedFlag ? 0 : 1;
  }
  if (ac.state === 'suspended') ac.resume();
}

export function isMuted() { return mutedFlag; }

export function setMuted(m) {
  mutedFlag = m;
  if (typeof localStorage !== 'undefined') localStorage.setItem('snd', m ? 'off' : 'on');
  if (master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
}

function tone(freq, dur, type = 'square', vol = 0.12, slide = 0) {
  if (!ac) return;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), ac.currentTime + dur);
  g.gain.value = vol;
  g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + dur);
  o.connect(g).connect(sfxGain);
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

// ---- procedural deep-sea BGM -------------------------------------------
export function startBgm() {
  if (!ac || bgm) return;
  const out = ac.createGain(); out.gain.value = 0.9; out.connect(master);
  const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 240; lp.connect(out);
  const droneGain = ac.createGain(); droneGain.gain.value = 0.05; droneGain.connect(lp);
  const o1 = ac.createOscillator(); o1.type = 'sine'; o1.frequency.value = 55;
  const o2 = ac.createOscillator(); o2.type = 'sine'; o2.frequency.value = 55.7;
  o1.connect(droneGain); o2.connect(droneGain);
  o1.start(); o2.start();
  bgm = { out, lp, droneGain, o1, o2, mode: 'calm', timer: null };
  scheduleSwell();
}

function scheduleSwell() {
  if (!bgm) return;
  const wait = bgm.mode === 'calm' ? 7000 + Math.random() * 5000 : 3000 + Math.random() * 2000;
  bgm.timer = setTimeout(() => { swell(); scheduleSwell(); }, wait);
}

function swell() {
  if (!bgm) return;
  const scale = bgm.mode === 'calm'
    ? [110, 130.8, 146.8, 164.8, 196]      // A minor pentatonic-ish
    : [116.5, 138.6, 155.6, 185];          // tense, semitone-shifted
  const f = scale[Math.floor(Math.random() * scale.length)];
  const dur = bgm.mode === 'calm' ? 4 : 2;
  const o = ac.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
  const g = ac.createGain(); g.gain.value = 0;
  const t = ac.currentTime;
  g.gain.linearRampToValueAtTime(0.035, t + dur / 2);
  g.gain.linearRampToValueAtTime(0, t + dur);
  o.connect(g); g.connect(bgm.lp);
  o.start(t); o.stop(t + dur);
}

export function setBgmMode(mode) {
  if (!bgm || bgm.mode === mode) return;
  bgm.mode = mode;
  const t = ac.currentTime;
  bgm.o1.frequency.setTargetAtTime(mode === 'boss' ? 58.3 : 55, t, 1);
  bgm.o2.frequency.setTargetAtTime(mode === 'boss' ? 59.1 : 55.7, t, 1);
  bgm.droneGain.gain.setTargetAtTime(mode === 'boss' ? 0.07 : 0.05, t, 1);
}

export function stopBgm() {
  if (!bgm) return;
  clearTimeout(bgm.timer);
  try { bgm.o1.stop(); bgm.o2.stop(); } catch { /* already stopped */ }
  bgm.out.disconnect();
  bgm = null;
}
```

- [ ] **Step 2: main.js 씬 개편**

import 수정: `import { initAudio, setMuted, isMuted, startBgm } from './audio.js';` 그리고 `DIFFICULTY`를 constants import에 병합.

`makeTitle()` 함수 전체를 교체하고 `makeDifficulty()` 추가 (makeClear는 유지):

```js
function viewPos(e) {
  const r = canvas.getBoundingClientRect();
  const p = e.touches ? e.touches[0] : e;
  return { x: (p.clientX - r.left) / r.width * VIEW_W, y: (p.clientY - r.top) / r.height * VIEW_H };
}

function makeTitle() {
  let pulse = 0;
  const snd = () => ({ x: 8, y: VIEW_H - 20, w: textWidth('SOUND OFF') + 8, h: 14 });
  const onTap = e => {
    if (e.touches) e.preventDefault();
    initAudio();
    const p = viewPos(e), r = snd();
    if (p.x < r.x + r.w && p.y > r.y - 4) { setMuted(!isMuted()); return; }
    canvas.removeEventListener('mousedown', onTap);
    canvas.removeEventListener('touchstart', onTap);
    setScene(makeDifficulty());
  };
  canvas.addEventListener('mousedown', onTap);
  canvas.addEventListener('touchstart', onTap, { passive: false });
  return {
    update(dt) { pulse += dt; },
    draw(c) {
      const grad = c.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#12244c'); grad.addColorStop(1, '#04050e');
      c.fillStyle = grad; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'SUB-ANTARCTIC', (VIEW_W - textWidth('SUB-ANTARCTIC', 3)) / 2, 90, '#9fd0e0', 3);
      if (Math.floor(pulse * 2) % 2)
        drawText(c, 'CLICK OR TAP TO DIVE', (VIEW_W - textWidth('CLICK OR TAP TO DIVE')) / 2, 150, '#5a8ca0');
      drawText(c, `SOUND ${isMuted() ? 'OFF' : 'ON'}`, 8, VIEW_H - 18, '#5a8ca0');
    },
  };
}

function makeDifficulty() {
  const rows = [
    { key: 'easy',   label: 'EASY' },
    { key: 'normal', label: 'NORMAL' },
    { key: 'hard',   label: 'HARD' },
  ];
  const btn = i => ({ x: (VIEW_W - 220) / 2, y: 92 + i * 40, w: 220, h: 30 });
  const start = key => {
    initAudio();
    startBgm();
    const g = new GameScene(canvas, key);
    const t0 = performance.now();
    g.onClear = () => setScene(makeClear(g, (performance.now() - t0) / 1000));
    setScene(g);
  };
  const onTap = e => {
    if (e.touches) e.preventDefault();
    const p = viewPos(e);
    for (let i = 0; i < rows.length; i++) {
      const b = btn(i);
      if (p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h) {
        canvas.removeEventListener('mousedown', onTap);
        canvas.removeEventListener('touchstart', onTap);
        start(rows[i].key);
        return;
      }
    }
  };
  canvas.addEventListener('mousedown', onTap);
  canvas.addEventListener('touchstart', onTap, { passive: false });
  return {
    update(dt) {},
    draw(c) {
      c.fillStyle = '#04050e'; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'SELECT DEPTH RATING', (VIEW_W - textWidth('SELECT DEPTH RATING', 2)) / 2, 52, '#9fd0e0', 2);
      rows.forEach((r, i) => {
        const b = btn(i), d = DIFFICULTY[r.key];
        c.fillStyle = ['#2a5a3a', '#2a5a78', '#5a2a34'][i];
        c.fillRect(b.x, b.y, b.w, b.h);
        drawText(c, r.label, b.x + 10, b.y + 6, '#e0f0f4', 2);
        drawText(c, `${d.hp} HEARTS ${d.nodes} ORE ${d.vents} AIR`, b.x + 10, b.y + 20, '#a0c8d8');
      });
    },
  };
}
```

`setScene(makeTitle());` (파일 끝) 유지.

- [ ] **Step 3: game.js BGM 모드 전환 연결**

import: `import { sfx, setBgmMode } from './audio.js';`
- 보스 조우 블록 `setGate(this.world, true);` 다음에: `setBgmMode('boss');`
- 보스 사망 블록 `sfx.boom();` 다음에: `setBgmMode('calm');`
- 사망 리셋 블록(보스 리셋) `this.boss.vx = this.boss.vy = 0;` 다음에: `setBgmMode('calm');`

- [ ] **Step 4: 검증** — Run: `npm test` (39개 PASS 유지) + `node --check` (audio/main/game). 브라우저 확인은 컨트롤러가 수행

- [ ] **Step 5: Commit** — `git add src/audio.js src/main.js src/game.js && git commit -m "feat: procedural BGM, difficulty select scene, sound toggle"`

---

## 최종 인수 기준

1. `npm test` 39개 전부 통과 (기존 30 + 신규 9)
2. 시작 흐름: 타이틀(사운드 토글·설정 유지) → 난이도 선택(수치 표기) → 게임, 시작 시 상점 안 뜸
3. 난이도별 하트/노드/분출구 수 차이 확인, 분출구 존 커버리지 유지
4. 진주(중층)·심해석(심층) 노드가 색/발광 구분되어 드랍·가치 합산
5. 업그레이드 5종 구매·효과 체감 (램프 넓어짐 = 물고기 어그로 리스크도 증가 — 의도된 트레이드오프)
6. BGM: 평상시 드론+스웰, 보스 진입/이탈 시 부드러운 전환, 뮤트 일괄 적용
7. master 머지·푸시 → Vercel 자동 배포 확인
