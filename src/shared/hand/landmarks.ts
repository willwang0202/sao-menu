export interface Point { x: number; y: number }
export interface Point3 extends Point { z: number }

/** One hand in mirrored user space: x grows to the user's right, y grows downward. */
export interface HandFrame {
  readonly landmarks: readonly Point3[];
  /** Camera height / width, used to measure distances in square units. */
  readonly aspect: number;
}

export const LANDMARK_COUNT = 21;
export const LANDMARK = {
  WRIST: 0,
  INDEX_MCP: 5, INDEX_PIP: 6, INDEX_DIP: 7, INDEX_TIP: 8,
  MIDDLE_MCP: 9, MIDDLE_PIP: 10, MIDDLE_DIP: 11, MIDDLE_TIP: 12,
  RING_MCP: 13, RING_PIP: 14, RING_DIP: 15, RING_TIP: 16,
  PINKY_MCP: 17, PINKY_PIP: 18, PINKY_DIP: 19, PINKY_TIP: 20,
} as const;

export type Finger = 'index' | 'middle' | 'ring' | 'pinky';
export const FINGER_JOINTS: Record<Finger, readonly [number, number, number, number]> = {
  index: [LANDMARK.INDEX_MCP, LANDMARK.INDEX_PIP, LANDMARK.INDEX_DIP, LANDMARK.INDEX_TIP],
  middle: [LANDMARK.MIDDLE_MCP, LANDMARK.MIDDLE_PIP, LANDMARK.MIDDLE_DIP, LANDMARK.MIDDLE_TIP],
  ring: [LANDMARK.RING_MCP, LANDMARK.RING_PIP, LANDMARK.RING_DIP, LANDMARK.RING_TIP],
  pinky: [LANDMARK.PINKY_MCP, LANDMARK.PINKY_PIP, LANDMARK.PINKY_DIP, LANDMARK.PINKY_TIP],
};

/** Aspect-corrected 2-D distance between two landmarks of a frame. */
export function distance(frame: HandFrame, a: number, b: number): number {
  const first = frame.landmarks[a];
  const second = frame.landmarks[b];
  return Math.hypot(first.x - second.x, (first.y - second.y) * frame.aspect);
}

/** Apparent palm size: mean side of the wrist–index MCP–pinky MCP triangle. */
export function palmScale(frame: HandFrame): number {
  return (
    distance(frame, LANDMARK.WRIST, LANDMARK.INDEX_MCP)
    + distance(frame, LANDMARK.WRIST, LANDMARK.PINKY_MCP)
    + distance(frame, LANDMARK.INDEX_MCP, LANDMARK.PINKY_MCP)
  ) / 3;
}

export function midpoint(frame: HandFrame, indices: readonly number[]): Point {
  const sum = indices.reduce((total, index) => ({ x: total.x + frame.landmarks[index].x, y: total.y + frame.landmarks[index].y }), { x: 0, y: 0 });
  return { x: sum.x / indices.length, y: sum.y / indices.length };
}

export const PALM_CENTRE = [LANDMARK.WRIST, LANDMARK.INDEX_MCP, LANDMARK.MIDDLE_MCP, LANDMARK.RING_MCP, LANDMARK.PINKY_MCP] as const;

interface MediaPipeLike { landmarks: readonly (readonly { x: number; y: number; z: number }[])[] }

/** Converts the first detected hand to a mirrored frame; null when absent or malformed. */
export function fromMediaPipe(result: MediaPipeLike, width: number, height: number): HandFrame | null {
  const hand = result.landmarks[0];
  if (!hand || hand.length !== LANDMARK_COUNT || !(width > 0) || !(height > 0)) return null;
  if (!hand.every(point => Number.isFinite(point.x) && Number.isFinite(point.y) && Number.isFinite(point.z))) return null;
  return { landmarks: hand.map(point => ({ x: 1 - point.x, y: point.y, z: point.z })), aspect: height / width };
}
