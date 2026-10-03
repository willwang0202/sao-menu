/** A media clock driven by display timestamps, so every refresh gets a unique frame. */
export type StartupClock = Readonly<{ originMs: number; heldAt: number | null }>;

const MS_PER_SECOND = 1000;
const AUDIO_DRIFT_TOLERANCE = 0.12;

export const startClock = (nowMs: number, at = 0): StartupClock => ({ originMs: nowMs - at * MS_PER_SECOND, heldAt: null });
export const clockTime = (clock: StartupClock, nowMs: number): number => clock.heldAt ?? (nowMs - clock.originMs) / MS_PER_SECOND;
export const holdClock = (clock: StartupClock, at: number): StartupClock => ({ ...clock, heldAt: at });
export const resumeClock = (_clock: StartupClock, nowMs: number, at: number): StartupClock => startClock(nowMs, at);
export const shouldResyncAudio = (audioTime: number, mediaTime: number): boolean => Math.abs(audioTime - mediaTime) > AUDIO_DRIFT_TOLERANCE;

const AUDIO_JITTER = 0.004;
/** Fraction of the remaining audio offset removed per frame: smooth, yet locked within about a second. */
const AUDIO_FOLLOW_RATE = 0.06;

/** Nudges a running clock toward the audio position so the voice stays on the picture without visible jumps. */
export function followAudio(clock: StartupClock, nowMs: number, audioTime: number): StartupClock {
  if (clock.heldAt !== null) return clock;
  const offset = clockTime(clock, nowMs) - audioTime;
  if (Math.abs(offset) < AUDIO_JITTER) return clock;
  return { ...clock, originMs: clock.originMs + offset * AUDIO_FOLLOW_RATE * MS_PER_SECOND };
}
