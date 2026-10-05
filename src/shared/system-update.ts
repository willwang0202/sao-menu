import type { Position } from './contracts';
import type { WorkArea } from './widgets';

/** "Congratulations!!" banner (darkblackswords' SAO_Congratulations!! artwork) shown after an OS update. */
export const CONGRATULATIONS_SIZE = { width: 760, height: 260 } as const;
export const CONGRATULATIONS_SHOW_MS = 6000;
const MAX_VERSION_LENGTH = 100;
const SYSTEM_NAMES: Record<string, string> = { darwin: 'macOS', win32: 'Windows', linux: 'Linux' };

const versionParts = (version: string) => (version.match(/\d+/g) ?? []).map(Number);

/** Numeric comparison of dotted versions; missing parts count as zero. */
export function compareVersions(a: string, b: string): number {
  const left = versionParts(a), right = versionParts(b);
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
}

/** Only an increase over a recorded version counts; the first launch just records it. */
export function isSystemUpdated(previous: string | null, current: string): boolean {
  return previous !== null && compareVersions(current, previous) > 0;
}

export function parseSystemRecord(source: string): string | null {
  try {
    const version = (JSON.parse(source) as { version?: unknown }).version;
    return typeof version === 'string' && version.length > 0 && version.length <= MAX_VERSION_LENGTH ? version : null;
  } catch { return null; }
}

export const systemLabel = (platform: string, version: string) => `${SYSTEM_NAMES[platform] ?? platform} ${version}`;

export function congratulationsPosition(area: WorkArea): Position {
  return {
    x: area.x + Math.round((area.width - CONGRATULATIONS_SIZE.width) / 2),
    y: area.y + Math.round(area.height / 3 - CONGRATULATIONS_SIZE.height / 2),
  };
}
