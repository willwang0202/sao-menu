import { distance, FINGER_JOINTS, LANDMARK, type Finger, type HandFrame } from './landmarks';

export type Pose = 'summon' | 'point' | 'open' | 'other';
export type FingerState = 'extended' | 'curled' | 'neutral';

/** Tip-to-MCP span over the summed bone lengths; 1 is perfectly straight. */
const EXTENDED_STRAIGHTNESS = 0.8;

export function fingerState(frame: HandFrame, finger: Finger): FingerState {
  const [mcp, pip, dip, tip] = FINGER_JOINTS[finger];
  const tipReach = distance(frame, LANDMARK.WRIST, tip);
  const pipReach = distance(frame, LANDMARK.WRIST, pip);
  if (tipReach < pipReach) return 'curled';
  const bones = distance(frame, mcp, pip) + distance(frame, pip, dip) + distance(frame, dip, tip);
  const straightness = bones > 0 ? distance(frame, mcp, tip) / bones : 0;
  return straightness >= EXTENDED_STRAIGHTNESS ? 'extended' : 'neutral';
}

export function classifyPose(frame: HandFrame | null): Pose {
  if (!frame) return 'other';
  const index = fingerState(frame, 'index');
  const middle = fingerState(frame, 'middle');
  const ring = fingerState(frame, 'ring');
  const pinky = fingerState(frame, 'pinky');
  if (index === 'extended' && middle === 'extended' && ring === 'extended' && pinky === 'extended') return 'open';
  if (index === 'extended' && middle === 'extended' && ring === 'curled' && pinky === 'curled') return 'summon';
  if (index === 'extended' && middle !== 'extended' && ring !== 'extended' && pinky !== 'extended') return 'point';
  return 'other';
}
