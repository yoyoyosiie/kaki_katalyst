// Unit tests for the grading logic. Run with:  npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resample, strokeLength } from '../js/geometry.js';
import { compareStroke, checkStroke, scoreCharacter } from '../js/matcher.js';

// Straight line from a to b with `n` points.
const line = (ax, ay, bx, by, n = 20) =>
  Array.from({ length: n }, (_, i) => ({ x: ax + ((bx - ax) * i) / (n - 1), y: ay + ((by - ay) * i) / (n - 1) }));

// Model strokes for a simple "十": horizontal first, then vertical.
const horizontal = line(20, 55, 90, 55);
const vertical = line(55, 15, 55, 95);

test('resample gives evenly spaced points with the same length', () => {
  const uneven = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 100, y: 0 }];
  const r = resample(uneven, 11);
  assert.equal(r.length, 11);
  r.forEach((p, i) => assert.ok(Math.abs(p.x - i * 10) < 1e-9));
  assert.ok(Math.abs(strokeLength(r) - 100) < 1e-9);
});

test('an exact copy passes', () => {
  assert.equal(compareStroke(horizontal, horizontal).pass, true);
});

test('a slightly wobbly, offset copy passes', () => {
  const wobbly = horizontal.map((p, i) => ({ x: p.x + 2, y: p.y + (i % 2 ? 2 : -2) }));
  assert.equal(compareStroke(wobbly, horizontal).pass, true);
});

test('drawing a stroke backwards is caught', () => {
  const r = compareStroke([...horizontal].reverse(), horizontal);
  assert.equal(r.pass, false);
  assert.equal(r.reason, 'backwards');
});

test('a stroke in the wrong place fails on position', () => {
  const r = compareStroke(line(20, 85, 90, 85), horizontal);
  assert.equal(r.pass, false);
  assert.equal(r.reason, 'position');
});

test('a stroke with a big detour fails', () => {
  // Same endpoints, but bulges far upward in the middle.
  const detour = [...line(20, 55, 55, 20, 10), ...line(55, 20, 90, 55, 10)];
  assert.equal(compareStroke(detour, horizontal).pass, false);
});

test('freehand is more forgiving than trace', () => {
  const off = horizontal.map((p) => ({ x: p.x, y: p.y + 12 }));
  assert.equal(compareStroke(off, horizontal, 'trace').pass, false);
  assert.equal(compareStroke(off, horizontal, 'freehand').pass, true);
});

test('drawing a later stroke first is reported as wrong order', () => {
  const r = checkStroke(vertical, [horizontal, vertical], 0);
  assert.equal(r.pass, false);
  assert.equal(r.reason, 'wrong-order');
  assert.equal(r.matchedIndex, 1);
});

test('tiny dot strokes do not fail on direction', () => {
  const dot = line(50, 30, 52, 36, 5);
  const reversedDot = [...dot].reverse();
  assert.equal(compareStroke(reversedDot, dot).pass, true);
});

test('score counts first-try strokes', () => {
  const s = scoreCharacter([{ tries: 1, avgDistance: 0 }, { tries: 3, avgDistance: 4.5 }], 'trace');
  assert.equal(s.total, 2);
  assert.equal(s.firstTry, 1);
  assert.equal(s.shapeAccuracy, 75);
});
