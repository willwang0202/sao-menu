import type { HandFrame, Point3 } from '../../src/shared/hand/landmarks';

export type FingerState = 'extended' | 'curled';
export interface HandShape { index: FingerState; middle: FingerState; ring: FingerState; pinky: FingerState }

export const SHAPES = {
  summon: { index: 'extended', middle: 'extended', ring: 'curled', pinky: 'curled' },
  point: { index: 'extended', middle: 'curled', ring: 'curled', pinky: 'curled' },
  open: { index: 'extended', middle: 'extended', ring: 'extended', pinky: 'extended' },
  fist: { index: 'curled', middle: 'curled', ring: 'curled', pinky: 'curled' },
} as const satisfies Record<string, HandShape>;

const MCP_OFFSETS: readonly [number, number][] = [[-0.3, -0.3], [-0.1, -0.35], [0.1, -0.3], [0.3, -0.25]];

function finger(mcp: [number, number], state: FingerState): [number, number][] {
  const [x, y] = mcp;
  return state === 'extended'
    ? [[x, y], [x, y - 0.35], [x, y - 0.6], [x, y - 0.8]]
    : [[x, y], [x, y - 0.25], [x, y - 0.1], [x, y + 0.1]];
}

/**
 * Builds 21 mirrored, user-space landmarks for a palm centred at (cx, cy) with
 * palm size `scale` (normalized image units). Layout follows MediaPipe order.
 */
export function makeHand(shape: HandShape, cx = 0.5, cy = 0.5, scale = 0.2, aspect = 1): HandFrame {
  const relative: [number, number][] = [
    [0, 0.5],
    [-0.35, 0.3], [-0.5, 0.1], [-0.55, -0.05], [-0.5, -0.15],
    ...finger(MCP_OFFSETS[0], shape.index),
    ...finger(MCP_OFFSETS[1], shape.middle),
    ...finger(MCP_OFFSETS[2], shape.ring),
    ...finger(MCP_OFFSETS[3], shape.pinky),
  ];
  const landmarks: Point3[] = relative.map(([x, y]) => ({ x: cx + x * scale, y: cy + (y * scale) / aspect, z: 0 }));
  return { landmarks, aspect };
}
