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
  assert.deepEqual(flags, { bossDead: true, cleared: false, hydroBossDead: false });
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
