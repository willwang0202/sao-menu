import { clamp01 } from './ease';

export type Key = Readonly<{ t: number; value: readonly number[]; ease?: (x: number) => number }>;

/** Samples a keyframe track; each key's ease shapes the segment arriving at it. */
export function sampleTrack(track: readonly Key[], t: number): number[] {
  if (t <= track[0].t) return [...track[0].value];
  const last = track[track.length - 1];
  if (t >= last.t) return [...last.value];
  const index = track.findIndex(key => key.t > t);
  const from = track[index - 1], to = track[index];
  const progress = (to.ease ?? (x => x))(clamp01((t - from.t) / (to.t - from.t)));
  return from.value.map((start, i) => start + (to.value[i] - start) * progress);
}
