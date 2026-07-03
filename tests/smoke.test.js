import test from 'node:test';
import assert from 'node:assert/strict';
import { VIEW_W, VIEW_H, TILE, PLAYER } from '../src/constants.js';

test('constants sane', () => {
  assert.equal(VIEW_W, 480);
  assert.equal(VIEW_H, 270);
  assert.equal(TILE, 16);
  assert.ok(PLAYER.O2_MAX > 0);
});
