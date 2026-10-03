import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyPose } from '../src/shared/hand/pose';
import { fromMediaPipe, palmScale, LANDMARK } from '../src/shared/hand/landmarks';
import { makeHand, SHAPES } from './fixtures/hand';

test('classifies two extended fingers over a curled ring and pinky as the summon pose', () => {
  assert.equal(classifyPose(makeHand(SHAPES.summon)), 'summon');
});

test('classifies a lone extended index finger as pointing', () => {
  assert.equal(classifyPose(makeHand(SHAPES.point)), 'point');
});

test('classifies four extended fingers as an open hand', () => {
  assert.equal(classifyPose(makeHand(SHAPES.open)), 'open');
});

test('classifies a fist and a missing hand as other', () => {
  assert.equal(classifyPose(makeHand(SHAPES.fist)), 'other');
  assert.equal(classifyPose(null), 'other');
});

test('pose does not depend on hand size, position or camera aspect', () => {
  assert.equal(classifyPose(makeHand(SHAPES.summon, 0.2, 0.8, 0.08, 0.75)), 'summon');
  assert.equal(classifyPose(makeHand(SHAPES.open, 0.7, 0.3, 0.35, 0.5625)), 'open');
});

test('three extended fingers are not mistaken for summon or open', () => {
  assert.equal(classifyPose(makeHand({ index: 'extended', middle: 'extended', ring: 'extended', pinky: 'curled' })), 'other');
});

test('palm scale grows linearly with apparent hand size', () => {
  const near = palmScale(makeHand(SHAPES.point, 0.5, 0.5, 0.24));
  const far = palmScale(makeHand(SHAPES.point, 0.5, 0.5, 0.2));
  assert.ok(Math.abs(near / far - 1.2) < 1e-9);
});

test('converts the first MediaPipe hand into mirrored user-space landmarks', () => {
  const raw = Array.from({ length: 21 }, (_, index) => ({ x: index / 40, y: 0.5, z: -0.01 }));
  const frame = fromMediaPipe({ landmarks: [raw] }, 640, 480);
  assert.ok(frame);
  assert.equal(frame.aspect, 0.75);
  assert.equal(frame.landmarks[LANDMARK.WRIST].x, 1);
  assert.equal(frame.landmarks[20].x, 0.5);
  assert.equal(raw[0].x, 0, 'input is not mutated');
});

test('rejects results with no hand, the wrong landmark count or non-finite values', () => {
  assert.equal(fromMediaPipe({ landmarks: [] }, 640, 480), null);
  assert.equal(fromMediaPipe({ landmarks: [[{ x: 0, y: 0, z: 0 }]] }, 640, 480), null);
  const bad = Array.from({ length: 21 }, () => ({ x: Number.NaN, y: 0, z: 0 }));
  assert.equal(fromMediaPipe({ landmarks: [bad] }, 640, 480), null);
  assert.equal(fromMediaPipe({ landmarks: [Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }))] }, 0, 480), null);
});
