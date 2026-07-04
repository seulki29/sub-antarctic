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

test('menu lists all upgrades and stays inside the view', () => {
  const m = new UpgradeMenu();
  m.open = true;
  const p = new Player(0, 0);
  const btns = m.layout(p);
  assert.equal(btns.length, Object.keys(UPGRADES).length + 1); // + CLOSE
  for (const b of btns) assert.ok(b.y + b.h <= 250, `${b.key} fits in view`);
});
