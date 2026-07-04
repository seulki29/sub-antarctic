# Save System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거점 자동저장(단일 슬롯) — 은행 잔액·업그레이드·캔 노드·보스/클리어 상태를 localStorage에 저장, 타이틀 CONTINUE/NEW GAME.

**Architecture:** 순수 직렬화(`buildSave`/`applySave`/`isValidSave`)와 스토리지 래퍼를 `src/save.js`로 분리(순수부 단위 테스트). GameScene은 save 파라미터로 복원, 은행/구매/클리어 시점에 저장. 타이틀 씬이 세이브 유무로 분기.

**Tech Stack:** 기존과 동일. localStorage 키 `'save'`, 스키마 v1.

**Spec:** `docs/superpowers/specs/2026-07-04-save-system-design.md`

## Global Constraints

- 작업 브랜치: `feature/save-system` (master에서 분기)
- 테스트: `npm test` (NOT `node --test tests/`). 기존 39개 회귀 유지
- 모듈 최상위 browser API 접근 금지; localStorage는 함수 내부 `typeof localStorage !== 'undefined'` 가드
- 스키마: `{v:1, difficulty, banked, upgrades, nodesHp, bossDead, cleared}` — nodesHp는 기본값(NODE_HP)과 다른 노드만 `"x,y"→hp`
- 저장 시점: 은행 edge-trigger(클리어 분기 포함), 업그레이드 구매 직후. 그 외 없음
- 잠수 중 상태(위치·소지품)는 절대 저장하지 않음
- 커밋 트레일러: `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- anchor 문자열이 실제 파일과 다르면 실제 파일 기준 (의미 변경 금지)

---

### Task 1: src/save.js — 직렬화 + 스토리지

**Files:**
- Create: `src/save.js`
- Test: `tests/save.test.js`

**Interfaces:**
- Consumes: `NODE_HP` (constants), Player 필드 banked/upgrades
- Produces:
  - `buildSave(diffKey, player, world, bossDead, cleared) → obj` (순수)
  - `applySave(save, world, player) → {bossDead, cleared}` (순수 — world.nodes hp 복원·모르는 키 무시, player.banked/upgrades 복원)
  - `isValidSave(obj) → bool`
  - `storeSave(obj)` / `loadSave() → obj|null` / `clearSave()` — localStorage 가드, 파싱 실패 null

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/save.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSave, applySave, isValidSave } from '../src/save.js';
import { Player } from '../src/player.js';
import { NODE_HP } from '../src/constants.js';

function fakeWorld() {
  return { nodes: [
    { x: 100, y: 50, hp: NODE_HP, kind: 'crystal' },
    { x: 200, y: 300, hp: 1, kind: 'pearl' },
    { x: 300, y: 700, hp: 0, kind: 'abyss' },
  ] };
}

test('buildSave records only non-default node hp', () => {
  const p = new Player(0, 0);
  p.banked = 12; p.upgrades.tank = true;
  const s = buildSave('hard', p, fakeWorld(), false, false);
  assert.equal(s.v, 1);
  assert.equal(s.difficulty, 'hard');
  assert.equal(s.banked, 12);
  assert.equal(s.upgrades.tank, true);
  assert.deepEqual(s.nodesHp, { '200,300': 1, '300,700': 0 });
});

test('applySave round-trips player and node state', () => {
  const p1 = new Player(0, 0);
  p1.banked = 20; p1.upgrades.fins = true;
  const s = buildSave('normal', p1, fakeWorld(), true, false);
  const p2 = new Player(0, 0);
  const w2 = fakeWorld();
  w2.nodes.forEach(n => { n.hp = NODE_HP; }); // fresh world
  const flags = applySave(s, w2, p2);
  assert.equal(p2.banked, 20);
  assert.equal(p2.upgrades.fins, true);
  assert.equal(w2.nodes[0].hp, NODE_HP);
  assert.equal(w2.nodes[1].hp, 1);
  assert.equal(w2.nodes[2].hp, 0);
  assert.deepEqual(flags, { bossDead: true, cleared: false });
});

test('applySave ignores unknown node keys', () => {
  const p = new Player(0, 0);
  const w = { nodes: [{ x: 1, y: 1, hp: NODE_HP }] };
  applySave({ v: 1, difficulty: 'easy', banked: 0, upgrades: {}, nodesHp: { '999,999': 0 }, bossDead: false, cleared: false }, w, p);
  assert.equal(w.nodes[0].hp, NODE_HP);
});

test('isValidSave rejects bad versions and shapes', () => {
  assert.equal(isValidSave(null), false);
  assert.equal(isValidSave({ v: 2, difficulty: 'easy', banked: 0, upgrades: {}, nodesHp: {} }), false);
  assert.equal(isValidSave({ v: 1, difficulty: 'easy', banked: 0, upgrades: {}, nodesHp: {} }), true);
});
```

- [ ] **Step 2: 실패 확인** — Run: `npm test` / Expected: FAIL (save.js 없음)

- [ ] **Step 3: 구현** — `src/save.js`:

```js
import { NODE_HP } from './constants.js';

const KEY = 'save';

export function buildSave(diffKey, player, world, bossDead, cleared) {
  const nodesHp = {};
  for (const n of world.nodes)
    if (n.hp !== NODE_HP) nodesHp[`${n.x},${n.y}`] = n.hp;
  return {
    v: 1,
    difficulty: diffKey,
    banked: player.banked,
    upgrades: { ...player.upgrades },
    nodesHp,
    bossDead: !!bossDead,
    cleared: !!cleared,
  };
}

export function isValidSave(s) {
  return !!s && s.v === 1 && typeof s.difficulty === 'string' &&
    typeof s.banked === 'number' &&
    typeof s.upgrades === 'object' && s.upgrades !== null &&
    typeof s.nodesHp === 'object' && s.nodesHp !== null;
}

export function applySave(save, world, player) {
  player.banked = save.banked;
  for (const k of Object.keys(player.upgrades))
    player.upgrades[k] = !!save.upgrades[k];
  if (player.upgrades.tank) player.o2 = player.o2Max();
  for (const n of world.nodes) {
    const hp = save.nodesHp[`${n.x},${n.y}`];
    if (hp !== undefined) n.hp = hp;
  }
  return { bossDead: !!save.bossDead, cleared: !!save.cleared };
}

export function storeSave(obj) {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function loadSave() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const s = JSON.parse(localStorage.getItem(KEY));
    return isValidSave(s) ? s : null;
  } catch { return null; }
}

export function clearSave() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(KEY);
}
```

- [ ] **Step 4: 통과 확인** — Run: `npm test` / Expected: 43개 전부 PASS

- [ ] **Step 5: Commit** — `git add src/save.js tests/save.test.js && git commit -m "feat: save serialization and storage module"`

---

### Task 2: game.js — 복원 주입 + 저장 시점

**Files:**
- Modify: `src/game.js`

**Interfaces:**
- Consumes: Task 1 전부
- Produces: `GameScene(canvas, diffKey = 'normal', save = null)`, 필드 `this.diffKey`, `this.cleared`

- [ ] **Step 1: 수정**

import 추가: `import { buildSave, applySave, storeSave } from './save.js';`

constructor:
- 시그니처 `constructor(canvas, diffKey = 'normal', save = null) {`
- `this.diff = ...` 줄 위에 `this.diffKey = diffKey;`
- `this.onClear = null;` 근처에 `this.cleared = false;`
- Player 생성 직후에:
```js
    this._resume = save ? applySave(save, this.world, this.player) : null;
```
- boss/relicDropped 초기화 이후(constructor 끝부분)에:
```js
    if (this._resume) {
      this.cleared = this._resume.cleared;
      if (this._resume.bossDead && this.boss) {
        this.boss.dead = true;
        this.relicDropped = true;
        if (!this._resume.cleared)
          this.pickups.push({ kind: 'relic', x: this.world.angler.x, y: this.world.angler.y, vx: 0, vy: 0, t: 0 });
      }
    }
```

update() 저장 시점 2곳:

(a) 은행 edge-trigger 블록을 다음으로 교체 (기존: bank → sfx.bank → setCheckpoint → hasRelic 분기 → menu.open):
```js
    if (this.atBase && !wasAtBase) {
      this.player.bank();
      sfx.bank();
      this.player.setCheckpoint(this.world.base.x, this.world.base.y);
      if (this.player.hasRelic && this.onClear) {
        this.cleared = true;
        storeSave(this._snapshot());
        this.onClear();
        return;
      }
      storeSave(this._snapshot());
      this.menu.open = true;
    }
```

(b) 메뉴 클릭 처리에서 구매 시 저장 — `if (r === 'bought') sfx.buy();` → `if (r === 'bought') { sfx.buy(); storeSave(this._snapshot()); }`

클래스에 헬퍼 추가 (update 아래 아무 곳):
```js
  _snapshot() {
    return buildSave(this.diffKey, this.player, this.world,
      this.boss ? this.boss.dead : false, this.cleared);
  }
```

- [ ] **Step 2: 검증** — Run: `npm test` (43개 유지) + `node --check src/game.js`

- [ ] **Step 3: Commit** — `git add src/game.js && git commit -m "feat: resume from save, autosave on bank/purchase/clear"`

---

### Task 3: main.js — 타이틀 CONTINUE/NEW GAME

**Files:**
- Modify: `src/main.js`

**Interfaces:**
- Consumes: `loadSave`/`clearSave` (Task 1), `GameScene(canvas, key, save)` (Task 2)
- Produces: 공용 `startGame(key, save)` 헬퍼; 타이틀 분기 — 세이브 없으면 기존(아무 데나 탭→난이도 선택), 있으면 CONTINUE/NEW GAME 버튼 + 덮어쓰기 확인

- [ ] **Step 1: 수정**

import에 추가: `import { loadSave, clearSave } from './save.js';`

`makeDifficulty` 안의 `start` 함수를 밖으로 빼서 공용화 — `viewPos` 아래에 추가:
```js
function startGame(key, save = null) {
  initAudio();
  startBgm();
  const g = new GameScene(canvas, key, save);
  const t0 = performance.now();
  g.onClear = () => setScene(makeClear(g, (performance.now() - t0) / 1000));
  setScene(g);
}
```
`makeDifficulty` 내부의 `const start = key => {...}` 정의는 삭제하고 호출부 `start(rows[i].key)` → `startGame(rows[i].key)` 로 교체.

`makeTitle()` 전체 교체:
```js
function makeTitle() {
  let pulse = 0;
  let confirm = false;
  const save = loadSave();
  const snd = () => ({ x: 8, y: VIEW_H - 20, w: textWidth('SOUND OFF') + 8, h: 14 });
  const btn = i => ({ x: (VIEW_W - 200) / 2, y: 140 + i * 36, w: 200, h: 26 });
  const inBtn = (p, i) => {
    const b = btn(i);
    return p.x > b.x && p.x < b.x + b.w && p.y > b.y && p.y < b.y + b.h;
  };
  const detach = () => {
    canvas.removeEventListener('mousedown', onTap);
    canvas.removeEventListener('touchstart', onTap);
  };
  const onTap = e => {
    if (e.touches) e.preventDefault();
    initAudio();
    const p = viewPos(e), r = snd();
    if (p.x < r.x + r.w && p.y > r.y - 4) { setMuted(!isMuted()); return; }
    if (!save) { detach(); setScene(makeDifficulty()); return; }
    if (!confirm) {
      if (inBtn(p, 0)) { detach(); startGame(save.difficulty, save); }
      else if (inBtn(p, 1)) confirm = true;
    } else {
      if (inBtn(p, 0)) { clearSave(); detach(); setScene(makeDifficulty()); }
      else if (inBtn(p, 1)) confirm = false;
    }
  };
  canvas.addEventListener('mousedown', onTap);
  canvas.addEventListener('touchstart', onTap, { passive: false });
  return {
    update(dt) { pulse += dt; },
    draw(c) {
      const grad = c.createLinearGradient(0, 0, 0, VIEW_H);
      grad.addColorStop(0, '#12244c'); grad.addColorStop(1, '#04050e');
      c.fillStyle = grad; c.fillRect(0, 0, VIEW_W, VIEW_H);
      drawText(c, 'SUB-ANTARCTIC', (VIEW_W - textWidth('SUB-ANTARCTIC', 3)) / 2, 80, '#9fd0e0', 3);
      if (!save) {
        if (Math.floor(pulse * 2) % 2)
          drawText(c, 'CLICK OR TAP TO DIVE', (VIEW_W - textWidth('CLICK OR TAP TO DIVE')) / 2, 150, '#5a8ca0');
      } else if (!confirm) {
        const labels = [`CONTINUE - ${save.difficulty.toUpperCase()}`, 'NEW GAME'];
        labels.forEach((t, i) => {
          const b = btn(i);
          c.fillStyle = i === 0 ? '#2a5a78' : '#3a5468';
          c.fillRect(b.x, b.y, b.w, b.h);
          drawText(c, t, b.x + (b.w - textWidth(t)) / 2, b.y + 10, '#e0f0f4');
        });
        drawText(c, `BANKED ${save.banked}`, (VIEW_W - textWidth(`BANKED ${save.banked}`)) / 2, 218, '#9ff0f4');
      } else {
        drawText(c, 'OVERWRITE SAVE?', (VIEW_W - textWidth('OVERWRITE SAVE?', 2)) / 2, 118, '#e0b0b8', 2);
        const labels = ['YES - DELETE SAVE', 'NO - KEEP'];
        labels.forEach((t, i) => {
          const b = btn(i);
          c.fillStyle = i === 0 ? '#5a2a34' : '#3a5468';
          c.fillRect(b.x, b.y, b.w, b.h);
          drawText(c, t, b.x + (b.w - textWidth(t)) / 2, b.y + 10, '#e0f0f4');
        });
      }
      drawText(c, `SOUND ${isMuted() ? 'OFF' : 'ON'}`, 8, VIEW_H - 18, '#5a8ca0');
    },
  };
}
```

- [ ] **Step 2: 검증** — Run: `npm test` (43개 유지) + `node --check src/main.js`

- [ ] **Step 3: Commit** — `git add src/main.js && git commit -m "feat: title continue/new-game flow with overwrite confirm"`

---

## 최종 인수 기준

1. `npm test` 43개 전부 통과 (39 + 4)
2. 채집→은행→새로고침→CONTINUE: 잔액·업그레이드·캔 노드 유지, 거점 스폰
3. 잠수 중 새로고침: 소지분 손실, 마지막 은행 시점으로 복귀
4. NEW GAME: 세이브 있으면 OVERWRITE 확인 → YES 시 삭제 후 난이도 선택
5. 보스 처치 후 저장→CONTINUE: 보스 없음 + 유물이 보스 방에 재배치 (미클리어 시)
6. 클리어 후 CONTINUE: 포스트게임 자유 잠수 (유물 없음)
7. 구매 직후 저장 (구매→새로고침→업그레이드 유지)
