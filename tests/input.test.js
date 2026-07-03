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
