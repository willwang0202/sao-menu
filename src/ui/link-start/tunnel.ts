import { createRodField } from './rods';

/**
 * Rainbow Link Start tunnel, fitted to the reference by per-ring coverage: the far
 * cluster appears near 2.1s, isolated rods pass at 3.0s and 3.25s, the field fills
 * from 3.4s and its last rods clear at 5.0s.
 */
export const drawTunnel = createRodField({
  seed: 1704,
  count: 300,
  speed: 131,
  focal: 960,
  near: 0.35,
  innerRadius: 1,
  outerRadius: 5,
  passStart: 3.5,
  passEnd: 5.0,
  lengthMin: 4,
  lengthMax: 90,
  widthMin: 0.05,
  widthMax: 0.13,
  fogFar: 150,
  fogNear: 100,
  shutter: 1 / 40,
  centerX: 960,
  centerY: 535,
  palette: ['#c21f1f', '#c6c41e', '#6c6c6c', '#565656', '#c21fc2', '#1fc81f', '#1fc4c4', '#0d0d0d'],
  early: [3.0, 3.07, 3.25],
  earlyLength: 8,
});
