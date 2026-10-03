/** Messages between the hidden tracker page and the main process. */
export type TrackerEvent =
  | { kind: 'status'; state: 'starting' | 'running' | 'error'; message?: string }
  | { kind: 'summon'; x: number; y: number }
  | { kind: 'dismiss' }
  | { kind: 'cursor'; x: number; y: number; visible: boolean }
  | { kind: 'click'; x: number; y: number };

export const TRACKER_FPS = { idle: 10, active: 30 } as const;
export interface TrackerConfig {
  fps: typeof TRACKER_FPS.idle | typeof TRACKER_FPS.active;
  menuOpen: boolean;
  /** Where the menu opened, normalized to the overlay; the hand cursor starts here. */
  origin: { x: number; y: number };
  /** Draw the camera, landmarks and pose readout in the tracker window. */
  debug: boolean;
}

export const MAX_STATUS_MESSAGE = 300;
const STATUS_STATES = new Set(['starting', 'running', 'error']);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;
const isUnit = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;

function parsePoint(value: Record<string, unknown>): { x: number; y: number } | null {
  return isUnit(value.x) && isUnit(value.y) ? { x: value.x, y: value.y } : null;
}

/** Returns a fresh, minimal event or null; unknown fields never pass through. */
export function parseTrackerEvent(value: unknown): TrackerEvent | null {
  if (!isRecord(value)) return null;
  switch (value.kind) {
    case 'status': {
      if (typeof value.state !== 'string' || !STATUS_STATES.has(value.state)) return null;
      const state = value.state as 'starting' | 'running' | 'error';
      if (value.message === undefined) return { kind: 'status', state };
      if (typeof value.message !== 'string' || value.message.length > MAX_STATUS_MESSAGE) return null;
      return { kind: 'status', state, message: value.message };
    }
    case 'summon': case 'click': {
      const point = parsePoint(value);
      return point ? { kind: value.kind, ...point } : null;
    }
    case 'cursor': {
      const point = parsePoint(value);
      return point && typeof value.visible === 'boolean' ? { kind: 'cursor', ...point, visible: value.visible } : null;
    }
    case 'dismiss': return { kind: 'dismiss' };
    default: return null;
  }
}

export function parseTrackerConfig(value: unknown): TrackerConfig | null {
  if (!isRecord(value) || typeof value.menuOpen !== 'boolean' || typeof value.debug !== 'boolean') return null;
  if (value.fps !== TRACKER_FPS.idle && value.fps !== TRACKER_FPS.active) return null;
  const origin = isRecord(value.origin) ? parsePoint(value.origin) : null;
  return origin ? { fps: value.fps, menuOpen: value.menuOpen, origin, debug: value.debug } : null;
}

export interface CameraRequest { isTracker: boolean; permission: string; mediaTypes?: readonly string[]; mediaType?: string }

/** Only the tracker page may open the camera, and never the microphone. */
export function allowsCameraRequest({ isTracker, permission, mediaTypes, mediaType }: CameraRequest): boolean {
  if (!isTracker || permission !== 'media') return false;
  if (mediaTypes) return mediaTypes.length > 0 && mediaTypes.every(type => type === 'video');
  return mediaType === 'video';
}

/** Bridge exposed to the tracker page by its preload. */
export interface TrackerAPI {
  emit(event: TrackerEvent): void;
  onConfig(callback: (config: TrackerConfig) => void): () => void;
}
declare global { interface Window { saoTracker?: TrackerAPI } }
